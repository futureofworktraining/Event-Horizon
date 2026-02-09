# Code Studio - Detailed Application Specification

## Table of Contents

1. [Overview](#1-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [User Interface Design](#3-user-interface-design)
4. [Data Models](#4-data-models)
5. [Technical Architecture](#5-technical-architecture)
6. [Settings & Configuration](#6-settings--configuration)
7. [Interaction Flows](#7-interaction-flows)
8. [API Integration](#8-api-integration)
9. [Future Considerations](#9-future-considerations)

---

## 1. Overview

### 1.1 Purpose

**Code Studio** is a specialized browser-based IDE designed for developing, testing, and optimizing video analysis workflows for RPA (Robotic Process Automation) documentation. It provides a complete environment for:

- Editing TypeScript workflow code (prompts, schemas, configurations)
- Testing video analysis against test videos
- Viewing and comparing analysis results
- Managing workflow versions
- Bulk testing multiple videos

### 1.2 Target Users

- **RPA Developers** - Building and refining video-to-PDD workflows
- **Prompt Engineers** - Optimizing AI prompts for video analysis
- **QA Engineers** - Testing analysis accuracy across multiple videos
- **Process Analysts** - Reviewing and validating generated process documentation

### 1.3 Key Value Propositions

1. **Unified Development Environment** - Edit code, run tests, and view results in one interface
2. **Rapid Iteration** - Quick feedback loop for prompt optimization
3. **Version Control** - Track changes and compare different workflow versions
4. **Bulk Testing** - Validate changes across multiple test videos simultaneously
5. **Real-time Logging** - Debug and monitor workflow execution

---

## 2. Functional Requirements

### 2.1 Code Editing

#### FR-2.1.1 Monaco Editor Integration

- Full TypeScript syntax highlighting and IntelliSense
- Multiple editor themes (Quiet Light, Dracula, Matcha)
- Line numbers with current line highlighting
- Multi-file editing with tab interface
- Auto-save and manual save capabilities
- Line and character count display

#### FR-2.1.2 File Management

- Hierarchical file tree explorer
- Create new files and folders
- Rename and delete files
- Visual indicators for modified files (asterisk `*`)
- Expandable/collapsible folder structure

#### FR-2.1.3 Multi-Tab Editor

- Open multiple files simultaneously
- Tab close button with unsaved changes warning
- Active tab visual indication
- Tab reordering (drag and drop)

### 2.2 Workflow Execution

#### FR-2.2.1 Single Video Analysis

- Run workflow against selected video
- Real-time progress logging
- Result display in output drawer
- Error handling and display

#### FR-2.2.2 Bulk Testing

- Multi-select videos from test library
- Run analysis on all selected videos
- Progress tracking per video
- Aggregated results summary
- Expected vs actual step count comparison

#### FR-2.2.3 Execution Status

- Status indicator in header (Ready, Running, Success, Error)
- Animated status dot during execution
- Execution time display

### 2.3 Output Management

#### FR-2.3.1 Steps Output

- Display extracted process steps
- Subprocess grouping with collapsible sections
- Step details:
  - Step number
  - Description (starting with "User" or "System")
  - Action type badge (click, type, navigate, wait, select, etc.)
  - Timestamp (MM:SS.s format)
  - Screenshot thumbnail
  - Sensitive data warning badge

#### FR-2.3.2 Flowchart Visualization

- Interactive React Flow diagram
- Node types: Start, End, Action, Decision, Subprocess
- Auto-layout using Dagre algorithm
- Zoom and pan controls
- Click-to-select steps

#### FR-2.3.3 Execution Logs

- Real-time log streaming
- Log levels: INFO, DEBUG, WARNING, ERROR, SUCCESS
- Timestamp for each entry
- Level-based filtering
- Auto-scroll to latest entries

#### FR-2.3.4 Version Diff View

- Side-by-side or unified diff display
- Added/removed line highlighting
- Line numbers
- File path header
- Change statistics (+X lines, -Y lines)

### 2.4 Version Management

#### FR-2.4.1 Version History

- List all saved versions
- Version metadata:
  - Version name (e.g., v1.2.0)
  - Save date and time
  - User comment
  - Current version indicator
- Load previous version
- Compare versions

#### FR-2.4.2 Version Operations

- Save current state as new version
- Version comment prompt
- Revert to previous version
- Delete version (with confirmation)

### 2.5 File System Integration (NEW REQUIREMENTS)

#### FR-2.5.1 Test Videos Folder

- **User-configurable path** to folder containing test videos
- Scan folder for video files (MP4, WebM, MOV, AVI)
- Display video metadata:
  - File name
  - Duration
  - File size
  - Last modified date
- Refresh button to rescan folder
- Filter/search videos by name

#### FR-2.5.2 Workflow Repository (Local)

- **User-configurable path** to local workflow repository
- Load workflow files from repository
- Save workflow files to repository
- Git integration (optional):
  - Show git status
  - Commit changes
  - View commit history
- Repository structure:
  ```
  workflow-repository/
  ├── workflows/
  │   ├── default/
  │   │   ├── main.ts
  │   │   ├── prompts.ts
  │   │   ├── schema.ts
  │   │   └── config.ts
  │   └── custom-workflow-name/
  │       └── ...
  ├── test-results/
  │   └── [timestamp]-[video-name].json
  └── versions/
      └── [version-id]/
          └── ...
  ```

#### FR-2.5.3 Output Folder

- **User-configurable path** for analysis output
- Store analysis results as JSON
- Store extracted screenshots
- Organize by date and video name

---

## 3. User Interface Design

### 3.1 Design System

#### 3.1.1 Design Philosophy: Neo-Brutalist Light

A clean, developer-focused design with:

- Hard edges (no border-radius on most elements)
- Strong borders (2px solid black)
- Hard drop shadows (offset box-shadow, no blur)
- Geometric, grid-based layouts
- Minimal color palette with high contrast
- Uppercase labels and bold typography

#### 3.1.2 Color Palette

| Token              | Value     | Usage                     |
| ------------------ | --------- | ------------------------- |
| `--bg-primary`     | `#ffffff` | Main background           |
| `--bg-secondary`   | `#fafafa` | Secondary surfaces        |
| `--bg-tertiary`    | `#f4f4f5` | Tertiary surfaces         |
| `--border-color`   | `#18181b` | Primary border (Zinc 950) |
| `--text-primary`   | `#18181b` | Primary text              |
| `--text-secondary` | `#3f3f46` | Secondary text            |
| `--text-muted`     | `#71717a` | Muted/disabled text       |
| `--accent-success` | `#10b981` | Success states (Emerald)  |
| `--accent-warning` | `#fbbf24` | Warnings (Amber)          |
| `--accent-error`   | `#ef4444` | Errors (Red)              |
| `--accent-info`    | `#3b82f6` | Information (Blue)        |

#### 3.1.3 Typography

| Element | Font                      | Size            | Weight         |
| ------- | ------------------------- | --------------- | -------------- |
| UI Text | Plus Jakarta Sans / Inter | 14px (0.875rem) | 400-800        |
| Code    | JetBrains Mono            | 13px            | 400-500        |
| Labels  | Plus Jakarta Sans         | 12px (0.75rem)  | 800, uppercase |
| Logo    | Plus Jakarta Sans         | 20px (1.25rem)  | 800, uppercase |

#### 3.1.4 Spacing System

| Token           | Value | Usage               |
| --------------- | ----- | ------------------- |
| `--spacing-xs`  | 4px   | Tight spacing       |
| `--spacing-sm`  | 8px   | Small spacing       |
| `--spacing-md`  | 12px  | Medium spacing      |
| `--spacing-lg`  | 16px  | Large spacing       |
| `--spacing-xl`  | 24px  | Extra large spacing |
| `--spacing-2xl` | 32px  | Section spacing     |

#### 3.1.5 Shadows (Neo-Brutalist Hard Shadows)

| Token             | Value                 | Usage                    |
| ----------------- | --------------------- | ------------------------ |
| `--shadow-sm`     | `2px 2px 0 0 #18181b` | Buttons, cards (default) |
| `--shadow-md`     | `4px 4px 0 0 #18181b` | Hover state              |
| `--shadow-lg`     | `6px 6px 0 0 #18181b` | Modals, dropdowns        |
| `--shadow-drawer` | `-8px 0 0 0 #18181b`  | Output drawer            |

### 3.2 Layout Structure

```
+-------------------------------------------------------------------+
|                           HEADER (56px)                           |
|  [Logo] | [Current File]                       [Save][Output][Run]|
+----+------------+--------------------------------------------+----+
|    |            |                                            |    |
| A  |  SIDEBAR   |              EDITOR AREA                   | D  |
| C  |  (280px)   |                                            | R  |
| T  |            |  [Tab 1] [Tab 2]                           | A  |
| I  | Explorer   |  +--------------------------------------+  | W  |
| V  | Versions   |  |                                      |  | E  |
| I  | Tests      |  |        Monaco Editor                 |  | R  |
| T  | Settings   |  |                                      |  |    |
| Y  |            |  |                                      |  | (60%|
|    |            |  +--------------------------------------+  |  of |
| B  |            |  [Line Count] [Char Count]  [TS] [UTF-8]   | width|
| A  |            |                                            |  )  |
| R  +------------+--------------------------------------------+    |
|(64px)                                                         |    |
+------------------------------------------------------------------+
```

### 3.3 Component Specifications

#### 3.3.1 Header Component

- **Height**: 56px
- **Background**: `--bg-primary` (#ffffff)
- **Border**: 2px solid bottom border
- **Layout**: Flexbox, space-between

**Left Section**:

- Logo: "CODE STUDIO" (uppercase, 800 weight)
- Divider: Vertical line
- Current file name (e.g., "workflow/main.ts")

**Center Section**:

- Status badge with animated dot
- States: Ready, Running, Success, Error

**Right Section**:

- Save button (secondary)
- Output button (secondary)
- Diff button (secondary)
- Run button (primary, with `Ctrl+Enter` kbd hint)

#### 3.3.2 Activity Bar

- **Width**: 64px
- **Background**: `--bg-secondary`
- **Border**: 2px solid right border
- **Icons**: 44x44px touch targets

**Items (top to bottom)**:

1. Explorer (folder icon) - File tree
2. Versions (clock icon) - Version history
3. Tests (play icon) - Test videos
4. [Spacer]
5. Settings (gear icon) - Configuration

#### 3.3.3 Sidebar Panel

- **Width**: 280px
- **Background**: `--bg-primary`
- **Border**: 2px solid right border

**Section Header**:

- Height: ~48px
- Title: Uppercase, 800 weight, 12px
- Action buttons (right side)

**Content Area**:

- Scrollable
- Padding: 8px

#### 3.3.4 Editor Area

- **Background**: Theme-dependent (`--bg-code`)
- **Layout**: Flex column

**Tab Bar**:

- Height: ~36px
- Background: `--bg-secondary`
- Tab style: Border-top, border-sides; no border-bottom (connected to editor)
- Active tab: Different background, bold text, lifted appearance

**Editor**:

- Monaco Editor instance
- Font: JetBrains Mono, 13px
- Line height: 1.6
- Padding: 16px top/bottom

**Toolbar**:

- Height: 44px
- Left: Line count, Character count
- Right: Language (TypeScript), Encoding (UTF-8)

#### 3.3.5 Output Drawer

- **Width**: 60% of viewport (max 1000px)
- **Position**: Fixed, right side with 12px margin
- **Animation**: Slide in from right (200ms)
- **Shadow**: `-8px 0 0 0 #18181b`

**Header**:

- Title: "OUTPUT" (uppercase, 800 weight)
- Close button (X icon)

**Tab Bar**:

- Tabs: Steps, Flowchart, Logs, Diff
- Active indicator: Border-bottom

**Content Panels**:

- Steps: Process steps with subprocess grouping
- Flowchart: React Flow diagram placeholder
- Logs: Real-time execution logs
- Diff: Code diff viewer

#### 3.3.6 Step Card Component

```
+--------------------------------------------------+
| [#]  Step Title                          [Thumb] |
|      [action-badge] [timestamp] [sensitive?]     |
+--------------------------------------------------+
```

- **Border**: 2px solid
- **Shadow**: 2px 2px offset
- **Hover**: Lift effect (-2px, -2px transform), larger shadow

**Step Number**: 32x32px box, black background, white text
**Thumbnail**: 96x60px, gray placeholder or actual screenshot
**Action Badge**: Colored border matching action type

#### 3.3.7 Subprocess Group

- **Left Border**: 8px wide, colored (purple default)
- **Background**: `--bg-secondary`
- **Header**: Collapsible with chevron
- **Steps Container**: White background, indented

#### 3.3.8 Settings Panel

**Input Fields**:
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Gemini API Key | Password | - | Stored in localStorage |
| Default Model | Select | gemini-2.5-flash | Options: flash, pro |
| Temperature | Number | 0.1 | Range: 0-2, step 0.1 |
| Max Retries | Number | 3 | Range: 0-10 |
| Timeout (ms) | Number | 120000 | Milliseconds |
| Editor Theme | Select | quiet-light | Theme selection |
| **Video Folder Path** | Text/Browse | - | **NEW**: Path to test videos |
| **Workflow Repository Path** | Text/Browse | - | **NEW**: Path to local repo |
| **Output Folder Path** | Text/Browse | - | **NEW**: Path for results |

### 3.4 Code Editor Themes

#### 3.4.1 Quiet Light (Default)

- Background: `#f5f5f5`
- Text: `#333333`
- Comments: `#aaaaaa`
- Keywords: `#4b69c6`
- Strings: `#448c27`
- Functions: `#7a3e9d`
- Numbers: `#ab6526`

#### 3.4.2 Dracula (Dark)

- Background: `#282a36`
- Text: `#f8f8f2`
- Comments: `#6272a4`
- Keywords: `#ff79c6`
- Strings: `#f1fa8c`
- Functions: `#50fa7b`
- Numbers: `#bd93f9`

#### 3.4.3 Matcha (Light Green)

- Background: `#ecf0eb`
- Text: `#5c6e74`
- Comments: `#90aca6`
- Keywords: `#6a9c6c`
- Strings: `#cfa86e`
- Functions: `#82a893`
- Numbers: `#cc8b65`

### 3.5 Responsive Behavior

- **Minimum Width**: 1024px
- **Activity Bar**: Always visible
- **Sidebar**: Collapsible via activity bar
- **Drawer**: Overlay on smaller screens

---

## 4. Data Models

### 4.1 File System Models

#### 4.1.1 FileNode

```typescript
interface FileNode {
  type: "file";
  name: string;
  path: string;
  language: "typescript" | "json" | "markdown";
  content: string;
  modified: boolean;
  lastSaved?: Date;
}
```

#### 4.1.2 FolderNode

```typescript
interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  expanded: boolean;
  children: Record<string, FileNode | FolderNode>;
}
```

### 4.2 Test Video Model

```typescript
interface TestVideo {
  id: string;
  name: string;
  path: string;
  duration: string; // "MM:SS" format
  durationSeconds: number;
  expectedSteps?: number; // For validation
  fileSize: number; // Bytes
  mimeType: string;
  lastModified: Date;
  selected: boolean;
}
```

### 4.3 Version Model

```typescript
interface WorkflowVersion {
  id: string;
  name: string; // e.g., "v1.2.0"
  date: Date;
  comment: string;
  current: boolean;
  files: Record<string, string>; // path -> content
  checksum: string; // For integrity verification
}
```

### 4.4 Execution Result Model

```typescript
interface ExecutionResult {
  id: string;
  videoId: string;
  videoName: string;
  workflowVersion: string;
  timestamp: Date;
  duration: number; // Execution time in ms
  status: "success" | "error" | "partial";
  process: ProcessResult;
  logs: LogEntry[];
  error?: string;
}
```

### 4.5 Process Result Model (from Gemini)

```typescript
interface ProcessResult {
  processName: string;
  description: string;
  applications: Application[];
  duration: string;
  hierarchy: {
    depth: number;
    parentProcessId?: string;
    timestampStart?: string;
    timestampEnd?: string;
  };
  steps: Step[];
  subprocesses?: ProcessResult[];
}

interface Step {
  stepNumber: number;
  description: string; // Must start with "User" or "System"
  timestamp: string; // "MM:SS.s" format
  actionType: ActionType;
  specificAction: SpecificAction;
  uiElement?: UIElement;
  dataInfo?: DataInfo;
  waitCondition?: WaitCondition;
  screenshotId?: string;
  sensitive: boolean;
}

interface UIElement {
  type: UIElementType;
  screenRegion: ScreenRegion;
  identifiers?: {
    id?: string;
    className?: string;
    xpath?: string;
    accessibilityLabel?: string;
  };
}
```

### 4.6 Log Entry Model

```typescript
interface LogEntry {
  timestamp: Date;
  level: "info" | "debug" | "warning" | "error" | "success";
  message: string;
  source?: string;
  data?: Record<string, unknown>;
}
```

### 4.7 Settings Model

```typescript
interface AppSettings {
  // API Configuration
  geminiApiKey: string;
  defaultModel: "gemini-2.5-flash" | "gemini-2.5-pro";
  temperature: number;
  maxRetries: number;
  timeout: number;

  // Editor Configuration
  editorTheme: "quiet-light" | "dracula" | "matcha";
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;

  // File System Paths (NEW)
  videoFolderPath: string; // Path to test videos folder
  workflowRepositoryPath: string; // Path to local workflow repository
  outputFolderPath: string; // Path for analysis output

  // UI Preferences
  sidebarWidth: number;
  drawerWidth: number;
  autoSave: boolean;
  autoSaveInterval: number;
}
```

---

## 5. Technical Architecture

### 5.1 Application Stack

#### 5.1.1 Browser-Based Web Application

This application runs entirely in the browser using modern web APIs:

| Layer              | Technology                 | Purpose                           |
| ------------------ | -------------------------- | --------------------------------- |
| **Frontend**       | React + TypeScript         | UI components, state management   |
| **Build Tool**     | Vite                       | Fast development and bundling     |
| **Code Editor**    | Monaco Editor              | Full IDE-like editing experience  |
| **Flowchart**      | React Flow (@xyflow/react) | Interactive process visualization |
| **Styling**        | Tailwind CSS               | Theming, design tokens            |
| **AI Integration** | @google/generative-ai      | Gemini API for video analysis     |
| **File Access**    | File System Access API     | Local file operations (Chrome/Edge) |
| **Settings**       | localStorage / IndexedDB   | Persistent settings storage       |

#### 5.1.2 Required Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@xyflow/react": "^12.0.0",
    "monaco-editor": "^0.44.0",
    "@monaco-editor/react": "^4.6.0",
    "uuid": "^9.0.0",
    "dagre": "^0.8.5",
    "idb-keyval": "^6.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@types/react": "^18.2.0"
  }
}
```

#### 5.1.3 Browser Compatibility & Limitations

| Feature         | Technology               | Browser Support                        |
| --------------- | ------------------------ | -------------------------------------- |
| File Access     | File System Access API   | Chrome/Edge only (Chromium-based)      |
| Settings        | localStorage / IndexedDB | All modern browsers                    |
| API Key Storage | localStorage             | Consider security implications         |
| Video Playback  | HTML5 Video              | All modern browsers                    |

**Security Note**: API keys stored in localStorage are accessible via browser DevTools. For production use, consider:
- Instructing users to keep their API keys private
- Adding a backend proxy to hide API keys (future enhancement)
- Using short-lived API keys when available

#### 5.1.4 Data Storage Strategy (Browser + File System)

This application uses a hybrid storage approach:

**Browser Storage (localStorage / IndexedDB)**:
- Application settings and preferences
- Recent file handles (for quick re-access)
- Cached workflow content
- Execution history metadata

**File System Access API**:
- Direct read/write to user-selected folders
- Workflow TypeScript files
- Analysis result JSON files
- Test video access (read-only)

| Data Type      | Storage Format        | Location                             |
| -------------- | --------------------- | ------------------------------------ |
| Workflow code  | `.ts` files           | User-selected workflow folder        |
| Settings       | JSON                  | localStorage (`codeStudioSettings`)  |
| Versions       | Folder snapshots      | `{repository}/versions/{id}/`        |
| Test results   | `.json` files         | User-selected output folder          |
| Execution logs | IndexedDB records     | Browser storage                      |
| Test videos    | `.mp4` files (read)   | User-selected video folder           |

**When would you need a backend/database?**

- Multi-user collaboration features
- Complex querying across thousands of test results
- Analytics dashboards with aggregations
- Secure API key management

### 5.2 File Structure

```
code-studio/
├── package.json               # Dependencies and scripts
├── index.html                 # Entry HTML file
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main app component
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── ActivityBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── OutputDrawer.tsx
│   │   ├── editor/
│   │   │   ├── MonacoEditor.tsx
│   │   │   ├── EditorTabs.tsx
│   │   │   └── FileTree.tsx
│   │   ├── output/
│   │   │   ├── StepsPanel.tsx
│   │   │   ├── StepCard.tsx
│   │   │   ├── FlowchartPanel.tsx
│   │   │   ├── LogsPanel.tsx
│   │   │   └── DiffPanel.tsx
│   │   └── settings/
│   │       ├── SettingsPanel.tsx
│   │       └── PathSelector.tsx
│   ├── hooks/
│   │   ├── useSettings.ts
│   │   ├── useWorkflow.ts
│   │   ├── useFileSystem.ts
│   │   └── useGemini.ts
│   ├── services/
│   │   ├── gemini.ts         # Gemini API wrapper
│   │   ├── fileManager.ts    # File System Access API wrapper
│   │   ├── storage.ts        # localStorage/IndexedDB wrapper
│   │   └── versionManager.ts # Version control
│   ├── types/
│   │   ├── index.ts          # Shared types
│   │   ├── workflow.ts       # Workflow types
│   │   └── settings.ts       # Settings types
│   └── styles/
│       ├── globals.css       # Global styles + Tailwind
│       └── themes.css        # Editor theme definitions
└── public/
    └── icons/                # App icons
```

### 5.3 Module Architecture (Browser)

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (Single Process)                │
├─────────────────────────────────────────────────────────────┤
│                        UI Components                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │ Header  │ │ Sidebar │ │ Editor  │ │  Output Drawer  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘   │
│       └──────────┴──────────┴─────────────────┘             │
│                           │                                  │
│                    React Hooks Layer                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │useSettings │ │useWorkflow │ │useFileSystem│              │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘              │
│        │              │              │                       │
├────────┴──────────────┴──────────────┴──────────────────────┤
│                      Services Layer                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ storage.ts │ │ gemini.ts  │ │fileManager │              │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘              │
│        │              │              │                       │
├────────┴──────────────┴──────────────┴──────────────────────┤
│                     Browser APIs                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────────────────┐  │
│  │localStorage│ │   fetch()  │ │ File System Access API │  │
│  │ IndexedDB  │ │   for API  │ │ showDirectoryPicker()  │  │
│  └────────────┘ └────────────┘ └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Points:**

1. **Single Process** - Everything runs in the browser's main thread
2. **React Components** - UI layer with state management via hooks
3. **Services Layer** - Abstracts browser APIs for testability
4. **Browser APIs** - Direct access to localStorage, fetch, and File System Access API

**File System Access API Flow:**

```typescript
// User grants folder access via browser picker
const dirHandle = await window.showDirectoryPicker();

// Store handle for future sessions (IndexedDB)
await set('workflowFolder', dirHandle);

// Re-request permission on app reload
const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
```

### 5.4 State Management

```typescript
// Global Application State
interface AppState {
  // Editor State
  activeFile: string;
  openTabs: string[];
  fileTree: Record<string, FileNode | FolderNode>;

  // View State
  currentView: "explorer" | "versions" | "tests" | "settings";
  drawerOpen: boolean;
  activeDrawerTab: "output" | "flowchart" | "logs" | "diff";

  // Execution State
  executionStatus: "ready" | "running" | "success" | "error";
  currentExecution: ExecutionResult | null;
  logs: LogEntry[];

  // Test Videos
  testVideos: TestVideo[];
  selectedVideoIds: string[];

  // Versions
  versions: WorkflowVersion[];
  currentVersionId: string;

  // Settings
  settings: AppSettings;
}
```

### 5.5 Event System

```typescript
// Custom Events
const AppEvents = {
  // Editor Events
  FILE_OPENED: "file:opened",
  FILE_SAVED: "file:saved",
  FILE_MODIFIED: "file:modified",
  TAB_CLOSED: "tab:closed",

  // Execution Events
  WORKFLOW_START: "workflow:start",
  WORKFLOW_PROGRESS: "workflow:progress",
  WORKFLOW_COMPLETE: "workflow:complete",
  WORKFLOW_ERROR: "workflow:error",

  // Log Events
  LOG_ENTRY: "log:entry",
  LOG_CLEAR: "log:clear",

  // Settings Events
  SETTINGS_CHANGED: "settings:changed",
  THEME_CHANGED: "theme:changed",

  // File System Events
  VIDEOS_SCANNED: "videos:scanned",
  REPOSITORY_LOADED: "repository:loaded",
};
```

---

## 6. Settings & Configuration

### 6.1 Settings Categories

#### 6.1.1 API Settings

| Setting        | Type   | Default            | Validation                             |
| -------------- | ------ | ------------------ | -------------------------------------- |
| Gemini API Key | string | ""                 | Required for execution                 |
| Default Model  | enum   | "gemini-2.5-flash" | ["gemini-2.5-flash", "gemini-2.5-pro"] |
| Temperature    | number | 0.1                | 0.0 - 2.0                              |
| Max Retries    | number | 3                  | 0 - 10                                 |
| Timeout        | number | 120000             | 1000 - 600000 ms                       |

#### 6.1.2 Editor Settings

| Setting   | Type    | Default       | Validation                           |
| --------- | ------- | ------------- | ------------------------------------ |
| Theme     | enum    | "quiet-light" | ["quiet-light", "dracula", "matcha"] |
| Font Size | number  | 13            | 10 - 24 px                           |
| Tab Size  | number  | 2             | 2 or 4                               |
| Word Wrap | boolean | false         | -                                    |
| Minimap   | boolean | false         | -                                    |

#### 6.1.3 File System Settings (NEW)

| Setting                  | Type    | Default | Validation                     |
| ------------------------ | ------- | ------- | ------------------------------ |
| Video Folder Path        | string  | ""      | Valid directory path           |
| Workflow Repository Path | string  | ""      | Valid directory path           |
| Output Folder Path       | string  | ""      | Valid directory path, writable |
| Auto-scan Videos         | boolean | true    | -                              |
| Watch for Changes        | boolean | false   | -                              |

#### 6.1.4 UI Settings

| Setting            | Type    | Default | Validation       |
| ------------------ | ------- | ------- | ---------------- |
| Sidebar Width      | number  | 280     | 200 - 400 px     |
| Drawer Width       | string  | "60%"   | "40%" - "80%"    |
| Auto-save          | boolean | false   | -                |
| Auto-save Interval | number  | 30000   | 5000 - 300000 ms |

### 6.2 Settings Persistence

```typescript
// Settings are stored in localStorage
const STORAGE_KEYS = {
  SETTINGS: "codeStudioSettings",
  THEME: "codeStudioTheme",
  WORKSPACE: "codeStudioWorkspace", // Open files, tab order
  RECENT_VIDEOS: "codeStudioRecentVideos",
};

// Load settings on app init
function loadSettings(): AppSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return stored ? JSON.parse(stored) : getDefaultSettings();
}

// Save settings with validation
function saveSettings(settings: AppSettings): void {
  validateSettings(settings);
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  window.__IDE_SETTINGS__ = settings; // Expose for workflow runtime
}
```

### 6.3 Settings UI Design

```
┌─────────────────────────────────────────┐
│  SETTINGS                               │
├─────────────────────────────────────────┤
│                                         │
│  ▸ API CONFIGURATION                    │
│  ┌───────────────────────────────────┐  │
│  │ Gemini API Key                    │  │
│  │ [••••••••••••••••••••••••••••]    │  │
│  │ Stored locally in your browser    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Default Model                     │  │
│  │ [gemini-2.5-flash         ▼]     │  │
│  │ Can be overridden in config.ts   │  │
│  └───────────────────────────────────┘  │
│  Temperature    [0.1        ]           │
│  Max Retries    [3          ]           │
│  Timeout (ms)   [120000     ]           │
│                                         │
│  ▸ FILE LOCATIONS (NEW)                 │
│  ┌───────────────────────────────────┐  │
│  │ Test Videos Folder                │  │
│  │ [C:\Videos\RPA-Tests    ] [Browse]│  │
│  │ Folder containing test videos     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Workflow Repository               │  │
│  │ [C:\Workflows\VideoToPDD] [Browse]│  │
│  │ Local workflow files location     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Output Folder                     │  │
│  │ [C:\Output\Analysis     ] [Browse]│  │
│  │ Where results will be saved       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ▸ EDITOR                               │
│  Editor Theme   [Quiet Light     ▼]     │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         [ SAVE SETTINGS ]         │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 7. Interaction Flows

### 7.1 Initial Setup Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    FIRST-TIME SETUP WIZARD                    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Welcome Screen │
                    │  "Set up Code   │
                    │   Studio"       │
                    └────────┬────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Step 1: API Configuration    │
              │  Enter Gemini API Key         │
              │  [                        ]   │
              │  [Test Connection]            │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Step 2: Video Folder         │
              │  Select folder with test      │
              │  videos for analysis          │
              │  [Browse...]                  │
              │  Found: 5 videos              │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Step 3: Workflow Repository  │
              │  Select or create workflow    │
              │  repository folder            │
              │  [Browse...] [Create New]     │
              └───────────────┬───────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Step 4: Output Location      │
              │  Where to save analysis       │
              │  results                      │
              │  [Browse...]                  │
              └───────────────┬───────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Setup Complete │
                    │  [Start Coding] │
                    └─────────────────┘
```

### 7.2 Workflow Execution Flow

```
User clicks [Run] or presses Ctrl+Enter
              │
              ▼
     ┌────────────────┐
     │ Validate setup │
     │ - API key set? │
     │ - File saved?  │
     └───────┬────────┘
              │
    ┌─────────┴─────────┐
    │ No                │ Yes
    ▼                   ▼
┌──────────┐   ┌───────────────┐
│ Show     │   │ Set status:   │
│ error    │   │ "Running"     │
└──────────┘   └───────┬───────┘
                        │
                        ▼
              ┌─────────────────┐
              │ Open drawer to  │
              │ Logs tab        │
              └───────┬─────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ Log: "Starting  │
              │ workflow..."    │
              └───────┬─────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ Upload video to │
              │ Gemini File API │
              │ Log progress    │
              └───────┬─────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ Run analysis    │
              │ with prompts    │
              │ from editor     │
              └───────┬─────────┘
                        │
           ┌────────────┴────────────┐
           │ Success                 │ Error
           ▼                         ▼
  ┌─────────────────┐       ┌─────────────────┐
  │ Parse JSON      │       │ Log error       │
  │ response        │       │ Set status:     │
  └────────┬────────┘       │ "Error"         │
           │                └─────────────────┘
           ▼
  ┌─────────────────┐
  │ Display steps   │
  │ in drawer       │
  │ Set status:     │
  │ "Success"       │
  └─────────────────┘
```

### 7.3 Bulk Testing Flow

```
User selects videos in Tests panel
              │
              ▼
     ┌────────────────────┐
     │ Selection updated  │
     │ "3 selected"       │
     └─────────┬──────────┘
              │
              ▼
User clicks [Run Selected Tests]
              │
              ▼
     ┌────────────────────┐
     │ For each video:    │
     │ - Execute workflow │
     │ - Log results      │
     │ - Track progress   │
     └─────────┬──────────┘
              │
              ▼
     ┌────────────────────┐
     │ Display summary:   │
     │ - Total tests: 3   │
     │ - Passed: 2        │
     │ - Failed: 1        │
     │ - Avg steps: 10.3  │
     └────────────────────┘
```

### 7.4 Version Management Flow

```
User clicks [Save] or presses Ctrl+Shift+S
              │
              ▼
     ┌────────────────────┐
     │ Prompt for version │
     │ comment            │
     │ [                ] │
     └─────────┬──────────┘
              │
              ▼
     ┌────────────────────┐
     │ Create snapshot:   │
     │ - All file contents│
     │ - Timestamp        │
     │ - Generate ID      │
     └─────────┬──────────┘
              │
              ▼
     ┌────────────────────┐
     │ Save to:           │
     │ repository/        │
     │   versions/        │
     │     {version-id}/  │
     └─────────┬──────────┘
              │
              ▼
     ┌────────────────────┐
     │ Update versions    │
     │ list in sidebar    │
     │ Mark as "current"  │
     └────────────────────┘
```

---

## 8. API Integration

### 8.1 Gemini API Integration

#### 8.1.1 Video Upload

```typescript
async function uploadVideoToGemini(
  videoPath: string,
  apiKey: string,
): Promise<GeminiFile> {
  const fileManager = new GoogleAIFileManager(apiKey);

  const uploadResult = await fileManager.uploadFile(videoPath, {
    mimeType: "video/mp4",
    displayName: "process-recording",
  });

  // Wait for processing
  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === "PROCESSING") {
    await delay(10000);
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state !== "ACTIVE") {
    throw new Error(`Video processing failed: ${file.state}`);
  }

  return file;
}
```

#### 8.1.2 Analysis Request

```typescript
async function runAnalysis(
  file: GeminiFile,
  settings: AppSettings,
  prompts: { system: string; user: string },
): Promise<ProcessResult> {
  const genAI = new GoogleGenerativeAI(settings.geminiApiKey);

  const model = genAI.getGenerativeModel({
    model: settings.defaultModel,
    systemInstruction: prompts.system,
    generationConfig: {
      temperature: settings.temperature,
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA,
    },
  });

  const result = await model.generateContent([
    { fileData: { fileUri: file.uri, mimeType: "video/mp4" } },
    { text: prompts.user },
  ]);

  return JSON.parse(result.response.text());
}
```

### 8.2 Local File System API

#### 8.2.1 File System Access (Browser)

```typescript
// Request access to directories using File System Access API
async function selectDirectory(
  purpose: string,
): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({
    id: purpose,
    mode: "readwrite",
    startIn: "documents",
  });
  return handle;
}

// Scan for video files
async function scanVideosFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<TestVideo[]> {
  const videos: TestVideo[] = [];
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi"];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file") {
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (videoExtensions.includes(ext.toLowerCase())) {
        const file = await entry.getFile();
        videos.push({
          id: crypto.randomUUID(),
          name: entry.name,
          path: entry.name,
          fileSize: file.size,
          mimeType: file.type,
          lastModified: new Date(file.lastModified),
          duration: "Unknown", // Requires video metadata extraction
          durationSeconds: 0,
          selected: false,
        });
      }
    }
  }

  return videos;
}
```

#### 8.2.2 Workflow Repository Operations

```typescript
// Load workflow from repository
async function loadWorkflow(
  repoHandle: FileSystemDirectoryHandle,
  workflowName: string,
): Promise<WorkflowFiles> {
  const workflowDir = await repoHandle.getDirectoryHandle("workflows");
  const targetDir = await workflowDir.getDirectoryHandle(workflowName);

  const files: WorkflowFiles = {};
  for await (const entry of targetDir.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".ts")) {
      const file = await entry.getFile();
      files[entry.name] = await file.text();
    }
  }

  return files;
}

