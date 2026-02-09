## Inspiration

Every organization runs on processes - yet most of those processes exist only in people's heads. When someone asks "how does this actually work?", the answer is usually a screen recording, a screen share, or "let me show you." The knowledge is locked inside video files that nobody has time to turn into structured documentation.

This matters more than ever. The world is moving toward AI agents that can operate software autonomously, toward digital transformation that requires understanding *what people actually do* before it can be improved. But you can't digitalize what you can't describe. You can't hand a process to an AI agent if that process isn't documented in a structured, machine-readable way.

The documentation gap is massive. A 5-minute screen recording routinely takes **2-4 hours** of manual work to turn into a proper Process Design Document - a step-by-step record of every click, every field, every decision. Organizations estimate that **60-70% of their digitalization effort** is consumed by process discovery and documentation, not by the actual transformation work.

I kept asking myself: *we already record these processes on video - why can't AI just watch the recording and write the document?*

The answer, until recently, was that no model could do it. OCR-based tools can't understand workflow context. Frame-by-frame approaches lose the continuity of actions. Traditional NLP can't "see" a screen.

Then Gemini arrived with native video understanding, million-token context windows, and structured output. Suddenly, the impossible became a weekend prototype - and the prototype became a production tool.

## What it does

**Event Horizon AI** takes a screen recording of any business process and produces a complete, structured Process Design Document (PDD) - a machine-readable blueprint that humans can review and AI agents can act on.

Upload a video. Get back:

- **Step-by-step documentation** - every user action and system response, timestamped to the exact moment in the video (format: `MM:SS.s`)
- **Interactive flowcharts** - auto-generated process diagrams with 8 node types (start, end, action, decision, switch, merge, subprocess, loop_back), rendered with React Flow
- **UI element identification** - for each step, the specific element interacted with: its type (out of 37 categories), its screen region (9-zone grid), and its identifiers (XPath, CSS class, accessibility label)
- **Bounding box overlays** - AI-powered spatial detection that draws a box around the exact UI element in each screenshot, using Gemini's `box_2d` coordinate system (normalized 0-1000 scale)
- **Sensitive data masking** - automatic detection of passwords, PII, credit card numbers, SSNs with visual masking and `is_sensitive` flags
- **Data mapping** - what data flows through each step, its type, source, and whether it needs secure handling
- **Variable standardization** - specific business values replaced with generic `{{VariableName}}` placeholders, making the documentation reusable and environment-agnostic
- **Process hierarchy** - complex processes decomposed into nested subprocesses up to 5 levels deep

The output is structured JSON that can feed directly into automation platforms, AI agent frameworks, or workflow engines - or can be exported as DOCX/PDF for human stakeholders.

What used to take a skilled analyst half a day now takes a screen recording and **under 15 minutes**.

## How we built it

The architecture evolved through three distinct phases:

### Phase 1: Single-Pass Analysis (January 2026)

The initial prototype used a straightforward approach: send the entire video + a comprehensive system prompt + a JSON Schema to Gemini, and get back the complete PDD in one API call.

**Tech stack:**
- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS** for the frontend
- **Convex** for the backend (real-time database, serverless functions, file storage)
- **Google Gemini 2.5 Flash** via `@google/genai` for video analysis
- **React Flow** (`@xyflow/react`) + **Dagre** for interactive flowchart visualization
- **FFmpeg** for screenshot extraction at step timestamps
- **Sharp** + **Jimp** for bounding box overlay image generation

**Key Gemini features used:**
1. **Long Context Video Understanding** - Gemini watches the entire recording and understands actions in sequence
2. **Structured Output** - `responseMimeType: "application/json"` + `responseSchema` forces valid, typed JSON matching our 200+ line PDD schema with 37 UI element types, 34 specific actions, and 8 flowchart node types

This worked well for simple processes but struggled with complex ones - the model would sometimes truncate steps or miss decision points when the output exceeded `maxOutputTokens: 65536`.

### Phase 2: Prompt Engineering & Database-Driven Prompts (Late January)

We moved all prompts into the database, making them editable and versionable:
- System prompt, user prompt, and JSON schema stored in a unified `prompts` table
- Version history for re-analysis comparison
- Customizable prompts per process (different domains need different detail levels)

### Phase 3: ReAct Agent Architecture (February 2026)

The breakthrough. Instead of asking Gemini to produce the entire document in one shot, we built an **autonomous ReAct (Reason + Act) agent loop** - the same pattern used by Gemini CLI:

```
while (iteration < 50):
    REASON  -> Gemini analyzes the video and decides what to do next
    ACT     -> Calls read_pdd or write_pdd tools
    OBSERVE -> Tool results fed back into the conversation
    EMIT    -> Events streamed to the UI in real-time
```

This uses three additional Gemini features:

3. **Context Caching** - The video (100K-500K tokens), system prompt, and tool declarations are cached once. Each iteration only sends the conversation history (~1-2K tokens). This reduces input costs by **75%**:

