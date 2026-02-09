# Migration Plan: Integrating ReAct Agent into AIBA

## Executive Summary

Replace AIBA's current single-shot AI workflow (`analyze.ts` - one Gemini API call) with the ReAct agent loop from "Agentic Approach - Custom". The agent iteratively builds the PDD using tool calls (`read_pdd`/`write_pdd`), producing significantly richer output through multi-pass analysis. This plan covers the JSON structure mapping, agent integration into Convex, real-time UI updates, and required component changes.

---

## 1. Architecture Comparison

### Current AIBA (Single-Shot Workflow)

```
Upload Video
    -> Upload to Gemini Files API
    -> Single generateContent() call with full prompt + JSON schema
    -> Parse JSON response
    -> Write to Convex DB (processes, steps, processFlows)
    -> Post-process (screenshots, bounding boxes, sensitive info)
    -> Done
```

- **1 API call** for entire analysis
- Gemini returns complete JSON in one response
- No iterative refinement
- No context caching (full video sent each time)
- Cost: High (full video tokens on every call)

### New Agent (ReAct Loop)

```
Upload Video
    -> Upload to Gemini Files API
    -> Create context cache (video + system prompt + tools)
    -> ReAct Loop (up to 50 iterations):
        -> Gemini reasons about what to do next
        -> Calls read_pdd / write_pdd tools
        -> Server executes tools, returns results
        -> Agent continues until done
    -> Delete cache
    -> Done
```

- **10-50 API calls** per analysis (iterative)
- Agent builds PDD incrementally via tool calls
- Self-reviewing (reads its own output, corrects mistakes)
- Context caching (video cached once, reused across all iterations)
- Cost: Lower per-token (90% cached discount), but more calls

---

## 2. PDD JSON Structure Mapping

### 2.1 Field Name Conventions

The agent uses `snake_case` in its JSON output. AIBA's Convex schema uses `camelCase`. A mapping layer is required.

### 2.2 Process Mapping

| Agent Field (snake_case) | AIBA DB Field (camelCase) | Notes |
|---|---|---|
| `process_id` | Auto-generated `_id` | Agent's ID used as temp ref only |
| `process_name` | `processName` | Direct map |
| `process_description` | `processDescription` | Direct map |
| `is_main_process` | `isMainProcess` | Direct map |
| `parent_process_id` | `parentProcessId` | Resolve agent ID to Convex `_id` |
| `recording_duration_seconds` | `recordingDurationSeconds` | Direct map |
| `total_steps` | `totalSteps` | Direct map |
| `video_start_timestamp` | `videoStartTimestamp` | Direct map |
| `video_end_timestamp` | `videoEndTimestamp` | Direct map |
| `applications[]` | `applications[]` | Same structure, map `type` field |
| `business_rules_observed[]` | `businessRulesObserved[]` | Direct map |
| `exceptions_noted[]` | `exceptionsNoted[]` | Direct map |
| `flow` (embedded) | `processFlows` table (separate) | Needs extraction to separate table |
| `steps[]` (embedded) | `steps` table (separate) | Needs extraction to separate table |

**Key Difference:** In the agent, `flow` and `steps` are embedded inside each `Process`. In AIBA, they are separate Convex tables (`processFlows`, `steps`) linked by `processId`.

### 2.3 Step Mapping

| Agent Field | AIBA DB Field | Notes |
|---|---|---|
| `step_number` | `stepNumber` | Direct map |
| `timestamp` | `timestamp` | Direct map (MM:SS.s format) |
| (derive from timestamp) | `timestampSeconds` | Must parse from timestamp string |
| `flow_node_id` | `flowNodeId` | Direct map |
| `action_type` | `actionType` | Direct map - same 6 enum values |
| `specific_action` | `specificAction` | **Needs mapping** - agent uses free-text, AIBA has 34 enum values |
| `description` | `description` | Direct map |
| `application` | `application` | Direct map |
| `screen_name` | `screenName` | Direct map |
| `screenshot_required` | `screenshotRequired` | Direct map |
| `ui_element` | `uiElement` | Nested object - map sub-fields (see 2.4) |
| `data_info` | `dataInfo` | Nested object - map sub-fields (see 2.5) |
| `wait_condition` | `waitCondition` | Nested object - map sub-fields |
| `notes` | `notes` | Direct map |
| `automation_hint` | `automationHint` | Direct map |

### 2.4 UI Element Mapping

