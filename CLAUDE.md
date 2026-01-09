# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Video to PDD** - A web application that transforms screen recordings into Process Design Documents (PDD) for RPA automation. It uses AI (Google Gemini 2.5 Flash) to analyze videos and extract structured, step-by-step documentation with flowchart visualization and bounding box detection.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Convex (database, file storage, serverless functions)
- **AI**: Google Gemini 2.5 Flash via `@google/generative-ai` (video analysis)
- **Visualization**: React Flow (`@xyflow/react`) for interactive flowcharts
- **Video Processing**: FFmpeg (via fluent-ffmpeg) for screenshot extraction
- **Image Processing**: Sharp and Jimp for bounding box overlays
- **Graph Layout**: Dagre for automatic flowchart layout

## Common Commands

```bash
# Development (runs both Convex and Next.js in parallel)
cd video-to-pdd
npm run dev

# Run only frontend
npm run dev:frontend

# Run only Convex backend
npm run dev:backend

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Deploy Convex to cloud
npx convex deploy

# View Convex dashboard (data browser, logs, environment variables)
npx convex dashboard
```

## Architecture

### Data Flow

1. **Video Upload** → Stored in Convex file storage, job created with `pending` status
2. **Job Processing** → Status transitions: pending → processing → completed/failed
3. **Gemini Analysis** → Video uploaded to Gemini File API via `convex/analyze.ts` action, returns structured PDD JSON
4. **Data Storage** → Results split into:
   - `processes` table: metadata (name, description, applications, duration, hierarchy)
   - `steps` table: individual actions with timestamps, UI elements, data info, screenshots
   - `processFlows` table: flowchart nodes and edges for visualization
5. **Screenshot Extraction** →
   - Server-side: FFmpeg (local dev) via `convex/analyze.ts`
   - Client-side fallback: `ScreenshotExtractor` component for Convex Cloud
6. **Bounding Box Detection** → Optional AI detection via `convex/boundingBoxes.ts`, generates overlay images
7. **Flowchart Generation** → Automatically generated from steps or manually edited via `FlowchartViewer`

### Database Schema (Convex)

Four main tables in `convex/schema.ts`:

**jobs** - Tracks video upload and analysis status
- Status progression: pending → processing → completed/failed
- Links to processes table via `processId`
- Stores raw Gemini response and progress metrics

**processes** - PDD metadata and process hierarchy
- Top-level process from video or subprocess (via `parentProcessId`)
- Hierarchy depth support (1-5 levels) for nested processes
- Video timestamp ranges for subprocess boundaries
- Metadata: nodeCount, decisionCount, subprocessCount (for visualization)

**steps** - Individual process actions (one per user/system action)
- Linked to process via `processId`, ordered by `stepNumber`
- Complete action details: type, specific action, description, timestamp
- UI element info: type (37 types), location in 9-zone screen grid, identifiers (id, class, xpath, accessibility)
- Data info: type (text, number, date, etc.), source, sensitivity flag for masking
- Wait conditions: type, timeout, retry count
- Screenshot storage ID and optional bounding box detection data
- Links to flowchart node via `flowNodeId`

**processFlows** - Flowchart structure for visual process representation
- Nodes: start, end, action, decision, switch, merge, subprocess, loop_back
- Edges: connect nodes with flow type (normal, exception, timeout, loop)
- Supports conditions on edges for decision points
- Auto-layout via Dagre, optional manual positioning

### Convex Functions Organization

**Video Analysis & Job Management** (`convex/jobs.ts`, `convex/analyze.ts`)
- `uploadVideo` mutation: Creates job and stores video file
- `startVideoAnalysis` action: Orchestrates Gemini analysis, screenshot extraction, flow generation
- Job queries for listing and status tracking

**Process & Steps Data** (`convex/processes.ts`, `convex/steps.ts`)
- `getProcess`, `getProcessesForJob`: Query process metadata
- `getStepsForProcess`: Get all steps for a process (with screenshot URLs)
- `getProcessWithFlow`: Complete data for flowchart viewer (process + steps + flow)
- `addStep`, `updateStep`, `deleteStep`: Manual step editing

