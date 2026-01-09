# Experimental Video Analysis Workflow Testing Application

## Overview

A lightweight, local-first application for experimenting with AI-driven video analysis workflows. This tool enables rapid iteration on prompts, models, and analysis pipelines without the overhead of cloud infrastructure.

**Primary Goals:**
- Test different AI models and prompts for video analysis
- Experiment with subprocess detection strategies
- Reduce costs through Gemini video caching
- Provide visual workflow editing for analysis pipelines
- Keep simple: flowchart view, list view with screenshots

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Workflow Editor│  Results Viewer │     Video Browser           │
│  (React Flow)   │  (List+Flow)    │     (Local Files)           │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Workflow Engine │ Video Analysis  │    Screenshot Extraction    │
│ (Execute Nodes) │ (Gemini API)    │    (FFmpeg)                 │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Local Storage                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│    LowDB        │  Video Folder   │    Screenshots Folder       │
│  (workflows,    │  (./videos/)    │    (./output/screenshots/)  │
│   results,      │                 │                             │
│   cache refs)   │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | Next.js 14 (App Router) | Reuse existing flowchart components |
| UI | React Flow, Tailwind, shadcn/ui | Visual workflow editing |
| Local DB | LowDB (JSON file) | Simple, no setup, human-readable |
| AI | Google Gemini 2.5 Flash/Pro | Video understanding, caching support |
| Screenshots | FFmpeg (fluent-ffmpeg) | Local video frame extraction |
| State | Zustand | Lightweight client state management |

---

## Core Features

### 1. Visual Workflow Editor

A node-based editor for building AI analysis pipelines:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Video Input  │────▶│ AI Analysis  │────▶│  Parse JSON  │
│   (Source)   │     │   (Gemini)   │     │   (Output)   │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Subprocess  │
                     │  Detection   │
                     └──────────────┘
```

**Node Types:**

| Node Type | Purpose | Configuration |
|-----------|---------|---------------|
| `video-input` | Select video from local folder | Video path, name |
| `gemini-analysis` | Send video to Gemini | Model, system prompt, user prompt, JSON schema, temperature |
| `prompt-template` | Reusable prompt blocks | Variables, template text |
| `json-parser` | Parse/transform AI response | JSONPath, mapping rules |
| `subprocess-detector` | Specialized subprocess analysis | Detection strategy, thresholds |
| `screenshot-extractor` | Extract frames at timestamps | FFmpeg settings |
| `result-output` | Store analysis results | Output format |
| `conditional` | Branch based on conditions | Condition expression |
| `loop` | Iterate over items | Iterator source |

### 2. Gemini Video Caching

Reduce costs by caching uploaded videos:

```typescript
// Cache management strategy
interface VideoCache {
  videoPath: string;           // Local file path
  videoHash: string;           // MD5/SHA256 for change detection
  geminiFileUri: string;       // Gemini File API URI
  geminiFileName: string;      // Gemini file name
  cachedAt: number;            // Unix timestamp
  expiresAt: number;           // Gemini cache expiration (48h default)
  status: 'uploading' | 'ready' | 'expired';
}
```

**Caching Flow:**
1. Hash local video file (fast change detection)
2. Check LowDB for existing cache entry
3. If cached and not expired → use `geminiFileUri` directly
4. If expired or missing → upload to Gemini, store new cache entry
5. Gemini File API caches for 48 hours by default

### 3. Results Viewer

Reuse existing components with adaptations:

- **Flowchart View**: React Flow visualization of detected process
- **List View**: Steps with timestamps, screenshots, action details
- **Comparison Mode**: Side-by-side results from different workflows

### 4. Video Browser

Simple file browser for local videos folder:

```typescript
// Video file metadata
interface VideoFile {
  name: string;
  path: string;
  size: number;
  duration?: number;  // Extracted via FFprobe
  thumbnail?: string; // Generated thumbnail path
  lastAnalyzed?: number;
}
```

---

## Data Models (LowDB Schema)

```typescript
// db.json structure
interface Database {
  // Workflow definitions (the analysis pipelines)
  workflows: Workflow[];

  // Analysis run results
  runs: AnalysisRun[];

  // Video cache entries
  videoCache: VideoCache[];

  // Prompt templates library
  prompts: PromptTemplate[];

  // Settings
  settings: AppSettings;
}

// Workflow definition
interface Workflow {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;

  // React Flow structure
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // Default configuration
  defaultVideoPath?: string;
}

// Workflow node
interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;  // Type-specific configuration
}

// Analysis run (execution result)
interface AnalysisRun {
  id: string;
  workflowId: string;
  videoPath: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';

  // Execution trace
  nodeResults: Record<string, NodeResult>;

  // Final output (if successful)
  result?: AnalysisResult;

  // Error info (if failed)
  error?: string;

  // Cost tracking
  tokensUsed?: number;
  cachedVideoUsed: boolean;
}