| Agent Field | AIBA DB Field | Notes |
|---|---|---|
| `element_name` | `elementName` | Direct map |
| `element_type` | `elementType` | **Needs mapping** - agent uses free text, AIBA has 37 enum values |
| `location_description` | `locationDescription` | Direct map |
| `screen_region` | `screenRegion` | Agent uses free text, AIBA has 10 enum values |
| `parent_element` | `parentElement` | Direct map |
| `identifiers.id` | `identifiers.id` | Direct map |
| `identifiers.class_name` | `identifiers.className` | Rename |
| `identifiers.xpath` | `identifiers.xpath` | Direct map |
| `identifiers.accessibility_id` | `identifiers.accessibilityId` | Rename |

### 2.5 Data Info Mapping

| Agent Field | AIBA DB Field | Notes |
|---|---|---|
| `value` | `value` | Direct map |
| `data_type` | `dataType` | Agent uses free text, AIBA has 13 enum values |
| `source` | `source` | Agent uses free text, AIBA has 7 enum values |
| `is_sensitive` | `isSensitive` | Direct map |
| `format` | `format` | Direct map |
| `validation_rules[]` | `validationRules[]` | Direct map |

### 2.6 Flow Node Mapping

| Agent Field | AIBA DB Field | Notes |
|---|---|---|
| `node_id` | `nodeId` | Rename |
| `node_type` | `nodeType` | Same 8 enum values |
| `step_number` | `stepNumber` | Direct map |
| `condition` | `condition` | Direct map |
| `condition_description` | `conditionDescription` | Rename |
| `subprocess_id` | `subprocessId` | Rename |
| `end_type` | `endType` | Same 4 enum values |
| `label` | `label` | Direct map |
| (not in agent) | `position` | AIBA-only, for manual layout |

### 2.7 Flow Edge Mapping

| Agent Field | AIBA DB Field | Notes |
|---|---|---|
| `edge_id` | `edgeId` | Rename |
| `from_node_id` | `fromNodeId` | Rename |
| `to_node_id` | `toNodeId` | Rename |
| `label` | `label` | Direct map |
| `condition` | `condition` | Direct map |
| `edge_type` | `edgeType` | Same 4 enum values |
| `is_default` | `isDefault` | Direct map |

### 2.8 Enum Value Mapping Strategy

The agent's system prompt should be updated to output AIBA's exact enum values. For any values that don't match, create a mapping function:

```
Agent "specific_action" (free text) -> closest AIBA specificAction enum value
Agent "element_type" (free text)    -> closest AIBA elementType enum value
Agent "screen_region" (free text)   -> closest AIBA screenRegion enum value
Agent "data_type" (free text)       -> closest AIBA dataType enum value
Agent "source" (free text)          -> closest AIBA dataSource enum value
```

**Recommended approach:** Update the agent's system prompt JSON schema to include AIBA's exact enum values as constraints. This ensures the model outputs valid values directly.

---

## 3. Agent Integration into Convex

### 3.1 New Convex Action: `agentAnalyze.ts`

Replace the current `analyze.ts` single-shot approach with a new Convex action that runs the ReAct agent loop.

**Responsibilities:**
1. Upload video to Gemini Files API (reuse existing `geminiApi.ts`)
2. Create context cache with video + system prompt + tool declarations
3. Run ReAct loop inside the Convex action
4. On each tool call, write directly to Convex DB (not in-memory JSON)
5. Emit progress updates to a new `agentEvents` table
6. Clean up cache on completion

**Key Decision: Where does the agent loop run?**

| Option | Pros | Cons |
|---|---|---|
| **A) Inside Convex Action** | Single deployment, uses Convex DB directly | Convex actions have 10-min timeout, limited Node.js env |
| **B) Separate Express server** | No timeout limits, full Node.js | Separate deployment, needs API bridge to Convex |
| **C) Convex Action with chunking** | Uses Convex natively, survives timeouts | Complex state management across action invocations |

**Recommended: Option A (Inside Convex Action)** with a timeout guard. Most analyses complete in 1-3 minutes. For longer ones, implement Option C as a fallback where the action saves state and re-invokes itself.

### 3.2 Tool Rewiring: write_pdd -> Convex DB

The agent's `write_pdd` tool currently writes to an in-memory `PddDocument` object. For AIBA, each operation must write to Convex DB tables instead.