**Flowchart Management** (`convex/flows.ts`)
- `getProcessFlow`: Query flowchart structure
- `saveProcessFlow`: Update flowchart (nodes/edges) after manual editing
- `generateFlowFromSteps`: Auto-generate flowchart from step sequence

**Bounding Box Detection** (`convex/boundingBoxes.ts`, `convex/boundingBoxOverlay.ts`, `convex/boundingBoxQueries.ts`)
- `detectBoundingBoxes`: AI-powered UI element detection in screenshots
- `generateOverlayImage`: Draw bounding box overlays on screenshots
- `getBoundingBoxData`: Query detection results

**Internal Utilities** (`convex/internal.ts`, `convex/stepsActions.ts`)
- Internal mutations called by actions (can't be called from client)
- Batch operations, data transformations, migrations

**Prompts & Types** (`convex/prompts.ts`, `convex/types.ts`)
- `SYSTEM_PROMPT_V2`, `USER_PROMPT_V2`, `JSON_SCHEMA_V2`: Gemini prompts with comprehensive PDD structure
- TypeScript interfaces matching Gemini response schema
- Validators for all data types (application, UI element, action, wait condition, etc.)
- Type conversion: snake_case (Gemini) → camelCase (database)

### Frontend Structure

```
src/
├── app/
│   ├── page.tsx                    # Home page with job listings
│   ├── layout.tsx                  # Root layout with Convex provider
│   ├── ConvexClientProvider.tsx    # Convex client setup
│   ├── upload/page.tsx             # Video upload interface
│   └── process/[id]/page.tsx       # Process results & viewer
├── components/
│   ├── ui/                         # shadcn/ui base components
│   │   ├── button.tsx, card.tsx, input.tsx, dialog.tsx, etc.
│   ├── pdd/                        # PDD display & editing components
│   │   ├── ProcessHeader.tsx       # Process metadata display
│   │   ├── StepsList.tsx           # List of steps with filtering
│   │   ├── StepDetail.tsx          # Expanded step with all details
│   │   ├── StepEditDialog.tsx      # In-place step editor
│   │   ├── AddStepDialog.tsx       # Add new step dialog
│   │   ├── VideoUploader.tsx       # Drag-and-drop file upload
│   │   ├── ScreenshotExtractor.tsx # Client-side screenshot extraction
│   │   ├── ScreenshotLightbox.tsx  # Screenshot viewer modal
│   │   ├── BoundingBoxDetector.tsx # Trigger AI element detection
│   │   ├── BoundingBoxOverlay.tsx  # Display bounding box overlay
│   │   ├── ExportButton.tsx        # Export PDD as JSON
│   │   ├── ProcessingStatus.tsx    # Job processing progress
│   │   ├── RawResponseViewer.tsx   # Debug view of raw Gemini response
│   │   ├── ApplicationsList.tsx    # Display applications used
│   │   ├── ActionTypeBadge.tsx     # Action type label styling
│   │   └── VideoPlayer.tsx         # Embedded video player
│   ├── flowchart/                  # Flowchart visualization
│   │   ├── FlowchartViewer.tsx     # Main flowchart component (React Flow)
│   │   ├── ProcessNavigator.tsx    # Parent/child process navigation
│   │   ├── ProcessBreadcrumbs.tsx  # Hierarchy breadcrumb navigation
│   │   ├── nodes/                  # Node type components
│   │   │   ├── StartNode.tsx, EndNode.tsx, ActionNode.tsx
│   │   │   ├── DecisionNode.tsx, SwitchNode.tsx, MergeNode.tsx
│   │   │   ├── SubprocessNode.tsx, LoopBackNode.tsx
│   │   └── edges/
│   │       └── CustomEdge.tsx      # Custom edge renderer
│   ├── Header.tsx                  # App header with navigation
│   └── JobsList.tsx                # Job history display
└── lib/
    └── utils.ts                    # Helper: cn() for Tailwind class merging
```

## Data Models & Validation

### Action Types & Specific Actions
- **6 Action Types**: ui_interaction, navigation, data_transfer, explanation, wait, validation
- **34 Specific Actions**: click, type, navigate_to_url, read, download, wait_for_page, verify_element, etc.

### UI Element Types (37 total)
button, link, text_field, text_area, dropdown, combobox, checkbox, radio_button, toggle, slider, date_picker, time_picker, file_upload, menu, menu_item, tab, table, table_row, table_cell, tree_view, tree_node, list, list_item, card, modal, dialog, tooltip, notification, icon, image, label, heading, paragraph, breadcrumb, pagination, search_field, other

### Screen Regions (9-zone grid)
top_left, top_center, top_right, middle_left, middle_center, middle_right, bottom_left, bottom_center, bottom_right, full_screen (for overlays)

### Data Types
text, number, date, datetime, currency, percentage, boolean, email, phone, url, file, password, other

### Application Types
web_application, desktop_application, mobile_application, terminal, other

## Environment Setup

### Required Configuration

1. **Convex Project** - Initialize with `npx convex dev` (creates `.env.local` automatically)
2. **Gemini API Key** - Set in Convex dashboard → Settings → Environment Variables → `GEMINI_API_KEY`
3. **.env.local** - Auto-generated, contains `NEXT_PUBLIC_CONVEX_URL` (needed for client)

### FFmpeg Setup

- **Local Development**: `@ffmpeg-installer/ffmpeg` provides binary, auto-configured in `convex/analyze.ts`
- **Convex Cloud**: FFmpeg unavailable; `ScreenshotExtractor` component provides client-side fallback

## Key Implementation Patterns

**Data Transformation**
- Gemini returns snake_case JSON; converted to camelCase via `convertToCamelCase()` in `convex/types.ts` for database storage and type safety

**Actions & Internal Mutations**
- `convex/analyze.ts` is an action (runs on server, can call APIs); orchestrates entire analysis flow
- Actions call internal mutations in `convex/internal.ts` (internal calls from server only, not from client)
- This pattern avoids Convex's limitation that mutations can't call other mutations directly

**Flowchart Auto-Generation**
- After Gemini analysis, `convex/flows.ts` generates flowchart structure from step sequence
- Uses Dagre for layout; can be manually edited and saved back to database
- Supports decision points, loops, and subprocess references

**Bounding Box Detection**
- Separate from main analysis pipeline; triggered on-demand per step
- `convex/boundingBoxes.ts`: AI detects UI element location in screenshot
- `convex/boundingBoxOverlay.ts`: Draws visual overlay with bounding box rectangle + label
- Stored as separate screenshot image to preserve original

**Sensitive Data Masking**
- Step descriptions and data values mask passwords, PII, credit card numbers, government IDs
- UI element screenshots with sensitive data can be individually flagged for blurring

**Step Normalization**
- Description format rule: Must start with "User" or "System" (enforced by Gemini prompt)
- Timestamp format: MM:SS.s (enforced via parsing in database)
- Makes steps consistent for RPA developer consumption

## Development Workflow

When working on new features:
1. **Data Schema Changes** → Update `convex/schema.ts`, add validators, update `convex/types.ts`
2. **Backend Logic** → Add queries/mutations to appropriate `convex/*.ts` file
3. **API Changes** → Convex auto-generates TypeScript client types in `convex/_generated/api.d.ts` (restart dev server to pick up)
4. **Frontend Components** → Create in appropriate subdirectory under `src/components/`
5. **Pages** → Add new routes in `src/app/` using App Router conventions

When modifying AI analysis:
1. Update prompts/schema in `convex/prompts.ts`
2. Adjust type definitions in `convex/types.ts`
3. Update Gemini response parsing in `convex/analyze.ts`
4. Adjust data storage/retrieval in `convex/internal.ts` and `convex/processes.ts`

## Common Gotchas & Patterns

- **Convex Actions**: Use `action()` for long-running operations (video analysis, API calls), not `mutation()`
- **Internal Mutations**: Prefix with `internal` (e.g., `internalMutation`), called only from actions
- **Client Imports**: Use `useQuery()` and `useMutation()` hooks from generated Convex client
- **Type Safety**: Always define validators matching your schema for runtime type checking
- **Storage URLs**: Use `ctx.storage.getUrl()` in queries to get temporary signed URLs for file access
- **Process Hierarchy**: Check `parentProcessId` to distinguish main process from subprocesses