// Analysis result (process detection output)
interface AnalysisResult {
  processes: Process[];
  rawResponse: string;  // Original AI response for debugging
}

// Process (matches existing schema, simplified)
interface Process {
  id: string;
  name: string;
  description: string;
  parentProcessId?: string;
  isMainProcess: boolean;
  steps: Step[];
  flow: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
}

// Step (simplified from existing)
interface Step {
  stepNumber: number;
  timestamp: string;
  timestampSeconds: number;
  description: string;
  actionType: string;
  specificAction: string;
  uiElement?: {
    name: string;
    type: string;
    location: string;
  };
  screenshotPath?: string;
  flowNodeId: string;
}

// Prompt template
interface PromptTemplate {
  id: string;
  name: string;
  category: 'system' | 'user' | 'schema';
  content: string;
  variables: string[];  // e.g., ['language', 'detail_level']
  createdAt: number;
  updatedAt: number;
}

// App settings
interface AppSettings {
  videosFolder: string;
  outputFolder: string;
  geminiApiKey?: string;  // Or use env var
  defaultModel: string;
  screenshotFormat: 'png' | 'jpg';
  screenshotQuality: number;
}
```

---

## Workflow Node Specifications

### 1. Video Input Node

```typescript
interface VideoInputNodeData {
  videoPath: string;        // Relative to videos folder
  useCache: boolean;        // Use Gemini caching
}

// Output
interface VideoInputOutput {
  localPath: string;
  geminiUri?: string;       // If cached/uploaded
  duration: number;
  size: number;
}
```

### 2. Gemini Analysis Node

```typescript
interface GeminiAnalysisNodeData {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash';

  // Prompt configuration
  systemPromptId?: string;  // Reference to prompt template
  systemPromptOverride?: string;  // Or inline
  userPromptId?: string;
  userPromptOverride?: string;

  // Schema configuration
  jsonSchemaId?: string;
  jsonSchemaOverride?: string;

  // Generation settings
  temperature: number;      // 0-2
  maxTokens: number;

  // Variable substitutions
  variables: Record<string, string>;
}

// Output
interface GeminiAnalysisOutput {
  rawResponse: string;
  parsedJson: any;
  tokensUsed: number;
  model: string;
  cachedVideo: boolean;
}
```

### 3. Subprocess Detector Node

Specialized node for subprocess detection strategies:

```typescript
interface SubprocessDetectorNodeData {
  strategy: 'hierarchical' | 'temporal' | 'application-switch' | 'custom';

  // Hierarchical: detect nested flows
  hierarchicalConfig?: {
    maxDepth: number;
    minStepsForSubprocess: number;
  };

  // Temporal: detect by time gaps
  temporalConfig?: {
    gapThresholdSeconds: number;
    minDurationSeconds: number;
  };

  // Application-switch: new app = new subprocess
  applicationSwitchConfig?: {
    treatTabSwitchAsNew: boolean;
  };

  // Custom: use separate AI call
  customConfig?: {
    detectionPrompt: string;
  };
}
```

### 4. Screenshot Extractor Node

```typescript
interface ScreenshotExtractorNodeData {
  outputFolder: string;
  format: 'png' | 'jpg';
  quality: number;          // 1-100 for jpg
  naming: 'timestamp' | 'step-number' | 'custom';
  customPattern?: string;   // e.g., '{video}_{step}_{timestamp}'
}
```

---

## API Routes

### Video Management

```typescript
// GET /api/videos
// List videos in configured folder
interface VideosResponse {
  videos: VideoFile[];
  folder: string;
}

// GET /api/videos/[filename]/info
// Get video metadata (duration, resolution, etc.)
interface VideoInfoResponse {
  name: string;
  path: string;
  duration: number;
  resolution: { width: number; height: number };
  fps: number;
  size: number;
}

// GET /api/videos/[filename]/thumbnail
// Generate/return video thumbnail
// Returns: image/jpeg
```

### Workflow Management

```typescript
// GET /api/workflows
// List all workflows

// POST /api/workflows
// Create new workflow
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

// GET /api/workflows/[id]
// Get workflow by ID

// PUT /api/workflows/[id]
// Update workflow

// DELETE /api/workflows/[id]
// Delete workflow

// POST /api/workflows/[id]/duplicate
// Clone workflow for experimentation
```

### Workflow Execution

```typescript
// POST /api/workflows/[id]/run
// Execute workflow
interface RunWorkflowRequest {
  videoPath: string;
  variableOverrides?: Record<string, string>;
}

interface RunWorkflowResponse {
  runId: string;
  status: 'started';
}

// GET /api/runs/[runId]
// Get run status and results

// GET /api/runs/[runId]/stream
// SSE stream for real-time progress updates
interface RunProgressEvent {
  nodeId: string;
  status: 'started' | 'completed' | 'failed';
  output?: any;
  error?: string;
  progress?: number;
}