$$\text{Cost}_{\text{cached}} = \frac{\$0.0375}{1M} \quad vs \quad \text{Cost}_{\text{standard}} = \frac{\$0.15}{1M}$$

For a typical 35-iteration analysis with 265K cached tokens:

$$\text{Savings} = 1 - \frac{C_{\text{cached}}}{C_{\text{standard}}} \approx 70\text{-}75\%$$

4. **Function Calling** - Two tools declared with full parameter schemas:
   - `read_pdd(section, process_id)` - read back the document being built
   - `write_pdd(operation, process_id, data)` - add processes, steps, flowcharts incrementally

5. **Thinking Mode Control** - Enabled (default) for the reasoning agent, but explicitly **disabled** (`thinkingBudget: 0`) for spatial tasks (bounding box detection, sensitive data detection), where thinking actually degrades spatial accuracy.

### Post-Processing Pipeline

After the PDD is generated, a separate pipeline runs per screenshot:
- **Bounding box detection**: Gemini receives the screenshot (resized to max 640px per Google's recommendation) + context about the target UI element. Returns `box_2d: [ymin, xmin, ymax, xmax]` in 0-1000 normalized coordinates. Temperature set to 0 for deterministic results.
- **Sensitive data detection**: Same spatial approach but returns multiple boxes with confidence scores.
- **Overlay generation**: Jimp draws green boxes for normal elements, red boxes for sensitive data, with labels.

## Challenges we ran into

### 1. The ESM Loader Problem on Windows

The `@google/genai` and `@google/generative-ai` SDK packages have internal dependencies that trigger ESM loader errors in Convex's Node.js environment on Windows. We spent days debugging cryptic import failures before writing a **raw REST API wrapper** (`convex/geminiApi.ts`) that bypasses the SDK entirely for video analysis, context caching, and multi-turn generation. The SDK is only used for bounding box detection (simpler single-turn calls that don't hit the ESM issue).

### 2. Structured Output Token Limits

Complex processes with 30+ steps, nested subprocesses, and detailed flowcharts can exceed `maxOutputTokens: 65536`. The single-pass approach would silently truncate the JSON, producing invalid output. This was the primary motivation for the ReAct agent architecture - each tool call writes a small piece, so no single response needs to contain the entire document.

### 3. Thinking Mode Hurts Spatial Tasks

We initially left thinking mode enabled for bounding box detection, assuming more reasoning = better results. The opposite was true. With thinking enabled, the model would "overthink" element locations and return less accurate coordinates. Setting `thinkingBudget: 0` immediately improved spatial accuracy - a counter-intuitive but well-documented behavior for visual perception tasks.

### 4. Bounding Box Coordinate Calibration

Gemini returns coordinates in a 0-1000 normalized scale, but the accuracy depends on input image resolution. Google recommends resizing images to max 640px for optimal bounding box detection. We had to implement careful scaling:

$$\text{scale} = \min\left(\frac{640}{W_{\text{original}}}, \frac{640}{H_{\text{original}}}, 1\right)$$

And then map the 0-1000 coordinates back to original pixel space for the overlay.

### 5. Cache TTL Management

Context caches expire after their TTL (we use 5 minutes). A complex analysis can run for 8+ minutes across 50 iterations. We implemented periodic TTL refresh every 20 iterations and hit edge cases where the cache would expire mid-iteration, causing cryptic errors. The retry logic with exponential backoff in `agentLoop.ts` handles this, but it took multiple production failures to get right.

### 6. Convex Action Timeouts

Convex actions have a 10-minute execution limit. The ReAct agent loop needs safety mechanisms to save progress before timeout. We implemented a `maxRunTimeMs` of 8.5 minutes (leaving 1.5 minutes buffer for cleanup), plus user-initiated pause/resume with full session persistence.

### 7. Snake_case to camelCase at Scale

Gemini's JSON output uses `snake_case` (matching the prompt), but the TypeScript codebase and Convex database use `camelCase`. We wrote a comprehensive `convertToCamelCase()` transformation in `convex/types.ts` that recursively converts all keys across nested objects, arrays, and the 20+ data types in the schema. Getting this right for every edge case (especially arrays of objects inside optional fields) took considerable effort.

## Accomplishments that we're proud of

### The ReAct Agent Actually Works

Building an autonomous agent that watches a video and incrementally constructs a structured document through tool calls - the same architectural pattern as Gemini CLI - felt like science fiction a year ago. Today it runs in production, with real-time event streaming to a web UI, pause/resume, and cost tracking. Watching the Agent Panel as Gemini reasons through a video frame by frame, calls `write_pdd` to add steps, then `read_pdd` to verify its own work - it genuinely feels like watching an AI analyst at work.

### Six Gemini Features in One Pipeline

We're not using one Gemini capability - we're using **six** in a coordinated pipeline:
1. **Video Understanding** sees the actions
2. **Structured Output** ensures valid data
3. **Context Caching** makes it economically viable
4. **Function Calling** enables incremental document building
5. **Spatial Understanding** locates UI elements in screenshots
6. **Thinking Mode Control** optimizes each task type