| write_pdd Operation | Convex Action |
|---|---|
| `set_processes` | Delete existing processes for job, create new process records |
| `add_process` | `ctx.runMutation(internal.createProcess, {...})` |
| `update_process` | `ctx.runMutation(internal.updateProcess, {...})` |
| `add_steps` | `ctx.runMutation(internal.createSteps, { steps: [...] })` per process |
| `set_flow` | `ctx.runMutation(internal.saveFlow, { processId, nodes, edges })` |
| `update_metadata` | `ctx.runMutation(internal.updateProcessMetadata, {...})` |

**The tool functions must:**
1. Accept the agent's snake_case JSON
2. Map to AIBA's camelCase schema
3. Validate enum values (map or reject)
4. Write to Convex DB via mutations
5. Return current PDD stats (for the agent to see progress)

### 3.3 Tool Rewiring: read_pdd -> Convex DB

The `read_pdd` tool must query Convex DB instead of in-memory state.

| read_pdd Section | Convex Query |
|---|---|
| `full` | Query all processes + steps + flows for the job |
| `processes` | `ctx.runQuery(internal.getProcessesForJob, { jobId })` |
| `steps` | `ctx.runQuery(internal.getStepsForProcess, { processId })` |
| `flow` | `ctx.runQuery(internal.getFlowForProcess, { processId })` |
| `metadata` | Query process record for applications, rules, exceptions |

### 3.4 Process ID Resolution

The agent generates temporary `process_id` strings (e.g., `"proc-001"`). AIBA uses Convex auto-generated `_id` values. Maintain a mapping during the agent loop:

```
agentProcessIdMap: Map<string, Id<"processes">>
// "proc-001" -> "k57abc123..."
```

When the agent references a `process_id` in `add_steps`, `set_flow`, etc., resolve it to the actual Convex ID.

### 3.5 Gemini Client Adaptation

AIBA already has `geminiApi.ts` with REST-based Gemini API calls. The agent currently uses the `@google/genai` SDK. Options:

| Option | Recommendation |
|---|---|
| Use AIBA's existing `geminiApi.ts` | Extend it with caching and tool-calling support |
| Port agent's SDK-based approach | Cleaner but adds dependency |

**Recommended:** Extend AIBA's `geminiApi.ts` with three new functions:
- `createGeminiCache(apiKey, fileUri, mimeType, systemPrompt, tools, ttl)`
- `generateWithCache(apiKey, model, cacheName, messages)`
- `deleteGeminiCache(apiKey, cacheName)`
- `refreshCacheTTL(apiKey, cacheName, ttl)`

---

## 4. Real-Time Progress & Events

### 4.1 Current AIBA Approach

AIBA uses Convex reactive queries (`useQuery`) for real-time updates. The `jobs` table has a `progress` field (0-100) and `status` field that the UI polls reactively.

### 4.2 Agent Events Strategy

Create a new `agentEvents` table in Convex to store granular events (replacing SSE):

```typescript
// New table in schema.ts
agentEvents: defineTable({
  jobId: v.id("jobs"),
  eventType: v.union(
    v.literal("state_changed"),
    v.literal("thinking"),
    v.literal("tool_call"),
    v.literal("tool_result"),
    v.literal("pdd_updated"),
    v.literal("progress"),
    v.literal("completed"),
    v.literal("error")
  ),
  payload: v.string(),  // JSON-encoded event data
  iteration: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_job", ["jobId"])
  .index("by_job_time", ["jobId", "createdAt"]),
```

**Why a table instead of SSE:**
- Convex doesn't support SSE natively
- Reactive queries on `agentEvents` provide the same real-time effect
- Events are persisted (can replay history for completed sessions)
- Works with Convex's existing architecture

### 4.3 Frontend Event Consumption

```typescript
// React component
const events = useQuery(api.agentEvents.getEventsForJob, { jobId });
// Automatically re-renders when new events are inserted
```

### 4.4 Event-to-Progress Mapping

Map agent events to the existing `jobs.progress` field for backward compatibility:

| Agent State | Progress % | Status |
|---|---|---|
| Uploading video | 0-15 | `processing` |
| Creating cache | 15-25 | `processing` |
| Iteration 1-10 of 50 | 25-40 | `processing` |
| Iteration 11-30 of 50 | 40-70 | `processing` |
| Iteration 31-50 of 50 | 70-90 | `processing` |
| Saving output | 90-95 | `processing` |
| Post-processing | 95-100 | `processing` |
| Done | 100 | `completed` |