// POST /api/runs/[runId]/cancel
// Cancel running workflow
```

### Cache Management

```typescript
// GET /api/cache
// List cached videos

// POST /api/cache/upload
// Pre-upload video to Gemini cache
interface UploadCacheRequest {
  videoPath: string;
}

// DELETE /api/cache/[hash]
// Invalidate cache entry (local only, Gemini cache expires naturally)
```

### Prompt Templates

```typescript
// GET /api/prompts
// List all prompt templates

// POST /api/prompts
// Create prompt template

// PUT /api/prompts/[id]
// Update prompt template

// DELETE /api/prompts/[id]
// Delete prompt template
```

---

## Key Code Snippets

### LowDB Setup

```typescript
// lib/db.ts
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';

interface Database {
  workflows: Workflow[];
  runs: AnalysisRun[];
  videoCache: VideoCache[];
  prompts: PromptTemplate[];
  settings: AppSettings;
}

const defaultData: Database = {
  workflows: [],
  runs: [],
  videoCache: [],
  prompts: [],
  settings: {
    videosFolder: './videos',
    outputFolder: './output',
    defaultModel: 'gemini-2.5-flash',
    screenshotFormat: 'png',
    screenshotQuality: 90,
  },
};

const dbPath = join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile<Database>(dbPath);
export const db = new Low<Database>(adapter, defaultData);

// Initialize
export async function initDb() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}
```

### Gemini Video Caching

```typescript
// lib/gemini-cache.ts
import { GoogleGenerativeAI, FileState } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { createHash } from 'crypto';
import { createReadStream, statSync } from 'fs';
import { db } from './db';

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export async function getOrUploadVideo(videoPath: string): Promise<string> {
  // Calculate file hash for cache key
  const hash = await hashFile(videoPath);

  // Check cache
  await db.read();
  const cached = db.data!.videoCache.find(
    (c) => c.videoHash === hash && c.status === 'ready' && c.expiresAt > Date.now()
  );

  if (cached) {
    console.log(`Using cached video: ${cached.geminiFileUri}`);
    return cached.geminiFileUri;
  }

  // Upload to Gemini
  console.log(`Uploading video to Gemini: ${videoPath}`);
  const uploadResult = await fileManager.uploadFile(videoPath, {
    mimeType: 'video/mp4',
    displayName: videoPath.split('/').pop(),
  });

  // Wait for processing
  let file = uploadResult.file;
  while (file.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await fileManager.getFile(file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error(`Video processing failed: ${file.name}`);
  }

  // Cache the result
  const cacheEntry: VideoCache = {
    videoPath,
    videoHash: hash,
    geminiFileUri: file.uri,
    geminiFileName: file.name,
    cachedAt: Date.now(),
    expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
    status: 'ready',
  };

  db.data!.videoCache.push(cacheEntry);
  await db.write();

  return file.uri;
}

async function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
```

### Workflow Execution Engine

```typescript
// lib/workflow-engine.ts
import { db } from './db';
import { getOrUploadVideo } from './gemini-cache';
import { analyzeWithGemini } from './gemini-analysis';
import { extractScreenshots } from './ffmpeg';

type NodeExecutor = (node: WorkflowNode, inputs: Record<string, any>) => Promise<any>;

const nodeExecutors: Record<string, NodeExecutor> = {
  'video-input': async (node, inputs) => {
    const { videoPath, useCache } = node.data as VideoInputNodeData;
    const fullPath = join(process.cwd(), 'videos', videoPath);

    let geminiUri: string | undefined;
    if (useCache) {
      geminiUri = await getOrUploadVideo(fullPath);
    }

    return {
      localPath: fullPath,
      geminiUri,
      duration: await getVideoDuration(fullPath),
      size: statSync(fullPath).size,
    };
  },

  'gemini-analysis': async (node, inputs) => {
    const config = node.data as GeminiAnalysisNodeData;
    const videoInput = inputs['video'] as VideoInputOutput;

    // Build prompts from templates or overrides
    const systemPrompt = await resolvePrompt(config.systemPromptId, config.systemPromptOverride, config.variables);
    const userPrompt = await resolvePrompt(config.userPromptId, config.userPromptOverride, config.variables);
    const jsonSchema = await resolvePrompt(config.jsonSchemaId, config.jsonSchemaOverride, config.variables);

    return await analyzeWithGemini({
      videoUri: videoInput.geminiUri,
      videoPath: videoInput.localPath,
      model: config.model,
      systemPrompt,
      userPrompt,
      jsonSchema,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  },

  'screenshot-extractor': async (node, inputs) => {
    const config = node.data as ScreenshotExtractorNodeData;
    const analysisResult = inputs['analysis'] as GeminiAnalysisOutput;
    const videoInput = inputs['video'] as VideoInputOutput;

    // Extract timestamps from steps
    const timestamps = analysisResult.parsedJson.processes
      .flatMap((p: any) => p.steps)
      .map((s: any) => s.timestamp_seconds || parseTimestamp(s.timestamp));

    return await extractScreenshots({
      videoPath: videoInput.localPath,
      timestamps,
      outputFolder: config.outputFolder,
      format: config.format,
      quality: config.quality,
    });
  },

  'subprocess-detector': async (node, inputs) => {
    const config = node.data as SubprocessDetectorNodeData;
    const analysisResult = inputs['analysis'] as GeminiAnalysisOutput;

    switch (config.strategy) {
      case 'hierarchical':
        return detectHierarchicalSubprocesses(analysisResult.parsedJson, config.hierarchicalConfig!);
      case 'temporal':
        return detectTemporalSubprocesses(analysisResult.parsedJson, config.temporalConfig!);
      case 'application-switch':
        return detectAppSwitchSubprocesses(analysisResult.parsedJson, config.applicationSwitchConfig!);
      case 'custom':
        return await detectCustomSubprocesses(analysisResult.parsedJson, config.customConfig!);
      default:
        return analysisResult.parsedJson;
    }
  },

  'result-output': async (node, inputs) => {
    // Collect all inputs and format final result
    return {
      processes: inputs['processes'] || inputs['analysis']?.parsedJson?.processes,
      screenshots: inputs['screenshots'],
      metadata: {
        generatedAt: Date.now(),
        workflowId: node.data.workflowId,
      },
    };
  },
};

export async function executeWorkflow(
  workflow: Workflow,
  initialInputs: Record<string, any>,
  onProgress: (event: RunProgressEvent) => void
): Promise<AnalysisResult> {
  const results: Record<string, any> = {};

  // Topological sort nodes by dependencies
  const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);

  for (const node of sortedNodes) {
    onProgress({ nodeId: node.id, status: 'started' });

    try {
      // Gather inputs from connected nodes
      const nodeInputs = gatherInputs(node, workflow.edges, results);

      // Execute node
      const executor = nodeExecutors[node.type];
      if (!executor) {
        throw new Error(`Unknown node type: ${node.type}`);
      }

      const output = await executor(node, nodeInputs);
      results[node.id] = output;

      onProgress({ nodeId: node.id, status: 'completed', output });
    } catch (error) {
      onProgress({ nodeId: node.id, status: 'failed', error: String(error) });
      throw error;
    }
  }

  // Find result-output node and return its result
  const outputNode = sortedNodes.find((n) => n.type === 'result-output');
  return results[outputNode!.id];
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  // Build adjacency list and in-degree count
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach((e) => {
    adjacency.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  // Kahn's algorithm
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0);
  const sorted: WorkflowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighborId of adjacency.get(node.id)!) {
      inDegree.set(neighborId, inDegree.get(neighborId)! - 1);
      if (inDegree.get(neighborId) === 0) {
        queue.push(nodes.find((n) => n.id === neighborId)!);
      }
    }
  }

  return sorted;
}

function gatherInputs(
  node: WorkflowNode,
  edges: WorkflowEdge[],
  results: Record<string, any>
): Record<string, any> {
  const inputs: Record<string, any> = {};

  edges
    .filter((e) => e.target === node.id)
    .forEach((e) => {
      const handle = e.targetHandle || 'default';
      inputs[handle] = results[e.source];
    });

  return inputs;
}
```

### Gemini Analysis Function

```typescript
// lib/gemini-analysis.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface AnalyzeOptions {
  videoUri?: string;
  videoPath?: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: string;
  temperature: number;
  maxTokens: number;
}