// Save workflow to repository
async function saveWorkflow(
  repoHandle: FileSystemDirectoryHandle,
  workflowName: string,
  files: WorkflowFiles,
): Promise<void> {
  const workflowDir = await repoHandle.getDirectoryHandle("workflows", {
    create: true,
  });
  const targetDir = await workflowDir.getDirectoryHandle(workflowName, {
    create: true,
  });

  for (const [filename, content] of Object.entries(files)) {
    const fileHandle = await targetDir.getFileHandle(filename, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}
```

---

## 9. Future Considerations

### 9.1 Planned Enhancements

#### 9.1.1 Git Integration

- Show git status in file tree
- Commit changes with message
- View commit history
- Diff against git commits
- Branch management

#### 9.1.2 Collaborative Features

- Share workflow via link
- Real-time collaboration
- Comments on workflow files
- Review and approval workflow

#### 9.1.3 Advanced Testing

- Automated regression testing
- Step accuracy metrics
- A/B testing of prompts
- Performance benchmarking
- Test reports export

#### 9.1.4 Enhanced Visualization

- Side-by-side video + steps view
- Step timeline with video sync
- Bounding box overlay preview
- Screenshot comparison

### 9.2 Performance Optimization

#### 9.2.1 Lazy Loading

- Load file content on demand
- Virtual scrolling for large step lists
- Incremental flowchart rendering

#### 9.2.2 Caching

- Cache Gemini File API uploads
- Cache analysis results
- Persist Monaco editor state

### 9.3 Accessibility

- Keyboard navigation for all features
- ARIA labels on interactive elements
- High contrast theme option
- Screen reader support
- Focus management in drawer

### 9.4 Security Considerations

- API key encryption in localStorage
- Secure communication with Gemini API
- Input sanitization for user content
- CSP headers for deployment
- No sensitive data in logs

---

## Appendix A: Keyboard Shortcuts

| Shortcut       | Action                          |
| -------------- | ------------------------------- |
| `Ctrl+Enter`   | Run workflow                    |
| `Ctrl+S`       | Save current file               |
| `Ctrl+Shift+S` | Save as new version             |
| `Escape`       | Close output drawer             |
| `Ctrl+P`       | Quick open file (planned)       |
| `Ctrl+Shift+F` | Search in files (planned)       |
| `Ctrl+/`       | Toggle comment (Monaco)         |
| `Ctrl+D`       | Select next occurrence (Monaco) |

---

## Appendix B: Action Type Reference

| Action Type | Badge Color        | Description                |
| ----------- | ------------------ | -------------------------- |
| click       | Blue (`#3b82f6`)   | Mouse click interaction    |
| type        | Green (`#10b981`)  | Keyboard input             |
| navigate    | Amber (`#fbbf24`)  | URL/page navigation        |
| wait        | Purple (`#8b5cf6`) | Wait for element/condition |
| select      | Blue (`#3b82f6`)   | Dropdown/list selection    |
| scroll      | Gray               | Scroll action              |
| drag        | Gray               | Drag and drop              |
| hover       | Gray               | Mouse hover                |

---

## Appendix C: File Type Icons

| Extension | Icon                | Language   |
| --------- | ------------------- | ---------- |
| `.ts`     | TypeScript logo     | typescript |
| `.json`   | JSON braces         | json       |
| `.md`     | Markdown M          | markdown   |
| `.css`    | CSS hash            | css        |
| `.html`   | HTML angle brackets | html       |

---

_Document Version: 1.0_
_Last Updated: 2025-01-21_
_Author: Specification generated from proposal-F-code-studio prototype_