---

## 5. Post-Processing Integration

After the agent loop completes, AIBA's existing post-processing pipeline runs:

1. **Screenshot extraction** (`autoExtractScreenshots`) - Uses `timestampSeconds` from steps to extract video frames. No changes needed - works on `steps` table.

2. **Bounding box detection** (`autoBoundingBoxes`) - Uses screenshots + step context to detect UI elements. No changes needed - works on `steps` table.

3. **Sensitive info detection** (`autoSensitiveInfo`) - Uses screenshots to detect sensitive data. No changes needed - works on `steps` table.

4. **Flow generation** - The agent already generates flow nodes/edges. The existing `processFlows` save logic can be reused. The auto-generation fallback in AIBA is no longer needed (agent always produces flows).

**Trigger:** After agent loop completes and all data is in the DB, call existing post-processing functions if the corresponding flags are enabled on the job.

---

## 6. Cost Tracking Integration

### 6.1 Per-Iteration Logging

Each Gemini API call in the agent loop must log to AIBA's `apiLogs` table:

```typescript
await ctx.runMutation(internal.apiLogs.logApiCall, {
  model: "gemini-3-flash-preview",
  category: "agent_analysis",       // New category
  source: "agentAnalyze.ts",
  promptTokens: usage.promptTokenCount,
  completionTokens: usage.candidatesTokenCount,
  durationMs: stepDurationMs,
  status: "success",
  processId: currentProcessId,
});
```

### 6.2 Cache Storage Cost

Add cache storage cost tracking to `apiLogs` or a summary field on the job. Log it as a single entry when the cache is deleted:

```typescript
await ctx.runMutation(internal.apiLogs.logApiCall, {
  model: "gemini-3-flash-preview",
  category: "cache_storage",
  source: "agentAnalyze.ts",
  promptTokens: cacheTokenCount,
  completionTokens: 0,
  cost: cacheStorageCost,
  durationMs: cacheDurationMs,
  status: "success",
  processId: mainProcessId,
});
```

### 6.3 Cost Display

The existing Analytics page (`/analytics`) already reads from `apiLogs`. Add `"agent_analysis"` and `"cache_storage"` to the category filter dropdown.

---

## 7. System Prompt Adaptation

### 7.1 What Changes

The agent's system prompt (`server/src/prompts/system.ts`) must be adapted to:

1. **Use AIBA's exact enum values** for `specificAction`, `elementType`, `screenRegion`, `dataType`, `dataSource`, `waitType`
2. **Use AIBA's field naming** in the JSON schema examples within the prompt (camelCase)
3. **Reference AIBA's PDD structure** including subprocess hierarchy support
4. **Include `timestampSeconds`** as a required output field (AIBA uses it for screenshot extraction)

### 7.2 Storage

Store the adapted system prompt in AIBA's `prompts` table:

```typescript
{
  type: "system",
  name: "Agent Analysis System Prompt V1",
  version: "v1",
  versionNumber: 1,
  content: "...",       // The full system prompt
  isDefault: true,
  isActive: true,
  source: "builtin",
}
```

### 7.3 Tool Declarations

Tool declarations (`read_pdd`, `write_pdd`) should also be stored in the DB or as constants in the agent module. They define the JSON schema the agent uses when calling tools.

---

## 8. UI Components Plan

### 8.1 Components to Reuse from AIBA (No Changes)

These existing AIBA components work as-is since they read from the same DB tables:

| Component | Why No Changes |
|---|---|
| `PddPanel` / Process viewer | Reads from `processes`, `steps`, `processFlows` tables |
| `StepDetail.tsx` | Reads step data from `steps` table |
| `StepEditDialog.tsx` | Edits step data in `steps` table |
| `FlowchartViewer.tsx` | Reads from `processFlows` table |
| `ScreenshotExtractor.tsx` | Works on `steps.timestampSeconds` |
| `BoundingBoxDetector.tsx` | Works on `steps` table |
| `BoundingBoxOverlay.tsx` | Reads `steps.boundingBox` |
| `SensitiveInfoDetector.tsx` | Works on `steps` table |
| `ExportButton/Dialog.tsx` | Reads from all PDD tables |
| `ProcessHeader.tsx` | Reads `processes` table |
| `ApplicationsList.tsx` | Reads `processes.applications` |
| `RawResponseViewer.tsx` | Can show agent conversation history |
| `AnalysisPromptEditor.tsx` | Manages prompts in `prompts` table |

