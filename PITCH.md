# Event Horizon AI

### Turn Screen Recordings into Automation-Ready Process Documentation in Minutes

---

## The Problem

Every RPA (Robotic Process Automation) project starts the same way: a business analyst sits with a subject-matter expert, watches them perform a process on screen, and manually writes a **Process Design Document (PDD)**. This document describes every click, every field, every decision point -- step by step.

This manual documentation phase is:

- **Painfully slow** -- a 5-minute screen recording can take 2-4 hours to document properly
- **Error-prone** -- analysts miss steps, misidentify UI elements, or forget branching logic
- **Expensive** -- skilled business analysts cost $80-150/hour; documentation is their least valuable task
- **A bottleneck** -- RPA developers can't start building until the PDD is finished

The result? **60-70% of RPA project time is spent on process discovery and documentation**, not on building the actual automation.

---

## The Solution

**Event Horizon AI** eliminates the documentation bottleneck entirely.

Upload a screen recording. Get a complete, structured, editable Process Design Document -- with interactive flowcharts, annotated screenshots, and automation-ready metadata -- in **under 5 minutes**.

### How It Works

```
[Screen Recording]  -->  [AI Video Analysis]  -->  [Structured PDD]
     Upload               Gemini 2.5 Flash          Steps + Flowchart
     (30 sec)             (2-5 min)                 + Screenshots
                                                    + UI Elements
                                                    + Data Mapping
```

**Step 1: Upload**
Drag and drop any screen recording (MP4, WebM, MOV, AVI). Configure analysis options -- screenshot extraction, UI element detection, sensitive data masking.

**Step 2: AI Analysis**
Google Gemini 2.5 Flash watches the entire video and extracts a structured process document. Watch the AI reason through the video in real-time via the Agent Panel.

**Step 3: Review & Edit**
Browse results in List View or interactive Flowchart View. Every step includes timestamps, UI element details, data mappings, and annotated screenshots. Edit anything inline.

**Step 4: Export**
Download as JSON (for RPA tools), DOCX (for stakeholders), or PDF (for sign-off). Ready for UiPath, Blue Prism, Automation Anywhere, or any RPA platform.

---

## What the AI Extracts

For every step in the process, Event Horizon AI identifies:

| Category | Details |
|---|---|
| **Action** | What happened (click, type, navigate, read, download, verify...) |
| **UI Element** | Button, text field, dropdown, checkbox, table cell... (37 types) |
| **Element Location** | 9-zone screen grid + identifiers (ID, class, XPath, accessibility label) |
| **Data** | What data was entered/read, its type, source, and sensitivity |
| **Timing** | Exact video timestamp (MM:SS.s) for each action |
| **Screenshots** | Auto-extracted frames with bounding boxes around the target element |
| **Wait Conditions** | Page loads, element visibility, timeouts, retry logic |
| **Decision Points** | If/then branching with conditions and outcomes |
| **Subprocesses** | Nested processes up to 5 levels deep |

Beyond individual steps, the AI also extracts:

- **Process metadata** -- name, description, duration, applications used
- **Business rules** -- extracted logic governing the process
- **Exception scenarios** -- what happens when things go wrong
- **Flowchart structure** -- complete graph with nodes, edges, and decision paths

---

## Key Features

### Interactive Flowchart Visualization

Processes are rendered as interactive, zoomable flowcharts using React Flow. Eight node types cover the full range of process patterns:

- **Start / End** nodes with success, failure, and exception outcomes
- **Action** nodes linked to specific steps with screenshot previews
- **Decision** nodes for binary yes/no branching
- **Switch** nodes for multi-way routing
- **Subprocess** nodes for nested process hierarchies
- **Loop Back** nodes for retry and iteration patterns

Click any node to see the full step details, screenshot, and UI element information.

### AI-Powered UI Element Detection

Beyond step identification, the AI locates the exact UI element in each screenshot:

- Draws bounding boxes around buttons, fields, dropdowns, and other controls
- Labels each element with its type and identifier
- Provides XPath, CSS selectors, and accessibility labels for automation
- Maps elements to a 9-zone screen grid for spatial context

### Sensitive Data Masking

