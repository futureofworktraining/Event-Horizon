# AI Chat Feature Implementation Plan

## Context

The AgentPanel already has a disabled chat placeholder ("coming soon"). The codebase has a fully functional ReAct agent infrastructure (sessions, events, tools, Gemini cache). This plan adds an interactive chat that lets users converse with the AI about the PDD and edit it using the existing tool system, with full cache TTL visibility.

## Architecture Overview

- **New `chatMessages` table** for reactive message display (separate from analysis `agentEvents`)
- **New `convex/agentChat.ts`** action for chat message processing
- **Chat instructions appended to cached prompt** (alongside existing `TOOL_INSTRUCTIONS`) so one cache works for both analysis and chat
- **Cache created on-demand** when user sends first chat message (analysis cache is deleted on completion)
- **Gemini file preserved** after analysis so chat doesn't need to re-upload video
- **Cache TTL countdown** in UI header with green/red indicator

## Files to Create

### 1. `convex/agentChat.ts` — Chat action + cache management

```typescript
"use node";
// Only actions allowed in "use node" files

// sendChatMessage action:
//   - Validates session state === "completed"
//   - Gets API key and model from settings
//   - Inserts user message to chatMessages table
//   - Inserts placeholder assistant message (status: "processing")
//   - Calls ensureChatCache() to get/create cache
//   - Loads chatConversationHistory from session (or starts empty)
//   - Runs chat loop: max 5 tool-call iterations per message
//     - generateContentWithCache() with conversation
//     - Track tokens per iteration
//     - Execute any function calls via executeTool()
//     - Collect tool call details for display
//   - Updates assistant message with final content, toolCalls, tokens, cost
//   - Updates session chatConversationHistory + cumulative chat token/cost totals
//   - Logs API call to apiLogs

// refreshChatCache action:
//   - Refreshes TTL on existing chat cache via refreshGeminiCacheTTL()
//   - Updates chatCacheExpiresAt on session
//   - If cache expired/invalid, clears chatCacheName/chatCacheExpiresAt

// ensureChatCache helper (not exported, internal to action):
//   - Checks session.chatCacheName + chatCacheExpiresAt
//   - If valid: refreshes TTL, returns cacheName
//   - If expired/missing: creates new cache
//     - Tries to reuse session.geminiFileName (getGeminiFile to check if ACTIVE)
//     - If file unavailable: re-uploads video from Convex storage
//     - Gets system prompt (same priority logic as agentAnalyze.ts getSystemPrompt)
//     - Appends TOOL_INSTRUCTIONS + CHAT_INSTRUCTIONS
//     - Creates cache with createGeminiCache()
//     - Stores chatCacheName + chatCacheExpiresAt + geminiFileName on session

// CHAT_INSTRUCTIONS constant (exported for reuse):
```

**CHAT_INSTRUCTIONS prompt text:**

```
## Chat Mode

When the user sends you conversational messages, you are in chat mode. The PDD has already been analyzed. Your role:

1. Answer questions about the process, steps, flowchart, and video content
2. Make edits when requested using read_pdd and write_pdd tools
3. Always use read_pdd to check current state before making modifications
4. Report what you changed after each edit
5. For destructive actions (deleting steps/processes), confirm with the user first
6. Reference steps by number (e.g., "Step 3")
7. Keep responses concise

Additional write_pdd operations for chat:
- `operation: "update_step"` — Update specific step fields. Provide process_id, and data with step_number + fields to change.
- `operation: "delete_step"` — Delete a step. Provide process_id and data with step_number.
```

### 2. `convex/chatMessages.ts` — CRUD for chat messages

```typescript
// NOT "use node" — queries and mutations allowed

// getChatCacheStatus query (public, reactive):
//   - Reads agentSessions by_job
//   - Returns { hasCache, expiresAt, isExpired }
//   - Used by CacheStatusIndicator for countdown

// getMessagesForJob query (public, reactive):
//   - Returns chatMessages ordered by createdAt asc
//   - Used by ChatMessageList for real-time display

// insertMessage internalMutation:
//   - Called by sendChatMessage action
//   - Fields: jobId, role, content, toolCalls?, tokens?, cost?, status?, errorMessage?
//   - Returns messageId for later update

// updateMessage internalMutation:
//   - Patches chatMessage by ID with any provided fields
//   - Called after processing to set final content/status/tokens

// clearMessagesForJob internalMutation:
//   - Deletes all chatMessages for a job
//   - Called on re-analysis
```

### 3. `src/components/pdd/ChatMessageList.tsx` — Chat message display

```tsx
// User messages: right-aligned bubbles with User icon (primary bg)
// Assistant messages: left-aligned bubbles with Bot icon (muted bg)
// Tool call cards: collapsed by default, expandable
//   - Shows tool name + success/fail icon
//   - Expands to show args (JSON) and result (JSON)
// Loading indicator: Loader2 spinner + "Thinking..." for status="processing"
// Token/cost metadata: small text below assistant messages
// Auto-scroll: useRef + useEffect on messages.length
// Empty state: Bot icon + "No messages yet" + hint text
```