### 8.2 Components to Adapt

| Component | Changes Needed |
|---|---|
| `VideoUploader.tsx` | Add "Use Agent" toggle/option alongside existing workflow mode |
| `JobsList.tsx` | Show agent-specific status (iteration count, current state) |
| `ProcessingStatus.tsx` | Display agent progress phases (uploading/caching/analyzing) |
| `PddGenerationToast.tsx` | Show agent iteration progress instead of simple % |

### 8.3 New Components to Create

#### 8.3.1 `AgentTimeline.tsx`
Real-time timeline of agent activity during analysis.

**Data source:** `useQuery(api.agentEvents.getEventsForJob, { jobId })`

**Renders:**
- State changes (uploading, caching, analyzing)
- Agent thinking text (collapsible)
- Tool calls with arguments (collapsible, color-coded)
- Tool results with success/error status
- PDD update notifications with stats
- Per-iteration cost/token/duration summary (expandable with call details)
- Completion summary
- Error messages

**Design:** Match AIBA's existing card-based design using shadcn/ui components (`Card`, `Badge`, `Button` for expand/collapse).

#### 8.3.2 `AgentCostTracker.tsx`
Displays running cost and token usage in the header area.

**Data source:** Derived from last `progress` event in `agentEvents` table.

**Renders:**
- Total cost (e.g., `$0.0384`)
- Total tokens (e.g., `202.1k tokens`)
- Tooltip with breakdown: input / output / cached

**Design:** Small inline display, fits in AIBA's header bar next to existing API usage indicator.

#### 8.3.3 `AgentStatusBadge.tsx`
Shows current agent state with pulse animation during active states.

**States:** `idle` | `uploading` | `caching` | `analyzing` | `completed` | `error`

**Design:** Colored dot + label, matches AIBA's existing badge styling.

#### 8.3.4 `AgentControlBar.tsx`
Controls for running/stopping agent analysis.

**Contains:**
- Stop button (visible during analysis)
- Re-run button (visible when completed/error)
- Iteration counter (e.g., "Iteration 12/50")
- Elapsed time display

**Design:** Integrates into the process page header area.

#### 8.3.5 `IterationDetailPanel.tsx`
Expandable detail view for a single agent iteration (loaded on demand).

**Shows:**
- Full request context (message count)
- Model response text
- Function calls with full arguments
- Tool results with full data
- Token breakdown (input/output/cached)
- Cost for this iteration
- Duration

**Design:** Accordion/collapsible within `AgentTimeline`, uses shadcn `Card` + `Tabs`.

### 8.4 Page Integration

#### Process Page (`/process/[id]/page.tsx`)

Add a new tab or panel for the agent timeline:

```
[Flowchart] [Steps List] [Agent Log] [Export]
```

The "Agent Log" tab shows `AgentTimeline.tsx` with full event history for the analysis that created this process. It replaces the current `RawResponseViewer` for agent-analyzed processes.

#### Upload Page (`/upload/page.tsx`)

Add analysis mode selector:

```
Analysis Mode:
  ( ) Standard (Single AI call - faster, simpler)
  (x) Agent Mode (Iterative analysis - more thorough, higher quality)

[Agent Settings]
  Max Iterations: [50]
  Cache TTL: [5] minutes
```

#### Dashboard (`/page.tsx`)

No structural changes. The stats cards and recent activity work from `jobs` table which remains the same.

---

## 9. Database Schema Changes

### 9.1 New Table: `agentEvents`

```typescript
agentEvents: defineTable({
  jobId: v.id("jobs"),
  eventType: v.string(),     // state_changed, thinking, tool_call, tool_result,
                              // pdd_updated, progress, completed, error
  payload: v.string(),        // JSON-encoded event-specific data
  iteration: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_job", ["jobId"])
  .index("by_job_time", ["jobId", "createdAt"]),
```

### 9.2 New Table: `agentSessions`

```typescript
agentSessions: defineTable({
  jobId: v.id("jobs"),
  state: v.string(),           // idle, uploading, caching, analyzing, completed, error
  maxIterations: v.number(),
  iteration: v.number(),

  // Gemini state
  cacheName: v.optional(v.string()),
  cacheCreatedAt: v.optional(v.number()),
  cacheTokenCount: v.optional(v.number()),

  // Token accounting
  inputTokens: v.number(),
  outputTokens: v.number(),
  cachedTokens: v.number(),
  totalCost: v.number(),

  // Timing
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),

  // Process ID mapping (agent temp IDs -> Convex IDs)
  processIdMap: v.optional(v.string()),  // JSON: {"proc-001": "k57abc123..."}
})
  .index("by_job", ["jobId"]),
```

