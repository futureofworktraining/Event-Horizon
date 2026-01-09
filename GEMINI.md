# Project Context: Video to PDD (Process Design Document)

## Overview
**Video to PDD** is an intelligent application that transforms screen recordings into detailed Process Design Documents (PDD) using Google Gemini 2.5 Flash. It analyzes video content to identify user actions, UI elements, and business rules, generating structured documentation and flowcharts suitable for RPA (Robotic Process Automation) and process mapping.

## Technology Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Convex (Serverless Database, Functions, File Storage)
- **AI:** Google Gemini 2.5 Flash (via `@google/generative-ai`)
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Diagrams:** `@xyflow/react` (React Flow), `@dagrejs/dagre`
- **Video Processing:** `fluent-ffmpeg`

## Architecture & Data Flow
1.  **Upload:** Users upload screen recordings via the frontend (`src/app/upload/page.tsx`).
2.  **Storage:** Videos are stored in Convex File Storage.
3.  **Analysis:**
    -   A Convex Action (likely in `convex/analyze.ts`) triggers the Gemini API.
    -   Gemini analyzes the video and returns a structured JSON response conforming to the PDD schema.
4.  **Persistence:**
    -   Results are parsed and stored in the Convex database across multiple tables: `processes`, `steps`, and `processFlows`.
    -   Data types are converted from snake_case (AI output) to camelCase (DB storage) using utilities in `convex/types.ts`.
5.  **Visualization:**
    -   The frontend retrieves data via Convex Queries.
    -   `FlowchartViewer.tsx` renders the process flow.
    -   `StepDetail.tsx` and `StepsList.tsx` display detailed actions and screenshots.

## Key Directories & Files

### Backend (`convex/`)
-   **`schema.ts`**: Defines the database schema, including extensive validators for PDD structures (actions, UI elements, sensitive data).
-   **`types.ts`**: TypeScript interfaces matching the schema and AI response format. Includes helpers for snake_case/camelCase conversion.
-   **`analyze.ts`**: (Inferred) Contains the Convex Action for interacting with the Gemini API.
-   **`jobs.ts`**: Manages the video processing job queue.
-   **`processes.ts`**: Queries and mutations for process data.

### Frontend (`src/`)
-   **`app/`**: Next.js App Router structure.
    -   `upload/`: Video upload interface.
    -   `process/[id]/`: Results view for a specific process.
-   **`components/`**:
    -   `pdd/`: specialized components for displaying PDD data (e.g., `StepsList`, `BoundingBoxOverlay`, `SensitiveInfoDetector`).
    -   `flowchart/`: Components for rendering process diagrams (`FlowchartViewer`, `nodes/`, `edges/`).
    -   `ui/`: Reusable UI components (buttons, cards, inputs) from shadcn/ui.

## Data Model (Key Tables)
-   **`jobs`**: Tracks the status of video analysis (pending, processing, completed, failed).
-   **`processes`**: High-level metadata (name, description, apps used, hierarchy).
-   **`steps`**: Granular actions (click, type, wait), timestamps, and UI element details. Contains bounding box data for overlays.
-   **`processFlows`**: Nodes and edges representing the visual flowchart of the process.

## Development Workflow

### Prerequisites
-   Node.js 18+
-   Convex Account
-   Google AI API Key

### Setup & Running
1.  **Install Dependencies:** `npm install`
2.  **Initialize Convex:** `npx convex dev` (Generates `.env.local` and starts backend)
3.  **Configure Environment:**
    -   Add `GEMINI_API_KEY` in the Convex Dashboard settings.
4.  **Start Dev Server:** `npm run dev` (Runs both backend and frontend).

### Conventions
-   **Type Safety:** Strict adherence to schema validators in `convex/schema.ts` and types in `convex/types.ts`.
-   **Data Conversion:** Always use the conversion utilities in `convex/types.ts` when bridging AI output (snake_case) and DB storage (camelCase).
-   **UI Components:** Use `shadcn/ui` components from `src/components/ui` for consistency.
-   **State Management:** Convex React hooks (`useQuery`, `useMutation`) for data fetching and state.

## Important Notes
-   **Sensitive Data:** The schema supports detecting and masking sensitive info (PII) via `sensitiveInfoBoxes`.
-   **Hierarchy:** Processes can have subprocesses and hierarchical structures (`parentProcessId`).
