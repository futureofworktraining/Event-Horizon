# AI Video Analysis Experimentation Lab (AVAEL) - Specification & Plan

## 1. Overview
**AVAEL** is a local-first environment designed to rapidly prototype, test, and refine AI workflows for converting screen recordings into Process Design Documents (PDD). It decouples the analysis logic from the production Convex backend, allowing for cost-effective experimentation with Google Gemini Context Caching, prompt chaining, and subprocess handling.

## 2. Architecture

### 2.1 Tech Stack
-   **Framework:** Next.js 16 (Existing) - utilizing Server Actions for local filesystem access.
-   **Database:** `lowdb` (Local JSON DB) - stores workflow configurations, run history, and analysis results locally.
-   **UI:** Tailwind CSS + shadcn/ui (Existing).
-   **Visual Editor:** `@xyflow/react` (React Flow) - used for designing the *analysis logic* (not just viewing results).
-   **AI Engine:** `@google/generative-ai` with explicit Context Caching management.

### 2.2 Directory Structure
New isolated modules will be created to avoid conflicting with the production `convex/` folder.

```text
src/
  app/
    lab/                 # New route for the experimental tool
      page.tsx           # Dashboard
      editor/page.tsx    # Workflow Editor
      runs/[id]/page.tsx # Results Viewer
  lib/
    lab/
      db.ts              # LowDB singleton instance
      gemini-cache.ts    # CacheManager wrappers
      workflow-engine.ts # Logic to execute the node graph
      fs-utils.ts        # Video file discovery
  data/                  # Local storage (gitignored)
    db.json              # The JSON database
    videos/              # Folder for test videos
```

## 3. Core Features

### 3.1 Local Video & Cache Management
Instead of uploading to Convex, the app reads from a local `data/videos` directory.
-   **Feature:** List local `.mp4` / `.webm` files.
-   **Feature:** "Cache Video" toggle. When enabled, the application creates a `CachedContent` object via the Gemini API with a TTL (e.g., 60 minutes).
-   **Benefit:** Subsequent prompt iterations on the same video have 0 video token cost and significantly lower latency.

### 3.2 Visual Workflow Editor
A node-based editor to define *how* the video is analyzed. This addresses the "unpredictable" nature of single-prompt analysis.

**Node Types:**
1.  **Input Node:** Selects the local video.
2.  **LLM Node:**
    *   *Model Selection:* (Gemini 2.5 Flash, Pro, etc.)
    *   *System Instruction:* Editable text area.
    *   *Schema Definition:* JSON Schema for the expected output.
    *   *Temperature:* Slider.
3.  **Splitter Node:** (Experimental) Logic to split video based on timestamps returned by a previous node (e.g., "Find start/end of subprocess X").
4.  **Merger Node:** Combines JSON outputs from multiple steps.

### 3.3 Execution Engine
A server-side engine that traverses the Workflow Graph.
-   It handles file uploading (to Google File API).
-   It manages the conversation history/state between nodes.
-   It saves the final JSON output to `lowdb`.

### 3.4 Results Viewer (Refactored)
We will create "Dumb Components" for the visualization that accept raw JSON data instead of Convex Query results.
-   **Wrapper:** `LocalFlowchartViewer` -> adapts local JSON -> renders existing `FlowchartViewer`.
-   **Wrapper:** `LocalStepsList` -> adapts local JSON -> renders existing `StepsList`.

---

## 4. Data Models (LowDB Schema)

```typescript
type LocalSchema = {
  workflows: Workflow[];
  runs: Run[];
  settings: {
    videoDir: string;
    googleApiKey: string;
  };
};

type Workflow = {
  id: string;
  name: string;
  nodes: Node[]; // React Flow nodes (storing prompts/config)
  edges: Edge[];
  createdAt: string;
};

type Run = {
  id: string;
  workflowId: string;
  videoPath: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result: PDDResult; // The standard PDD JSON structure
  cachedContentName?: string; // If Gemini caching was used
  logs: string[]; // Execution logs for debugging
  createdAt: string;
};
```