Each feature is essential. Remove any one and the system fundamentally breaks.

### Production-Grade Cost Optimization

Context caching reduces video token costs by 75%. For a typical analysis:
- Without caching: **~$1.50** in input tokens
- With caching: **~$0.35** total (including cache storage)

At scale, this is the difference between "interesting demo" and "viable product."

### Comprehensive Data Model

37 UI element types. 34 specific actions. 9 screen regions. 8 flowchart node types. 13 data types. 6 action categories. Sensitivity flags, variable standardization, wait conditions, automation hints. The schema captures everything needed to understand a process - not just what happened, but *how to reproduce it*, whether by a human following instructions, an AI agent operating software, or an automation script.

### Real-Time Agent Observability

The Agent Panel streams every event (state changes, thinking text, tool calls, tool results, progress, token usage, cost) to the frontend via Convex's reactive queries. No polling. The UI updates the instant the agent acts. Users can watch the document being built in real-time and pause if they see the agent going off-track.

## What we learned

1. **Structured Output is transformative.** The single biggest quality improvement came not from better prompts but from enforcing a JSON Schema on the output. It eliminates an entire class of parsing bugs and makes the AI output directly consumable by downstream systems - whether those systems are dashboards, automation platforms, or other AI agents.

2. **Agents > single-pass for complex tasks.** The ReAct loop consistently produces better documents than single-pass generation. The ability to self-review (via `read_pdd`) and iterate means the agent catches its own mistakes. The architecture mirrors Gemini CLI for a reason - it works.

3. **Thinking mode is not always better.** For spatial understanding (bounding boxes), disabling thinking (`thinkingBudget: 0`) improves accuracy. For logical reasoning (process analysis), thinking helps. Knowing when to use each mode is a production-level insight that isn't obvious from the documentation.

4. **Context caching changes the economics fundamentally.** Without caching, the ReAct agent would be 4x more expensive and impractical for routine use. Caching makes iterative AI workflows viable by amortizing the cost of large inputs.

5. **Convex + Gemini is a powerful combination.** Convex's real-time subscriptions mean the agent's progress is instantly visible in the UI. Its serverless actions handle the long-running analysis without infrastructure management. The type-safe validators mirror the JSON Schema, creating end-to-end type safety from AI output to database to React component.

6. **The prompt is the product.** We went through multiple prompt versions (V1, V2, database-driven custom prompts) and each iteration dramatically changed output quality. The system prompt's rules about step descriptions starting with "User" or "System", timestamp formatting, variable standardization with `{{VariableName}}`, and sensitive data masking - these rules *are* the product's intelligence. They encode deep domain knowledge about what makes process documentation actually useful for the people and systems that consume it.

## What's next for Event Horizon - AI Process Analysts

### Near-Term (Q1-Q2 2026)

- **Chat Interface** - Conversational interaction with the agent: "Add a step between 3 and 4 where the user validates the email format" or "What happens if the login fails?"
- **Structured Export Formats** - Direct export to workflow definition formats (BPMN 2.0, UiPath `.xaml`, Automation Anywhere `.bot`) so the documentation flows directly into execution platforms
- **Multi-Language** - PDD generation in Polish, Spanish, German, and Japanese (the prompt handles this naturally with Gemini's multilingual capabilities)
- **Chrome Extension** - Record processes directly in the browser with one click, upload automatically

### Medium-Term (Q3-Q4 2026)

- **Process Comparison** - Diff two PDDs to identify changes between process versions. Useful for compliance auditing, process optimization, and tracking how workflows evolve over time.
- **AI Agent Handoff** - Generate structured task definitions that AI agents (like those built with LangChain, CrewAI, or Gemini Function Calling) can execute autonomously. The PDD already contains everything an agent needs: UI element selectors, data flow, decision logic, and exception paths.
- **Optimization Suggestions** - "Steps 5-8 could be replaced with a single API call" or "This decision point has a 95% success rate - consider simplifying the exception handling."
- **Team Collaboration** - Multi-user review, approval workflows, and role-based access for enterprise teams.

### Long-Term Vision

Event Horizon AI is not just a documentation tool - it's the foundation for **AI-driven process intelligence**. The same video understanding that documents processes can:

- **Discover digitalization opportunities** by watching how people actually work and identifying repetitive patterns
- **Monitor process compliance** by comparing actual execution to documented procedures
- **Generate test cases** from process flows (every decision path = a test scenario)
- **Train new employees** with AI-generated step-by-step guides from expert recordings
- **Feed AI agents** with structured, machine-readable process definitions that turn human workflows into autonomous operations

The goal: make the AI Process Analyst the standard first step for every digitalization initiative - replacing weeks of manual discovery with minutes of intelligent video analysis, and producing documentation that both humans and AI agents can act on.