### 9.3 Modified Table: `jobs`

Add optional fields to existing `jobs` table:

```typescript
// Add to existing jobs table:
analysisMode: v.optional(v.union(v.literal("standard"), v.literal("agent"))),
agentMaxIterations: v.optional(v.number()),
```

### 9.4 New Entry in `apiLogs` Categories

Add to the existing category logic:
- `"agent_analysis"` - Per-iteration Gemini API calls
- `"cache_storage"` - Context cache storage cost

---

## 10. Implementation Phases

### Phase 1: Core Agent Engine (Backend)
**Files to create/modify in `convex/`:**

1. **`convex/agentLoop.ts`** - Port the ReAct loop logic from `server/src/agent/loop.ts`
   - Adapt to Convex action context
   - Replace in-memory PDD with Convex DB writes
   - Replace SSE emit with `agentEvents` table inserts

2. **`convex/agentTools.ts`** - Port tool system from `server/src/agent/tools.ts`
   - `read_pdd`: Query Convex DB tables
   - `write_pdd`: Write to Convex DB tables with camelCase mapping
   - Include snake_case -> camelCase field mapper
   - Include enum value mapper/validator

3. **`convex/agentCache.ts`** - Cache management (extend `geminiApi.ts`)
   - `createCache()` - Create Gemini context cache
   - `refreshCacheTTL()` - Extend cache lifetime
   - `deleteCache()` - Clean up cache

4. **`convex/agentEvents.ts`** - Event queries/mutations
   - `insertEvent()` mutation
   - `getEventsForJob()` query
   - `clearEventsForJob()` mutation

5. **`convex/agentSessions.ts`** - Session management
   - `createSession()` mutation
   - `updateSession()` mutation
   - `getSessionForJob()` query

6. **Update `convex/schema.ts`** - Add `agentEvents`, `agentSessions` tables and `jobs` field additions

7. **`convex/agentPrompts.ts`** - Adapted system prompt for AIBA's schema
   - Store as entry in `prompts` table (type: "system", source: "builtin")
   - Include AIBA's exact enum values in tool JSON schemas

### Phase 2: Entry Point & Job Integration

1. **`convex/agentAnalyze.ts`** - New Convex action (entry point)
   - Replaces `analyze.ts` when `analysisMode === "agent"`
   - Calls agentLoop, handles errors, triggers post-processing

2. **Modify `convex/jobs.ts`** - Add `analysisMode` and `agentMaxIterations` to job creation

3. **Modify upload flow** - Route to `agentAnalyze.ts` or `analyze.ts` based on mode

4. **Modify `convex/reanalyze.ts`** - Support re-analysis in agent mode

### Phase 3: Frontend - Core UI

1. **Create `AgentTimeline.tsx`** - Event timeline component
2. **Create `AgentCostTracker.tsx`** - Cost display component
3. **Create `AgentStatusBadge.tsx`** - State badge component
4. **Create `AgentControlBar.tsx`** - Start/stop controls

### Phase 4: Frontend - Integration

1. **Modify `VideoUploader.tsx`** - Add agent mode toggle
2. **Modify `process/[id]/page.tsx`** - Add Agent Log tab
3. **Modify `JobsList.tsx`** - Show agent-specific progress info
4. **Modify `ProcessingStatus.tsx`** - Handle agent states
5. **Modify `PddGenerationToast.tsx`** - Show iteration progress

### Phase 5: Polish & Testing

1. **Cost tracking verification** - Ensure all API calls logged correctly
2. **Error handling** - Agent timeout, cache expiry, malformed tool calls
3. **Version history** - Ensure `analysisVersions` works with agent-produced data
4. **Export compatibility** - Verify Word/PDF export with agent-produced PDD
5. **Prompt tuning** - Optimize agent system prompt for AIBA's schema

---

## 11. File-by-File Mapping

### What to port from "Agentic Approach - Custom"