---

## 5. Implementation Plan & Code Snippets

### 5.1 Setting up LowDB (`src/lib/lab/db.ts`)
We need a simple adapter to read/write JSON files locally.

```typescript
import { JSONFilePreset } from 'lowdb/node';

// Define schema interfaces...

const defaultData: LocalSchema = { workflows: [], runs: [], settings: { videoDir: './data/videos', googleApiKey: '' } };

export const getDb = async () => {
  const db = await JSONFilePreset<LocalSchema>('data/db.json', defaultData);
  return db;
};
```

### 5.2 Gemini Cache Manager (`src/lib/lab/gemini-cache.ts`)
This allows reuse of video context.

```typescript
import { GoogleGenerativeAI, GoogleAIFileManager } from "@google/generative-ai";
import { FileState } from "@google/generative-ai/server";

export async function ensureVideoCached(filePath: string, apiKey: string) {
  const fileManager = new GoogleAIFileManager(apiKey);
  
  // 1. Check if file is already uploaded to Google (naive check, or store mappings in DB)
  // 2. Upload if needed
  const uploadResult = await fileManager.uploadFile(filePath, { mimeType: "video/mp4" });
  
  // Wait for processing...
  
  // 3. Create Cache
  const cacheManager = new GoogleGenerativeAI(apiKey).getCachedContentManager();
  const cache = await cacheManager.create({
    model: "models/gemini-1.5-flash-002", // or 2.5
    displayName: `cache-${Date.now()}`,
    contents: [
      {
        role: "user",
        parts: [{ fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } }],
      },
    ],
    ttlSeconds: 3600,
  });
  
  return cache.name;
}
```

### 5.3 Adapting UI Components (`src/components/lab/LocalResultViewer.tsx`)
Refactoring existing viewers to accept props.

```tsx
// Current StepDetail often uses useQuery. We need to split it:
// 1. Container (fetches data)
// 2. Presentation (renders data)

// In the Lab:
export function LocalResultViewer({ data }: { data: ProcessData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="h-[600px] border">
        {/* Pass raw nodes/edges instead of having component fetch them */}
        <FlowchartViewer initialNodes={data.flow.nodes} initialEdges={data.flow.edges} /> 
      </div>
      <div className="h-[600px] overflow-y-auto">
        <StepsList steps={data.steps} />
      </div>
    </div>
  )
}
```

## 6. Development Phases

1.  **Scaffolding:**
    *   Install `lowdb`.
    *   Create `src/app/lab` routes.
    *   Create `src/lib/lab` utilities.
2.  **Media & Caching:**
    *   Implement Server Action to list files in `C:\Projekty\AiBA\video-to-pdd\data\videos` (or user defined).
    *   Implement "Cache" button using Gemini `cacheManager`.
3.  **Workflow Editor:**
    *   Setup React Flow in `src/app/lab/editor`.
    *   Create a "Prompt Node" custom component.
4.  **Execution:**
    *   Build the `runAnalysis(workflowId, videoPath)` Server Action.
    *   Implement the prompt injection logic using the cached content.
5.  **Visualization:**
    *   Refactor `FlowchartViewer` to optionally accept `nodes` and `edges` as direct props (if it doesn't already).

## 7. Addressing the "Subprocess" Issue
The "Unpredictable" nature usually stems from the model getting overwhelmed by a long video.

**Proposed Workflow Strategy for Testing:**
1.  **Pass 1 (Segmentation):**
    *   *Prompt:* "Analyze this video. Identify distinct high-level phases or subprocesses. Return a list of start/end timestamps and names."
    *   *Output:* JSON List of intervals.
2.  **Pass 2 (Detailing):**
    *   *Logic:* Loop through the list from Pass 1.
    *   *Prompt:* "Focus ONLY on the interval {start} to {end}. Describe the steps in detail for subprocess '{name}'."
3.  **Pass 3 (Synthesis):**
    *   *Logic:* Merge the JSONs into the main PDD structure.

This application structure supports exactly this kind of multi-pass iteration.