export async function analyzeWithGemini(options: AnalyzeOptions) {
  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: options.systemPrompt,
    generationConfig: {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      responseMimeType: 'application/json',
      responseSchema: JSON.parse(options.jsonSchema),
    },
  });

  // Build content parts
  const parts: any[] = [];

  if (options.videoUri) {
    // Use cached video URI
    parts.push({
      fileData: {
        mimeType: 'video/mp4',
        fileUri: options.videoUri,
      },
    });
  } else {
    // Upload video inline (not recommended for large files)
    const videoData = readFileSync(options.videoPath!);
    parts.push({
      inlineData: {
        mimeType: 'video/mp4',
        data: videoData.toString('base64'),
      },
    });
  }

  parts.push({ text: options.userPrompt });

  const result = await model.generateContent(parts);
  const response = result.response;
  const text = response.text();

  return {
    rawResponse: text,
    parsedJson: JSON.parse(text),
    tokensUsed: response.usageMetadata?.totalTokenCount || 0,
    model: options.model,
    cachedVideo: !!options.videoUri,
  };
}
```

### Workflow Editor Component

```tsx
// components/workflow-editor/WorkflowEditor.tsx
'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { VideoInputNode } from './nodes/VideoInputNode';
import { GeminiAnalysisNode } from './nodes/GeminiAnalysisNode';
import { SubprocessDetectorNode } from './nodes/SubprocessDetectorNode';
import { ScreenshotExtractorNode } from './nodes/ScreenshotExtractorNode';
import { ResultOutputNode } from './nodes/ResultOutputNode';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';

