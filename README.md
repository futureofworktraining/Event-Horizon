# Event Horizon AI - Process Documentation from Video

Every organization runs on processes - yet most of those processes exist only in people's heads. When someone asks "how does this actually work?", the answer is usually a screen recording, a screen share, or "let me show you." The knowledge is locked inside conversations, presentations, and demonstrations that nobody has time to turn into structured documentation.

**Event Horizon AI** breaches that gap. Upload a simple "show-and-tell" video and get detailed process documentation and flowcharts in minutes, not hours or days. No complex software to install. No days of training.

## What It Does

Event Horizon AI takes a screen recording of any business process and produces a complete, structured Process Design Document (PDD) - a machine-readable blueprint that humans can review and AI agents or Robotic Process Automation robots can act on.

Upload a video. Get back:

- **Step-by-step documentation** - every user action and system response, timestamped to the exact moment in the video (`MM:SS.s`)
- **Interactive flowcharts** - auto-generated process diagrams with 8 node types (start, end, action, decision, switch, merge, subprocess, loop_back), rendered with React Flow
- **UI element identification** - for each step, the specific element interacted with: its type (37 categories), screen region (9-zone grid), and identifiers (XPath, CSS class, accessibility label)
- **Bounding box overlays** - AI-powered spatial detection that draws a box around the exact UI element in each screenshot, using Gemini's `box_2d` coordinate system (normalized 0-1000 scale)
- **Sensitive data masking** - automatic detection of passwords, PII, credit card numbers, SSNs with visual masking and `is_sensitive` flags
- **Data mapping** - what data flows through each step, its type, source, and whether it needs secure handling
- **Variable standardization** - specific business values replaced with generic `{{VariableName}}` placeholders, making documentation reusable and environment-agnostic
- **Process hierarchy** - complex processes decomposed into nested subprocesses up to 5 levels deep
- **Export** - structured JSON for automation platforms and AI agents, or DOCX/PDF for human stakeholders

In essence, it can help organizations save hundreds of hours in process discovery and documentation.

## How It Works

Instead of asking Gemini to produce the entire document in one shot, Event Horizon AI uses an **autonomous ReAct (Reason + Act) agent loop** - the same pattern used by Gemini CLI. The ReAct agent is embedded into the tool and acts like a business analyst: it watches the video, reasons about what it sees, writes documentation incrementally, and reviews its own work. This significantly improves quality over a traditional single-pass AI workflow.

```
while (iteration < 50):
    REASON  -> Gemini analyzes the video and decides what to do next
    ACT     -> Calls read_pdd or write_pdd tools
    OBSERVE -> Tool results fed back into the conversation
    EMIT    -> Events streamed to the UI in real-time
```

### Key Gemini Features

1. **Long Context Video Understanding** - Gemini watches the entire recording and understands actions in sequence
2. **Context Caching** - the video tokens are cached so costs stay under control despite the agent querying the video multiple times (75% cost reduction)
3. **Function Calling** - two tools with full parameter schemas:
   - `read_pdd(section, process_id)` - read back the document being built
   - `write_pdd(operation, process_id, data)` - add processes, steps, flowcharts incrementally