Automatically detects and flags sensitive information in screenshots and step descriptions:

- Passwords and credentials
- Social Security numbers and government IDs
- Credit card numbers
- Email addresses and phone numbers
- Employee IDs and PII

Sensitive regions are visually masked and flagged for the RPA developer to handle with secure credential storage.

### Process Hierarchy

Complex processes are broken into manageable pieces:

- Main process with nested subprocesses (up to 5 levels)
- Color-coded subprocess nodes for visual distinction
- Breadcrumb navigation between hierarchy levels
- Each subprocess gets its own flowchart and step list

### Full Editing Capabilities

AI output is a starting point, not a final document:

- Add, edit, reorder, or delete any step
- Modify process metadata and business rules
- Adjust flowchart layout manually
- Re-analyze with different prompts for better results
- Version history to compare and restore previous analyses

### Real-Time Analysis Monitoring

Watch the AI work through the Agent Panel:

- Live activity feed showing AI reasoning steps
- Token usage and cost tracking
- Progress bar with phase indicators
- Pause and resume analysis

---

## Use Cases

### RPA Development Teams
Upload recordings of business processes. Get PDDs that RPA developers can immediately start building from. Cut process discovery time by 90%.

### Business Process Outsourcing (BPO)
Document client processes at scale. One analyst can now handle the documentation workload of an entire team.

### Enterprise IT & Digital Transformation
Map existing processes as the first step toward automation. Identify bottlenecks, redundancies, and optimization opportunities.

### Process Compliance & Audit
Create verifiable, timestamped documentation of how processes are actually performed -- not how they're supposed to be performed.

### Training & Onboarding
Turn expert workflows into step-by-step guides with screenshots that new team members can follow immediately.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **AI Engine** | Google Gemini 2.5 Flash with structured JSON output |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **Backend** | Convex (real-time serverless database + functions) |
| **Visualization** | React Flow + Dagre auto-layout |
| **Video Processing** | FFmpeg for screenshot extraction |
| **Image Processing** | Sharp + Jimp for bounding box overlays |
| **UI Components** | shadcn/ui + Radix UI primitives |

### Architecture Highlights

- **Real-time updates** -- Convex subscriptions push analysis progress to the UI instantly
- **Structured AI output** -- JSON Schema enforcement ensures consistent, parseable results
- **Context caching** -- Gemini context caching reduces AI costs by up to 75% on re-analysis
- **Type safety** -- Full TypeScript coverage from database validators to React components
- **Client-side fallback** -- Browser-based screenshot extraction when server-side FFmpeg is unavailable

---

## Impact

| Metric | Manual Process | With Event Horizon AI |
|---|---|---|
| **Documentation time** | 2-4 hours per process | 15-30 minutes |
| **Steps captured** | Often incomplete | Comprehensive |
| **UI element detail** | Basic descriptions | XPath, selectors, accessibility labels |
| **Flowchart creation** | Separate Visio/draw.io work | Auto-generated |
| **Screenshot annotation** | Manual cropping & markup | AI-powered bounding boxes |
| **Sensitive data handling** | Easy to miss | Auto-detected and flagged |
| **Consistency** | Varies by analyst | Standardized format every time |

**Bottom line: What used to take a skilled analyst half a day now takes a screen recording and 5 minutes.**

---

## Roadmap

- **RPA Tool Integration** -- Direct export to UiPath, Blue Prism, Automation Anywhere formats
- **Automation Script Generation** -- Go from PDD to working bot code
- **Multi-Language Support** -- Process documentation in any language
- **Collaborative Editing** -- Team-based review and approval workflows
- **Process Comparison** -- Diff two versions of a process to identify changes
- **AI Optimization Suggestions** -- Identify redundant steps and suggest process improvements
- **Chrome Extension** -- Record processes directly in the browser

---

## Try It

```bash
git clone <repo-url>
cd video-to-pdd
npm install
npm run dev
```

Set your `GEMINI_API_KEY` in the Convex dashboard, upload a screen recording, and watch the AI turn it into a complete Process Design Document.

---

*Built with Next.js 16, Convex, Google Gemini 2.5 Flash, React Flow, and a vision for eliminating the most tedious part of RPA development.*