| Source File | Target Location | Adaptation |
|---|---|---|
| `server/src/agent/loop.ts` | `convex/agentLoop.ts` | Convex action context, DB writes instead of in-memory |
| `server/src/agent/tools.ts` | `convex/agentTools.ts` | Convex queries/mutations, camelCase mapping |
| `server/src/agent/state.ts` | `convex/agentSessions.ts` | Convex table instead of in-memory Map + JSON files |
| `server/src/gemini/cache.ts` | `convex/agentCache.ts` | Use AIBA's REST-based Gemini approach |
| `server/src/gemini/fileUpload.ts` | (reuse existing) | AIBA's `geminiApi.ts` already handles upload |
| `server/src/prompts/system.ts` | `convex/agentPrompts.ts` | Adapt for AIBA schema, store in `prompts` table |
| `server/src/config.ts` | `convex/agentConfig.ts` | Read from AIBA's `settings` table |
| `server/src/types/agent.ts` | (inline in agentLoop) | Simplified - no need for full session type |
| `server/src/types/pdd.ts` | (not needed) | AIBA already has its own types in `convex/types.ts` |
| `server/src/types/events.ts` | `convex/agentEvents.ts` | Event types as Convex validators |
| `server/src/api/sse.ts` | (not needed) | Replaced by Convex reactive queries |
| `server/src/api/routes.ts` | (not needed) | Convex functions replace REST endpoints |
| `client/src/components/Timeline.tsx` | `src/components/pdd/AgentTimeline.tsx` | Rewrite with shadcn/ui, Convex queries |
| `client/src/components/TimelineEvent.tsx` | (inline in AgentTimeline) | Adapt styling to AIBA design system |
| `client/src/components/CostTracker.tsx` | `src/components/pdd/AgentCostTracker.tsx` | Smaller, header-integrated version |
| `client/src/components/StatusBadge.tsx` | `src/components/pdd/AgentStatusBadge.tsx` | Match AIBA badge styling |
| `client/src/lib/flowTraversal.ts` | (not needed) | AIBA has React Flow-based FlowchartViewer |

### What NOT to port

| Source File | Reason |
|---|---|
| `client/src/components/Sidebar.tsx` | AIBA has its own sidebar |
| `client/src/components/PddPanel.tsx` | AIBA has its own process viewer |
| `client/src/components/NewAnalysisDialog.tsx` | AIBA has VideoUploader |
| `client/src/api.ts` | Replaced by Convex hooks |
| `client/src/hooks/usePddData.ts` | AIBA uses Convex reactive queries |
| `server/src/index.ts` | No Express server needed |
| `pdd-viewer.html` | AIBA has its own viewer |

---

## 12. Configuration Mapping

| Agent Config | AIBA Storage | Key |
|---|---|---|
| `geminiApiKey` | `settings` table | `"gemini_api_key"` |
| `geminiModel` | `settings` table | `"analysis_model"` |
| `agent.defaultMaxIterations` | Job field | `agentMaxIterations` |
| `agent.cacheTtlMinutes` | `settings` table | `"agent_cache_ttl_minutes"` (new) |
| `agent.cacheRefreshEveryNIterations` | Hardcoded constant | 20 |
| `agent.maxRetries` | Hardcoded constant | 5 |
| `cost.inputPer1MTokens` | Hardcoded constant | 0.15 |
| `cost.outputPer1MTokens` | Hardcoded constant | 3.50 |
| `cost.cachedInputPer1MTokens` | Hardcoded constant | 0.0375 |
| `cost.cacheStoragePer1MTokensPerHour` | Hardcoded constant | 1.00 |

---

## 13. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Convex action 10-min timeout | Implement chunked execution: save state, re-invoke action |
| Cache expires during analysis | TTL refresh every 20 iterations (already implemented) |
| Agent produces invalid enum values | Mapping layer with fallback to `"other"` |
| Large event tables | Periodic cleanup of old `agentEvents` (after job completion + 7 days) |
| Backward compatibility | Keep `analyze.ts` as-is, agent is opt-in via `analysisMode` toggle |
| Convex cold starts | Agent loop is a single long-running action, not affected |

---

## 14. Success Criteria

1. Agent-analyzed PDDs appear identically to workflow-analyzed PDDs in all AIBA views (process viewer, flowchart, export)
2. Real-time agent progress visible in UI during analysis
3. All post-processing features work (screenshots, bounding boxes, sensitive info detection)
4. Cost tracking accurate and visible in Analytics page
5. Re-analysis works in agent mode
6. Export to Word/PDF produces correct documents from agent-analyzed data
7. No regressions in standard (non-agent) analysis mode