### 4. `src/components/pdd/CacheStatusIndicator.tsx` — Cache TTL indicator

```tsx
// Uses useQuery(api.chatMessages.getChatCacheStatus, { jobId })
// useEffect with setInterval(1000) for countdown timer
// Green dot + "Cache active (Xm Xs)" when valid
// Red dot + "Cache expired" when expired
// Returns null (hidden) when no cache exists yet
```

## Files to Modify

### 5. `convex/schema.ts`

Add `chatMessages` table:

```typescript
chatMessages: defineTable({
  jobId: v.id("jobs"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  toolCalls: v.optional(v.array(v.object({
    name: v.string(),
    args: v.string(),        // JSON-encoded args
    result: v.optional(v.string()),  // JSON-encoded result
    success: v.optional(v.boolean()),
  }))),
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  cachedTokens: v.optional(v.number()),
  cost: v.optional(v.number()),
  status: v.optional(v.union(
    v.literal("sending"),
    v.literal("processing"),
    v.literal("complete"),
    v.literal("error")
  )),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_job", ["jobId"])
  .index("by_job_time", ["jobId", "createdAt"]),
```

Add fields to `agentSessions`:

```typescript
// Chat: preserved Gemini file for chat reuse
geminiFileName: v.optional(v.string()),
// Chat: separate cache for chat mode
chatCacheName: v.optional(v.string()),
chatCacheExpiresAt: v.optional(v.number()),
// Chat: multi-turn conversation history (JSON)
chatConversationHistory: v.optional(v.string()),
// Chat: token/cost tracking
chatInputTokens: v.optional(v.number()),
chatOutputTokens: v.optional(v.number()),
chatCachedTokens: v.optional(v.number()),
chatTotalCost: v.optional(v.number()),
```

### 6. `convex/agentSessions.ts`

Add new optional args to `updateSession` validator for the new chat fields:

```typescript
// Add after conversationHistory:
geminiFileName: v.optional(v.string()),
chatCacheName: v.optional(v.string()),
chatCacheExpiresAt: v.optional(v.number()),
chatConversationHistory: v.optional(v.string()),
chatInputTokens: v.optional(v.number()),
chatOutputTokens: v.optional(v.number()),
chatCachedTokens: v.optional(v.number()),
chatTotalCost: v.optional(v.number()),
```

### 7. `convex/agentAnalyze.ts`

Three changes:

**a) Add and export CHAT_INSTRUCTIONS constant** (or import from agentChat.ts):

```typescript
export const CHAT_INSTRUCTIONS = `...`; // See prompt text above
```

**b) Append CHAT_INSTRUCTIONS to system prompt** alongside TOOL_INSTRUCTIONS before cache creation:

```typescript
systemPromptContent += TOOL_INSTRUCTIONS;
systemPromptContent += CHAT_INSTRUCTIONS; // NEW
```

**c) Preserve Gemini file on normal completion** (don't call `deleteGeminiFile` on success path):

```typescript
// In the completion cleanup section:
// - Still delete the analysis cache (deleteGeminiCache)
// - Do NOT delete the Gemini file (uploadedFileName)
// - Store geminiFileName on session:
await ctx.runMutation(internal.agentSessions.updateSession, {
  sessionId,
  state: "completed",
  // ... existing fields ...
  geminiFileName: uploadedFileName || undefined, // NEW
});

// Still delete Gemini file on ERROR path and when re-analysis starts
```

### 8. `convex/agentTools.ts`

Add two new operations to `write_pdd` tool declarations enum:

```typescript
enum: [
  "set_processes",
  "add_process",
  "update_process",
  "add_steps",
  "set_flow",
  "update_metadata",
  "update_step",    // NEW
  "delete_step",    // NEW
],
```

Add implementation cases in `executeWritePdd`:

```typescript
case "update_step": {
  // Requires process_id + data.step_number + fields to update
  // Calls internal.agentMutations.updateStepByNumber
  // Returns success + stats
}

case "delete_step": {
  // Requires process_id + data.step_number
  // Calls internal.agentMutations.deleteStepByNumber
  // Updates totalSteps on the process
  // Returns success + stats
}
```

### 9. `convex/agentMutations.ts`

Add two new internal mutations:

```typescript
// updateStepByNumber:
//   - Args: processId, stepNumber, description?, actionType?, specificAction?, application?, screenName?, notes?, automationHint?
//   - Finds step by processId + stepNumber using by_process_step index
//   - Patches with provided fields

// deleteStepByNumber:
//   - Args: processId, stepNumber
//   - Finds and deletes step by processId + stepNumber
//   - Renumbers remaining steps sequentially (1, 2, 3...)
```

### 10. `convex/geminiApi.ts`

Extend `GeminiCacheResult` to include `expireTime`:

```typescript
export interface GeminiCacheResult {
  cacheName: string;
  expireTime?: string; // RFC 3339 timestamp
}

// In createGeminiCache, parse and return expireTime:
return { cacheName: result.name, expireTime: result.expireTime };
```

### 11. `src/components/pdd/AgentPanel.tsx`

Major UI changes:

**a) Tab system:**
- Add `TabId = "activity" | "chat"` type
- Add `activeTab` state
- Render tab switcher bar with Activity and Chat tabs
- Chat tab disabled when session state !== "completed"