const nodeTypes = {
  'video-input': VideoInputNode,
  'gemini-analysis': GeminiAnalysisNode,
  'subprocess-detector': SubprocessDetectorNode,
  'screenshot-extractor': ScreenshotExtractorNode,
  'result-output': ResultOutputNode,
};

interface WorkflowEditorProps {
  workflow: Workflow;
  onSave: (workflow: Workflow) => void;
  onRun: () => void;
}

export function WorkflowEditor({ workflow, onSave, onRun }: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onAddNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y: 100 + nodes.length * 100 },
      data: getDefaultNodeData(type),
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes]);

  const onUpdateNodeData = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
    );
  }, [setNodes]);

  const handleSave = () => {
    onSave({ ...workflow, nodes, edges });
  };

  return (
    <div className="h-screen w-full flex">
      {/* Node Palette */}
      <NodePalette onAddNode={onAddNode} />

      {/* Flow Editor */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <Background />
          <MiniMap />

          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
            <button
              onClick={onRun}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Run
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Configuration Panel */}
      {selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onUpdate={(data) => onUpdateNodeData(selectedNode.id, data)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function getDefaultNodeData(type: string): any {
  switch (type) {
    case 'video-input':
      return { videoPath: '', useCache: true };
    case 'gemini-analysis':
      return {
        model: 'gemini-2.5-flash',
        temperature: 0.1,
        maxTokens: 65536,
        variables: {},
      };
    case 'subprocess-detector':
      return { strategy: 'hierarchical', hierarchicalConfig: { maxDepth: 3, minStepsForSubprocess: 3 } };
    case 'screenshot-extractor':
      return { format: 'png', quality: 90, naming: 'step-number' };
    case 'result-output':
      return {};
    default:
      return {};
  }
}
```

### Node Configuration Panel

```tsx
// components/workflow-editor/NodeConfigPanel.tsx
'use client';

import { Node } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (data: any) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [data, setData] = useState(node.data);

  useEffect(() => {
    setData(node.data);
  }, [node.data]);

  const handleChange = (key: string, value: any) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    onUpdate(newData);
  };

  return (
    <div className="w-80 border-l bg-white p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{node.type}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={18} />
        </button>
      </div>

      {renderConfigFields(node.type, data, handleChange)}
    </div>
  );
}

function renderConfigFields(
  type: string,
  data: any,
  onChange: (key: string, value: any) => void
) {
  switch (type) {
    case 'video-input':
      return (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Video Path</label>
            <input
              type="text"
              value={data.videoPath || ''}
              onChange={(e) => onChange('videoPath', e.target.value)}
              className="w-full border rounded px-2 py-1"
              placeholder="video.mp4"
            />
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.useCache}
                onChange={(e) => onChange('useCache', e.target.checked)}
              />
              <span className="text-sm">Use Gemini cache</span>
            </label>
          </div>
        </>
      );

    case 'gemini-analysis':
      return (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Model</label>
            <select
              value={data.model}
              onChange={(e) => onChange('model', e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={data.temperature}
              onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
              className="w-full border rounded px-2 py-1"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={data.systemPromptOverride || ''}
              onChange={(e) => onChange('systemPromptOverride', e.target.value)}
              className="w-full border rounded px-2 py-1 h-32 font-mono text-xs"
              placeholder="Or select from templates..."
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">User Prompt</label>
            <textarea
              value={data.userPromptOverride || ''}
              onChange={(e) => onChange('userPromptOverride', e.target.value)}
              className="w-full border rounded px-2 py-1 h-24 font-mono text-xs"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">JSON Schema</label>
            <textarea
              value={data.jsonSchemaOverride || ''}
              onChange={(e) => onChange('jsonSchemaOverride', e.target.value)}
              className="w-full border rounded px-2 py-1 h-32 font-mono text-xs"
            />
          </div>
        </>
      );

    case 'subprocess-detector':
      return (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Strategy</label>
            <select
              value={data.strategy}
              onChange={(e) => onChange('strategy', e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              <option value="hierarchical">Hierarchical</option>
              <option value="temporal">Temporal (time gaps)</option>
              <option value="application-switch">Application Switch</option>
              <option value="custom">Custom (AI)</option>
            </select>
          </div>
          {data.strategy === 'hierarchical' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Max Depth</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={data.hierarchicalConfig?.maxDepth || 3}
                  onChange={(e) =>
                    onChange('hierarchicalConfig', {
                      ...data.hierarchicalConfig,
                      maxDepth: parseInt(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Min Steps for Subprocess</label>
                <input
                  type="number"
                  min="2"
                  value={data.hierarchicalConfig?.minStepsForSubprocess || 3}
                  onChange={(e) =>
                    onChange('hierarchicalConfig', {
                      ...data.hierarchicalConfig,
                      minStepsForSubprocess: parseInt(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </div>
            </>
          )}
        </>
      );

    default:
      return <p className="text-gray-500 text-sm">No configuration available</p>;
  }
}
```

### Subprocess Detection Strategies

```typescript
// lib/subprocess-detection.ts

interface HierarchicalConfig {
  maxDepth: number;
  minStepsForSubprocess: number;
}

interface TemporalConfig {
  gapThresholdSeconds: number;
  minDurationSeconds: number;
}

interface AppSwitchConfig {
  treatTabSwitchAsNew: boolean;
}

// Strategy 1: Hierarchical - detect repeating patterns
export function detectHierarchicalSubprocesses(
  data: any,
  config: HierarchicalConfig
): any {
  const processes = data.processes || [];
  const mainProcess = processes.find((p: any) => p.is_main_process);
  if (!mainProcess) return data;

  const steps = mainProcess.steps || [];

  // Find repeating action sequences
  const patterns = findRepeatingPatterns(steps, config.minStepsForSubprocess);

  // Convert patterns to subprocesses
  const subprocesses = patterns.map((pattern, idx) => ({
    process_id: `subprocess_${idx + 1}`,
    process_name: `Subprocess: ${pattern.description}`,
    parent_process_id: mainProcess.process_id,
    is_main_process: false,
    steps: pattern.steps,
    flow: generateFlowFromSteps(pattern.steps),
  }));

  return {
    ...data,
    processes: [mainProcess, ...subprocesses],
  };
}

// Strategy 2: Temporal - split by time gaps
export function detectTemporalSubprocesses(
  data: any,
  config: TemporalConfig
): any {
  const processes = data.processes || [];
  const mainProcess = processes.find((p: any) => p.is_main_process);
  if (!mainProcess) return data;

  const steps = mainProcess.steps || [];
  const segments: any[][] = [];
  let currentSegment: any[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const prevStep = steps[i - 1];

    if (prevStep) {
      const gap = step.timestamp_seconds - prevStep.timestamp_seconds;
      if (gap > config.gapThresholdSeconds) {
        if (currentSegment.length >= 2) {
          segments.push(currentSegment);
        }
        currentSegment = [];
      }
    }

    currentSegment.push(step);
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  // Convert segments to subprocesses
  const subprocesses = segments
    .filter((seg) => {
      const duration =
        seg[seg.length - 1].timestamp_seconds - seg[0].timestamp_seconds;
      return duration >= config.minDurationSeconds;
    })
    .map((seg, idx) => ({
      process_id: `subprocess_temporal_${idx + 1}`,
      process_name: `Phase ${idx + 1}`,
      parent_process_id: mainProcess.process_id,
      is_main_process: false,
      video_start_timestamp: seg[0].timestamp,
      video_end_timestamp: seg[seg.length - 1].timestamp,
      steps: seg.map((s, i) => ({ ...s, step_number: i + 1 })),
      flow: generateFlowFromSteps(seg),
    }));

  return {
    ...data,
    processes: [mainProcess, ...subprocesses],
  };
}

// Strategy 3: Application Switch - new app = new subprocess
export function detectAppSwitchSubprocesses(
  data: any,
  config: AppSwitchConfig
): any {
  const processes = data.processes || [];
  const mainProcess = processes.find((p: any) => p.is_main_process);
  if (!mainProcess) return data;

  const steps = mainProcess.steps || [];
  const segments: { app: string; steps: any[] }[] = [];
  let currentApp = '';
  let currentSteps: any[] = [];

  for (const step of steps) {
    const app = step.application?.name || 'Unknown';
    const isTabSwitch =
      step.action_type === 'navigation' &&
      step.specific_action === 'switch_tab';

    const shouldSplit =
      app !== currentApp && (config.treatTabSwitchAsNew || !isTabSwitch);

    if (shouldSplit && currentSteps.length > 0) {
      segments.push({ app: currentApp, steps: currentSteps });
      currentSteps = [];
    }

    currentApp = app;
    currentSteps.push(step);
  }

  if (currentSteps.length > 0) {
    segments.push({ app: currentApp, steps: currentSteps });
  }

  // Convert to subprocesses (only if multiple apps)
  if (segments.length <= 1) {
    return data;
  }

  const subprocesses = segments.map((seg, idx) => ({
    process_id: `subprocess_app_${idx + 1}`,
    process_name: `${seg.app} Actions`,
    parent_process_id: mainProcess.process_id,
    is_main_process: false,
    applications: [{ name: seg.app, type: 'web_application' }],
    steps: seg.steps.map((s, i) => ({ ...s, step_number: i + 1 })),
    flow: generateFlowFromSteps(seg.steps),
  }));

  return {
    ...data,
    processes: [mainProcess, ...subprocesses],
  };
}

// Strategy 4: Custom AI-based detection
export async function detectCustomSubprocesses(
  data: any,
  config: { detectionPrompt: string }
): Promise<any> {
  const { analyzeWithGemini } = await import('./gemini-analysis');

  // Use AI to identify subprocess boundaries
  const result = await analyzeWithGemini({
    model: 'gemini-2.5-flash',
    systemPrompt: 'You are a process analyst specializing in RPA workflow decomposition.',
    userPrompt: `${config.detectionPrompt}\n\nProcess data:\n${JSON.stringify(data, null, 2)}`,
    jsonSchema: JSON.stringify({
      type: 'object',
      properties: {
        subprocess_boundaries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              start_step: { type: 'number' },
              end_step: { type: 'number' },
              rationale: { type: 'string' },
            },
          },
        },
      },
    }),
    temperature: 0.2,
    maxTokens: 4096,
  });

  // Apply detected boundaries
  const boundaries = result.parsedJson.subprocess_boundaries || [];
  // ... apply boundaries to create subprocesses

  return data;
}

// Helper: Generate flow from steps
function generateFlowFromSteps(steps: any[]): any {
  const nodes = [
    { node_id: 'start', node_type: 'start', label: 'Start' },
    ...steps.map((s, i) => ({
      node_id: `action_${i + 1}`,
      node_type: 'action',
      step_number: i + 1,
      label: s.description,
    })),
    { node_id: 'end', node_type: 'end', label: 'End' },
  ];

  const edges = [
    { edge_id: 'e_start', from_node_id: 'start', to_node_id: 'action_1' },
    ...steps.slice(0, -1).map((_, i) => ({
      edge_id: `e_${i + 1}`,
      from_node_id: `action_${i + 1}`,
      to_node_id: `action_${i + 2}`,
    })),
    {
      edge_id: 'e_end',
      from_node_id: `action_${steps.length}`,
      to_node_id: 'end',
    },
  ];

  return { nodes, edges };
}

function findRepeatingPatterns(steps: any[], minLength: number): any[] {
  // Simple pattern detection - find sequences that appear multiple times
  const patterns: any[] = [];

  for (let len = minLength; len <= steps.length / 2; len++) {
    for (let i = 0; i <= steps.length - len * 2; i++) {
      const pattern = steps.slice(i, i + len);
      const patternKey = pattern.map((s: any) => s.specific_action).join('|');

      // Look for this pattern elsewhere
      for (let j = i + len; j <= steps.length - len; j++) {
        const candidate = steps.slice(j, j + len);
        const candidateKey = candidate.map((s: any) => s.specific_action).join('|');

        if (patternKey === candidateKey) {
          patterns.push({
            description: `Repeating: ${pattern[0].specific_action}...`,
            steps: pattern,
            occurrences: [i, j],
          });
        }
      }
    }
  }

  return patterns;
}
```

---

## Project Structure

```
experimental-workflow/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard: recent runs, videos
│   ├── workflows/
│   │   ├── page.tsx                # List workflows
│   │   ├── new/page.tsx            # Create new workflow
│   │   └── [id]/
│   │       ├── page.tsx            # Workflow editor
│   │       └── runs/page.tsx       # Run history for workflow
│   ├── runs/
│   │   └── [id]/page.tsx           # Run results viewer
│   ├── videos/
│   │   └── page.tsx                # Video browser
│   ├── prompts/
│   │   └── page.tsx                # Prompt template library
│   └── api/
│       ├── videos/
│       │   ├── route.ts            # List videos
│       │   └── [filename]/
│       │       ├── info/route.ts   # Video info
│       │       └── thumbnail/route.ts
│       ├── workflows/
│       │   ├── route.ts            # CRUD workflows
│       │   └── [id]/
│       │       ├── route.ts        # Get/update/delete workflow
│       │       └── run/route.ts    # Execute workflow
│       ├── runs/
│       │   ├── route.ts            # List runs
│       │   └── [id]/
│       │       ├── route.ts        # Get run status
│       │       └── stream/route.ts # SSE progress
│       ├── cache/
│       │   └── route.ts            # Cache management
│       └── prompts/
│           └── route.ts            # Prompt templates CRUD
├── components/
│   ├── workflow-editor/
│   │   ├── WorkflowEditor.tsx
│   │   ├── NodePalette.tsx
│   │   ├── NodeConfigPanel.tsx
│   │   └── nodes/
│   │       ├── VideoInputNode.tsx
│   │       ├── GeminiAnalysisNode.tsx
│   │       ├── SubprocessDetectorNode.tsx
│   │       ├── ScreenshotExtractorNode.tsx
│   │       └── ResultOutputNode.tsx
│   ├── results-viewer/
│   │   ├── ResultsViewer.tsx
│   │   ├── FlowchartView.tsx       # Reuse from existing
│   │   ├── ListView.tsx
│   │   └── ComparisonView.tsx
│   ├── video-browser/
│   │   └── VideoBrowser.tsx
│   ├── prompt-editor/
│   │   └── PromptEditor.tsx
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── db.ts                       # LowDB setup
│   ├── gemini-cache.ts             # Video caching
│   ├── gemini-analysis.ts          # AI analysis
│   ├── workflow-engine.ts          # Workflow execution
│   ├── subprocess-detection.ts     # Detection strategies
│   └── ffmpeg.ts                   # Screenshot extraction
├── data/
│   └── db.json                     # LowDB database file
├── videos/                         # Local video storage
├── output/
│   └── screenshots/                # Extracted screenshots
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## Default Prompt Templates

Ship with pre-configured prompts based on current implementation:

### System Prompt: RPA Analyst (Default)

```
{
  "id": "system-rpa-analyst",
  "name": "RPA Business Analyst",
  "category": "system",
  "content": "You are an expert RPA Business Analyst...", // From existing SYSTEM_PROMPT_V2
  "variables": ["language", "detail_level"]
}
```

### System Prompt: Subprocess Focus

```
{
  "id": "system-subprocess-focus",
  "name": "Subprocess Detection Specialist",
  "category": "system",
  "content": "You are an expert in process decomposition and subprocess identification.
Your primary focus is identifying logical subprocess boundaries within recorded processes.

SUBPROCESS DETECTION RULES:
1. A subprocess is a cohesive group of steps that accomplish a specific sub-goal
2. Look for natural boundaries: application switches, context changes, wait states
3. Minimum 3 steps to form a subprocess
4. Maximum 5 levels of nesting
5. Each subprocess should be reusable in other contexts

SIGNALS FOR SUBPROCESS BOUNDARIES:
- User switches to a different application window
- User completes a form and submits it
- User waits for a page/system to load
- User performs a series of related data entry actions
- User navigates to a completely different section

Always prefer more granular subprocesses over monolithic processes.
Name subprocesses descriptively: 'Login Authentication', 'Form Data Entry', 'Report Generation'.
",
  "variables": ["max_depth", "min_steps"]
}
```

### JSON Schema: Simplified

```
{
  "id": "schema-simplified",
  "name": "Simplified Output",
  "category": "schema",
  "content": "{\"type\":\"object\",\"properties\":{\"processes\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"process_name\":{\"type\":\"string\"},\"steps\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"step_number\":{\"type\":\"integer\"},\"timestamp\":{\"type\":\"string\"},\"description\":{\"type\":\"string\"},\"action_type\":{\"type\":\"string\"}}}}}}}}}"
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Project setup (Next.js, LowDB, Tailwind)
- [ ] LowDB database initialization
- [ ] Basic API routes (videos, workflows, runs)
- [ ] Video browser component
- [ ] Gemini integration with caching

### Phase 2: Workflow Editor
- [ ] React Flow setup
- [ ] Node type components (video-input, gemini-analysis, result-output)
- [ ] Node configuration panel
- [ ] Workflow save/load

### Phase 3: Execution Engine
- [ ] Topological sort execution
- [ ] SSE progress streaming
- [ ] Error handling and recovery
- [ ] Screenshot extraction via FFmpeg

### Phase 4: Results Viewer
- [ ] Port existing FlowchartViewer
- [ ] Port existing ListView
- [ ] Screenshot display
- [ ] Run comparison view

### Phase 5: Subprocess Experimentation
- [ ] Subprocess detector node
- [ ] Multiple detection strategies
- [ ] Custom AI-based detection
- [ ] A/B comparison tools

### Phase 6: Polish
- [ ] Prompt template library
- [ ] Import/export workflows
- [ ] Run history and statistics
- [ ] Cost tracking

---

## Quick Start Commands

```bash
# Create project
npx create-next-app@latest experimental-workflow --typescript --tailwind --app

# Install dependencies
cd experimental-workflow
npm install lowdb @google/generative-ai @xyflow/react fluent-ffmpeg @ffmpeg-installer/ffmpeg zustand
npm install -D @types/fluent-ffmpeg

# Setup shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card input textarea select dialog tabs

# Create directories
mkdir -p data videos output/screenshots

# Set environment variable
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start development
npm run dev
```

---

## Key Differences from Main Application

| Aspect | Main App (video-to-pdd) | Experimental App |
|--------|-------------------------|------------------|
| Database | Convex (cloud) | LowDB (local JSON) |
| Storage | Convex File Storage | Local filesystem |
| Deployment | Vercel + Convex Cloud | Local only |
| Focus | Production PDD generation | Prompt/model experimentation |
| Complexity | Full-featured | Minimal viable |
| Caching | None | Gemini File API caching |
| Workflow | Fixed pipeline | Visual node editor |

---

## Success Criteria

1. **Rapid Iteration**: Change prompt → run → see results in < 30 seconds
2. **Cost Efficiency**: Gemini caching reduces video upload costs by 80%+
3. **Comparison**: Side-by-side results from different workflow configurations
4. **Subprocess Accuracy**: Measurable improvement via different detection strategies
5. **Simplicity**: Single `npm run dev` to start, no cloud services required