4. **Spatial Understanding** - bounding box detection locates exact UI elements in screenshots
5. **Structured Output** - JSON Schema enforcement guarantees valid, typed responses
6. **Thinking Mode Control** - enabled for reasoning, disabled for spatial tasks where it degrades accuracy

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Convex (real-time database, file storage, serverless functions) |
| **AI** | Google Gemini 2.5 Flash via `@google/genai` |
| **Visualization** | React Flow (`@xyflow/react`) + Dagre (auto-layout) |
| **Video Processing** | FFmpeg (screenshot extraction) |
| **Image Processing** | Sharp + Jimp (bounding box overlays) |

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A Convex account (free at https://convex.dev)
- A Google AI API key (from https://aistudio.google.com/apikey)

### Installation

1. **Install dependencies**:
   ```bash
   cd video-to-pdd
   npm install
   ```

2. **Initialize Convex**:
   ```bash
   npx convex dev
   ```
   This will create a Convex project (first time only), generate `.env.local` with your `NEXT_PUBLIC_CONVEX_URL`, and start the Convex development server.

3. **Configure Gemini API Key**:
   - Go to your Convex dashboard (https://dashboard.convex.dev)
   - Select your project
   - Go to Settings > Environment Variables
   - Add `GEMINI_API_KEY` with your Google AI API key

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

### Production Deployment

```bash
npx convex deploy
npm run build
npm start
```

## Usage

1. Navigate to the Upload page
2. Drag and drop a screen recording (MP4, WebM, MOV, AVI - max 100MB)
3. Configure analysis options (screenshot extraction, bounding box detection, sensitive data masking)
4. Watch the AI agent analyze the video in real-time via the Agent Panel
5. Review the generated PDD in List View or interactive Flowchart View
6. Edit steps, flowcharts, and metadata inline
7. Export as JSON, DOCX, or PDF

## Project Structure

```
video-to-pdd/
├── src/
│   ├── app/                     # Next.js pages
│   │   ├── page.tsx             # Dashboard with stats and recent activity
│   │   ├── upload/              # Video upload with analysis options
│   │   └── process/[id]/        # Process viewer (list + flowchart + agent panel)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── pdd/                 # PDD display & editing components
│   │   ├── flowchart/           # React Flow nodes, edges, viewer
│   │   └── Header.tsx
│   └── lib/
├── convex/
│   ├── schema.ts                # Database schema (jobs, processes, steps, flows, agents)
│   ├── analyze.ts               # Single-pass Gemini analysis action
│   ├── agentAnalyze.ts          # ReAct agent orchestrator
│   ├── agentLoop.ts             # Core ReAct loop (reason -> act -> observe)
│   ├── agentTools.ts            # read_pdd / write_pdd tool declarations & execution
│   ├── agentEvents.ts           # Real-time event streaming to UI
│   ├── agentSessions.ts         # Session lifecycle (pause/resume/stop)
│   ├── geminiApi.ts             # Gemini REST API wrapper (cache, generate, tools)
│   ├── boundingBoxes.ts         # AI-powered UI element detection
│   ├── boundingBoxOverlay.ts    # Bounding box overlay image generation
│   ├── sensitiveInfoDetection.ts # Sensitive data detection
│   ├── prompts/                 # System prompt, user prompt, JSON schema
│   ├── flows.ts                 # Flowchart generation and management
│   └── types.ts                 # Type definitions and validators
└── package.json
```

## PDD Output Schema

The generated PDD follows a comprehensive schema:

- **Process metadata**: name, description, duration, applications used, business rules, exceptions
- **Steps[]**: Array of process steps, each with:
  - `step_number`, `timestamp` (MM:SS.s), `flow_node_id`
  - `action_type`: ui_interaction, navigation, data_transfer, explanation, wait, validation
  - `specific_action`: 34 actions (click, type, navigate_to_url, select, verify_element, etc.)
  - `description`: starts with "User" or "System" for clarity
  - `ui_element`: name, type (37 types), screen region (9-zone grid), identifiers (XPath, class, accessibility)
  - `data_info`: value, type, source, `is_sensitive` flag
  - `wait_condition`: type, timeout, retry count
  - `automation_hint`: tips for implementation
- **Flow**: nodes (8 types) + edges (with conditions and labels) for flowchart visualization

## What's Next

Event Horizon AI is the foundation for **AI-driven process intelligence**:

- **Chat Interface** - conversational editing: "Add a validation step before submission"
- **Structured Export Formats** - BPMN 2.0, UiPath, Automation Anywhere native formats
- **Process Comparison** - diff two PDDs to track how workflows evolve
- **AI Agent Handoff** - generate task definitions that AI agents can execute autonomously
- **Multi-Language** - PDD generation in any language via Gemini's multilingual capabilities
- **Optimization Suggestions** - AI-powered recommendations to simplify processes

The goal: make the AI Process Analyst the standard first step for every digitalization initiative - replacing weeks of manual discovery with minutes of intelligent video analysis.

## License

Apache 2.0