**b) Cache indicator:**
- Import and render `CacheStatusIndicator` in header below elapsed time

**c) Chat tab content:**
- Render `ChatMessageList` when activeTab === "chat"
- Keep activity timeline when activeTab === "activity"

**d) Chat input (replaces disabled placeholder):**
- Active textarea (not input) with auto-resize
- Enabled when session.state === "completed"
- Send on Enter (Shift+Enter for newline)
- Send button with Loader2 spinner while processing
- Uses `useAction(api.agentChat.sendChatMessage)`
- Also auto-switches to Chat tab on send if not already there

**e) Chat metrics:**
- Show chat token/cost row below analysis metrics (blue-tinted)
- Only visible when `session.chatInputTokens > 0`
- Shows: Chat Tokens, Chat Cost, Cached

**f) Updated imports:**
- Add: `useCallback`, `Send` from lucide
- Add: `CacheStatusIndicator`, `ChatMessageList`
- Remove unused: `Upload`, `Database`, `ArrowDownRight`, `ArrowUpRight`, `X`

## Cache Flow

```
1. Analysis completes
   → analysis cache deleted
   → Gemini file preserved (geminiFileName stored on session)

2. User sends first chat message
   → ensureChatCache checks: no chatCacheName exists
   → Tries getGeminiFile(geminiFileName) - if ACTIVE, reuse URI
   → If file expired: re-download video from Convex, re-upload to Gemini
   → Creates cache with full prompt (system + TOOL_INSTRUCTIONS + CHAT_INSTRUCTIONS + tools)
   → Stores chatCacheName + chatCacheExpiresAt (now + 5min) on session

3. Subsequent messages
   → ensureChatCache checks chatCacheExpiresAt > now
   → If valid: refreshes TTL via PATCH, proceeds
   → If expired: recreates cache (same flow as step 2)

4. UI shows
   → Green countdown while cache active
   → Red "expired" when chatCacheExpiresAt < now
   → Hidden when no chatCacheName exists

5. On re-analysis
   → Delete chat cache + Gemini file + clear chat messages
```

## Cost Tracking

- Same rates as analysis: input $0.15/1M, cached $0.0375/1M, output $3.50/1M
- Per-message cost calculated and stored on chatMessage
- Cumulative totals stored on session: chatInputTokens, chatOutputTokens, chatCachedTokens, chatTotalCost
- UI shows both analysis metrics and chat metrics separately

## Implementation Order

1. Schema changes (`schema.ts` + `agentSessions.ts`)
2. `chatMessages.ts` (CRUD + cache status query)
3. `geminiApi.ts` (extend cache result)
4. `agentMutations.ts` (add updateStepByNumber, deleteStepByNumber)
5. `agentTools.ts` (add update_step, delete_step)
6. `agentAnalyze.ts` (preserve Gemini file, export CHAT_INSTRUCTIONS, append to prompt)
7. `agentChat.ts` (core chat action + cache management)
8. `CacheStatusIndicator.tsx`
9. `ChatMessageList.tsx`
10. `AgentPanel.tsx` (tabs, chat UI, integrate everything)

## Key Technical Notes

### Convex Constraints
- `"use node"` files can only export actions (not queries/mutations)
- `getChatCacheStatus` must live in a non-node file (e.g., `chatMessages.ts`)
- Actions call internal mutations/queries via `ctx.runMutation(internal.xxx)`
- Public queries use `api.xxx` from client

### Process ID Resolution for Chat
- Agent analysis stores `processIdMap` on session as JSON: `{"proc-001": "convexId..."}`
- Chat action reconstructs this Map from session for tool execution
- `executeTool` uses the map to resolve agent IDs to Convex document IDs

### Gemini File Lifecycle
- Uploaded during analysis, given a `files/xxx` name
- Preserved on success (not deleted), stored as `geminiFileName`
- Still deleted on error/pause paths
- Chat checks file validity via `getGeminiFile()` before reuse
- Files auto-expire after ~48h on Gemini side

### Multi-turn Chat History
- Stored as JSON string on session (`chatConversationHistory`)
- Array of `GeminiMessage` objects: `{role: "user"|"model", parts: [...]}`
- Includes tool call/response messages for full context
- Grows with each chat message exchange

## Verification Checklist

1. Complete an analysis → chat input activates
2. Send "What does step 3 do?" → verify read_pdd called, coherent response
3. Send "Change step 3 description to XYZ" → verify write_pdd called with update_step, PDD updates reactively
4. Send "Delete step 5" → verify write_pdd called with delete_step, steps renumber
5. Check cache countdown displays and counts down correctly
6. Wait for cache expiry → red indicator appears → send message → cache auto-recreates
7. Verify chat metrics (tokens/cost) display correctly
8. Switch between Activity/Chat tabs → state preserved
9. Re-run analysis → chat messages cleared, chat cache deleted
10. Run `npm run dev` and test full flow end-to-end
