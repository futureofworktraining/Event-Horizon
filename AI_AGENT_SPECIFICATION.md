# Specyfikacja AI Agent - Video to PDD

## Spis Treści

1. [Architektura Ogólna](#1-architektura-ogólna)
2. [Workflow Główny - Analiza Wideo](#2-workflow-główny---analiza-wideo)
3. [Pełne Prompty](#3-pełne-prompty)
4. [JSON Schema (Output)](#4-json-schema-output)
5. [Workflow Detekcji Bounding Boxów](#5-workflow-detekcji-bounding-boxów)
6. [Przetwarzanie Odpowiedzi AI](#6-przetwarzanie-odpowiedzi-ai)
7. [Typy Danych (Enumy)](#7-typy-danych-enumy)
8. [Kluczowe Aspekty do Odtworzenia](#8-kluczowe-aspekty-do-odtworzenia)

---

## 1. Architektura Ogólna

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Video Upload   │────▶│  Gemini 2.5 Flash │────▶│  Structured     │
│  (MP4)          │     │  (Video Analysis) │     │  JSON Response  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Overlay Images │◀────│ Bounding Box     │◀────│  Screenshots    │
│  (Optional)     │     │ Detection        │     │  (FFmpeg/Client)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Komponenty:

1. **Video Upload** - Użytkownik przesyła nagranie ekranu (MP4)
2. **Gemini 2.5 Flash** - Model AI analizuje wideo i generuje strukturalny JSON
3. **Screenshots** - Ekstrakcja klatek z wideo dla każdego kroku (FFmpeg server-side lub client-side)
4. **Bounding Box Detection** - Opcjonalna detekcja lokalizacji elementów UI na screenshotach
5. **Overlay Images** - Generowanie obrazów z zaznaczonymi elementami UI

---

## 2. Workflow Główny - Analiza Wideo

### 2.1 Model i Konfiguracja

```javascript
// Model
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: SYSTEM_PROMPT_V2,
  generationConfig: {
    responseMimeType: "application/json",  // Wymuszony JSON output
    responseSchema: JSON_SCHEMA_V2,        // Schemat struktury odpowiedzi
    maxOutputTokens: 65536                 // Zwiększone dla długich filmów
  }
});

// Wywołanie z wideo
const result = await model.generateContent([
  {
    fileData: {
      mimeType: file.mimeType,  // "video/mp4"
      fileUri: file.uri,        // URI z Gemini File API
    },
  },
  { text: USER_PROMPT_V2 },
]);
```

### 2.2 Przepływ Przetwarzania

1. **Upload wideo do Convex Storage**
2. **Pobranie wideo do temp directory**
3. **Upload wideo do Gemini File API**
4. **Oczekiwanie na przetworzenie** (state: PROCESSING → ACTIVE)
5. **Wywołanie generateContent z wideo + promptem**
6. **Parsowanie JSON response**
7. **Ekstrakcja screenshots z FFmpeg**
8. **Zapis do bazy danych** (procesy, kroki, flowchart)

---

## 3. Pełne Prompty

### 3.1 SYSTEM_PROMPT_V2 (Pełny)

```
You are an expert RPA (Robotic Process Automation) Business Analyst specializing in creating Process Design Documents (PDD) from screen recordings. Your task is to analyze a video of a business process and extract detailed, structured documentation with FLOWCHART representation that can be used for automation development.

## Documentation Standards

### Step Descriptions
- Every step description MUST start with either "User" or "System" to indicate who performs the action
- Use present tense action verbs (clicks, types, selects, navigates, verifies)
- Reference UI element names in single quotes (e.g., "User clicks 'Submit' button")
- Be specific about what happens, not vague

### UI Element Location Guidelines
Use a 9-zone grid to describe element positions:
- top_left, top_center, top_right
- middle_left, middle_center, middle_right
- bottom_left, bottom_center, bottom_right
- full_screen (for modals, overlays)

### Timestamp Format
Use MM:SS.s format (e.g., "00:05.2" for 5.2 seconds, "01:30.0" for 1 minute 30 seconds)

### Sensitive Data Handling
- Passwords: Show as "[MASKED]"
- Personal Identifiable Information (PII): Show as "[PII MASKED]"
- Credit card numbers: Show as "[CC MASKED]"
- SSN/Government IDs: Show as "[ID MASKED]"
- Always set is_sensitive: true for these data types

## FLOWCHART STRUCTURE (CRITICAL)

You MUST analyze the video and produce a flowchart representation. The flowchart consists of NODES (steps and control points) and EDGES (connections between them).

### Node Types

1. **start** - Single entry point for each process
   - node_id: "start"
   - Every process must have exactly one start node

2. **end** - Exit points (can have multiple per process)
   - node_id: "end_success", "end_failure", "end_cancelled", etc.
   - end_type: "success" | "failure" | "cancelled" | "exception"
   - Use "success" for normal completion
   - Use "failure" for error conditions
   - Use "cancelled" for user cancellation
   - Use "exception" for unexpected errors

3. **action** - A step performed by user or system
   - node_id: "step_1", "step_2", etc. (must match step_number)
   - Links to a step via step_number field
   - flow_node_id in step should match this node_id

4. **decision** - Binary decision point (yes/no, true/false)
   - node_id: "decision_1", "decision_2", etc.
   - condition: The question being evaluated (e.g., "Is user logged in?")
   - condition_description: Detailed explanation
   - Has exactly TWO outgoing edges with labels like "TAK"/"NIE" or "Yes"/"No"

5. **switch** - Multi-way decision point (3+ options)
   - node_id: "switch_1", etc.
   - condition: The value being evaluated
   - Has 3 or more outgoing edges with different labels

6. **merge** - Where branches converge back
   - node_id: "merge_1", "merge_2", etc.
   - Use when multiple paths come together
   - Has multiple incoming edges, one outgoing edge

7. **subprocess** - Reference to a nested process
   - node_id: "subprocess_login", "subprocess_payment", etc.
   - subprocess_id: References the process_id of the child process
   - label: Display name for the subprocess

8. **loop_back** - Return to an earlier node (for retry logic)
   - node_id: "loop_1", etc.
   - The outgoing edge points back to an earlier node

### Edge Structure

Each edge connects two nodes:
- edge_id: Unique identifier (e.g., "edge_start_step1")
- from_node_id: Source node
- to_node_id: Target node
- label: Optional label (REQUIRED for decision/switch outgoing edges)
- condition: Optional logical condition
- edge_type: "normal" | "exception" | "timeout" | "loop"
- is_default: true for the default path from decision nodes

### Decision Point Detection

Create a DECISION node when you observe:
- Confirmation dialogs (Yes/No, OK/Cancel)
- Error messages that change the flow
- Validation results (valid/invalid)
- Login success/failure
- Data availability checks
- User choices between options

Example decision flow:
```
step_2 → decision_1 → [TAK] → step_3a → merge_1 → step_4
                   → [NIE] → step_3b → merge_1
```

### Subprocess Detection

Create a SUBPROCESS when you observe:
- A distinct, reusable sequence of steps (e.g., login, payment, search)
- A logical grouping that could be extracted and reused
- A section that appears multiple times in different contexts
- IMPORTANT: Maximum 5 levels of nesting allowed

For subprocesses:
- Create a separate process entry with parent_process_id set
- Reference it from the parent flow using subprocess node
- Assign a unique color_index (0-7) for visual distinction

### Multiple Processes

If the video shows multiple INDEPENDENT processes:
- Create separate process entries for each
- First process discovered should have is_main_process: true
- Set video_start_timestamp and video_end_timestamp for each
- Each process gets its own flow structure

## Action Types
1. ui_interaction - Direct interaction with UI elements
2. navigation - Moving between pages, applications, tabs
3. data_transfer - Reading, copying, pasting data
4. explanation - Business rules, decisions, notes
5. wait - Waiting for elements, pages, processes
6. validation - Verifying elements, values, states

## Specific Actions
- UI Interaction: click, double_click, right_click, type, select, check, uncheck, drag_and_drop, scroll, hover
- Navigation: navigate_to_url, open_application, close_application, switch_tab, switch_window, go_back
- Data Transfer: read, copy, paste, download, upload, export, import
- Explanation: note, decision, business_rule, exception
- Wait: wait_for_element, wait_for_page, wait_for_process, wait_fixed_time
- Validation: verify_element, verify_value, verify_state

## Output Requirements

Return a JSON object with:
1. processes[] - Array of all processes (main + subprocesses)
2. Each process contains:
   - process_id, process_name, process_description
   - parent_process_id (null for main process)
   - is_main_process (true for the primary process)
   - flow { nodes[], edges[] }
   - steps[] (with flow_node_id linking to nodes)
   - applications, business_rules_observed, exceptions_noted

Be thorough - capture EVERY action and create appropriate decision nodes for any branching logic observed.
```

### 3.2 USER_PROMPT_V2 (Pełny)

```
Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

Watch the entire video carefully and document:

1. **All User Actions** - clicks, typing, selections, scrolling, drag-drop
2. **All System Responses** - page loads, popups, notifications, errors
3. **Decision Points** - any branching logic, conditions, choices
4. **Waiting Periods** - loading, processing, delays
5. **Subprocesses** - distinct reusable sequences (login, payment, etc.)
6. **Multiple Processes** - if video shows independent processes, separate them

For the FLOWCHART:
- Create START and END nodes
- Create ACTION nodes for each step
- Create DECISION nodes for any branching (if/else, success/failure)
- Create SUBPROCESS nodes for distinct sequences
- Connect all nodes with properly labeled EDGES
- Use "TAK"/"NIE" or "Yes"/"No" labels for decision edges

Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.
```

### 3.3 Prompt dla Bounding Box Detection (Pełny)

```
You are a UI element detector. Find the EXACT bounding box of ONE specific UI element in this screenshot.

TARGET ELEMENT TO FIND:
- Element name/label: "${elementName}"
- Element type: ${elementType}
- Location description: ${locationDescription}
- Screen region: ${screenRegion}
- User action context: ${description}

IMPORTANT INSTRUCTIONS:
1. Look for a visible label or text that says "${elementName}" or similar
2. The bounding box should cover the INTERACTIVE element itself (input field, button, etc.), NOT the label
3. If there are multiple similar elements (e.g., multiple text fields), use the label text to identify the correct one
4. For input fields: look for the label text ABOVE or BESIDE the input, then select that specific input field
5. The element type "${elementType}" helps identify - for "text_field" look for an input box, for "button" look for a clickable button, etc.

Return a JSON object:
{
  "label": "${elementName}",
  "box_2d": [ymin, xmin, ymax, xmax],
  "found": true
}

Where box_2d coordinates are normalized to 0-1000 scale (0=top/left, 1000=bottom/right).

If the element cannot be found, return:
{"label": "${elementName}", "box_2d": [0, 0, 0, 0], "found": false}

Return ONLY the JSON object, no other text.
```

---

## 4. JSON Schema (Output)

### 4.1 Pełny Schema V2

```javascript
const JSON_SCHEMA_V2 = {
  type: "object",
  properties: {
    processes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          // === METADANE PROCESU ===
          process_id: { type: "string" },
          process_name: { type: "string" },
          process_description: { type: "string" },
          recording_duration_seconds: { type: "number" },
          total_steps: { type: "number" },
          parent_process_id: { type: "string" },  // null dla głównego procesu
          is_main_process: { type: "boolean" },
          video_start_timestamp: { type: "string" },
          video_end_timestamp: { type: "string" },

          // === APLIKACJE ===
          applications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: {
                  type: "string",
                  enum: ["web_application", "desktop_application", "mobile_application", "terminal", "other"]
                },
                url: { type: "string" },
                version: { type: "string" }
              },
              required: ["name", "type"]
            }
          },

          // === REGUŁY I WYJĄTKI ===
          business_rules_observed: {
            type: "array",
            items: { type: "string" }
          },
          exceptions_noted: {
            type: "array",
            items: { type: "string" }
          },

          // === FLOWCHART ===
          flow: {
            type: "object",
            properties: {
              // --- WĘZŁY ---
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    node_id: { type: "string" },
                    node_type: {
                      type: "string",
                      enum: ["start", "end", "action", "decision", "switch", "merge", "subprocess", "loop_back"]
                    },
                    step_number: { type: "number" },           // dla action nodes
                    condition: { type: "string" },             // dla decision/switch
                    condition_description: { type: "string" },
                    subprocess_id: { type: "string" },         // dla subprocess nodes
                    end_type: {
                      type: "string",
                      enum: ["success", "failure", "cancelled", "exception"]
                    },
                    label: { type: "string" }
                  },
                  required: ["node_id", "node_type"]
                }
              },
              // --- KRAWĘDZIE ---
              edges: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    edge_id: { type: "string" },
                    from_node_id: { type: "string" },
                    to_node_id: { type: "string" },
                    label: { type: "string" },
                    condition: { type: "string" },
                    edge_type: {
                      type: "string",
                      enum: ["normal", "exception", "timeout", "loop"]
                    },
                    is_default: { type: "boolean" }
                  },
                  required: ["edge_id", "from_node_id", "to_node_id"]
                }
              }
            },
            required: ["nodes", "edges"]
          },

          // === KROKI ===
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step_number: { type: "number" },
                timestamp: { type: "string" },        // Format: MM:SS.s
                flow_node_id: { type: "string" },     // Powiązanie z flow node
                action_type: {
                  type: "string",
                  enum: ["ui_interaction", "navigation", "data_transfer", "explanation", "wait", "validation"]
                },
                specific_action: {
                  type: "string",
                  enum: [
                    "click", "double_click", "right_click", "type", "select", "check", "uncheck",
                    "drag_and_drop", "scroll", "hover", "navigate_to_url", "open_application",
                    "close_application", "switch_tab", "switch_window", "go_back", "read", "copy",
                    "paste", "download", "upload", "export", "import", "note", "decision",
                    "business_rule", "exception", "wait_for_element", "wait_for_page",
                    "wait_for_process", "wait_fixed_time", "verify_element", "verify_value", "verify_state"
                  ]
                },
                description: { type: "string" },      // MUSI zaczynać się od "User" lub "System"
                application: { type: "string" },
                screen_name: { type: "string" },
                screenshot_required: { type: "boolean" },

                // --- UI ELEMENT (opcjonalne) ---
                ui_element: {
                  type: "object",
                  properties: {
                    element_name: { type: "string" },
                    element_type: {
                      type: "string",
                      enum: [
                        "button", "link", "text_field", "text_area", "dropdown", "combobox",
                        "checkbox", "radio_button", "toggle", "slider", "date_picker", "time_picker",
                        "file_upload", "menu", "menu_item", "tab", "table", "table_row", "table_cell",
                        "tree_view", "tree_node", "list", "list_item", "card", "modal", "dialog",
                        "tooltip", "notification", "icon", "image", "label", "heading", "paragraph",
                        "breadcrumb", "pagination", "search_field", "other"
                      ]
                    },
                    location_description: { type: "string" },
                    screen_region: {
                      type: "string",
                      enum: [
                        "top_left", "top_center", "top_right", "middle_left", "middle_center",
                        "middle_right", "bottom_left", "bottom_center", "bottom_right", "full_screen"
                      ]
                    },
                    parent_element: { type: "string" },
                    identifiers: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        class_name: { type: "string" },
                        xpath: { type: "string" },
                        accessibility_id: { type: "string" }
                      }
                    }
                  },
                  required: ["element_name", "element_type", "location_description", "screen_region"]
                },

                // --- DATA INFO (opcjonalne) ---
                data_info: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                    data_type: {
                      type: "string",
                      enum: ["text", "number", "date", "datetime", "currency", "percentage", "boolean", "email", "phone", "url", "file", "password", "other"]
                    },
                    source: {
                      type: "string",
                      enum: ["user_input", "system_generated", "database", "external_api", "file_import", "calculation", "other"]
                    },
                    is_sensitive: { type: "boolean" },
                    format: { type: "string" },
                    validation_rules: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["value", "data_type", "source", "is_sensitive"]
                },

                // --- WAIT CONDITION (opcjonalne) ---
                wait_condition: {
                  type: "object",
                  properties: {
                    wait_type: {
                      type: "string",
                      enum: ["page_load", "element_visible", "element_clickable", "api_response", "file_download", "animation_complete", "manual_trigger", "timeout", "other"]
                    },
                    description: { type: "string" },
                    timeout_seconds: { type: "number" },
                    retry_count: { type: "number" }
                  },
                  required: ["wait_type", "description"]
                },

                notes: { type: "string" },
                automation_hint: { type: "string" }
              },
              required: ["step_number", "timestamp", "flow_node_id", "action_type", "specific_action", "description", "application", "screen_name", "screenshot_required"]
            }
          }
        },
        required: ["process_id", "process_name", "process_description", "flow", "steps"]
      }
    }
  },
  required: ["processes"]
};
```

---

## 5. Workflow Detekcji Bounding Boxów

### 5.1 Model i Konfiguracja

```javascript
const ai = new GoogleGenAI({ apiKey });

const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0,                         // Deterministyczny output
    thinkingConfig: { thinkingBudget: 0 }   // Wyłączone thinking dla zadań spatial
  },
});
```

### 5.2 Preprocessing Obrazu

```javascript
// Zmniejsz obraz do max 640px (zalecenie Google dla bounding box detection)
const maxSize = 640;
const image = await Jimp.read(imageBuffer);
const originalWidth = image.width;
const originalHeight = image.height;
const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight, 1);

if (scale < 1) {
  image.resize({
    w: Math.round(originalWidth * scale),
    h: Math.round(originalHeight * scale)
  });
}

// Konwertuj do base64 PNG
const resizedBuffer = await image.getBuffer("image/png");
const base64Image = resizedBuffer.toString("base64");
```

### 5.3 Output Bounding Box

```javascript
// Struktura odpowiedzi
{
  "label": "string",                        // Nazwa elementu
  "box_2d": [ymin, xmin, ymax, xmax],      // Znormalizowane 0-1000
  "found": boolean,                         // Czy znaleziono element
  "masked": boolean                         // Czy dane są wrażliwe (do blurowania)
}

// Przeliczenie na rzeczywiste piksele
const realYmin = (box_2d[0] / 1000) * imageHeight;
const realXmin = (box_2d[1] / 1000) * imageWidth;
const realYmax = (box_2d[2] / 1000) * imageHeight;
const realXmax = (box_2d[3] / 1000) * imageWidth;
```

### 5.4 Parsowanie Response

```javascript
let responseText = result.text || "";

// Obsługa markdown code blocks w odpowiedzi
if (responseText.includes("```json")) {
  responseText = responseText.split("```json")[1].split("```")[0].trim();
} else if (responseText.includes("```")) {
  responseText = responseText.split("```")[1].split("```")[0].trim();
}

// Parsowanie JSON
const parsed = JSON.parse(responseText);
const boundingBox = {
  label: String(parsed.label || elementName),
  box_2d: Array.isArray(parsed.box_2d) ? parsed.box_2d.map(Number) : [0, 0, 0, 0],
  found: parsed.found !== false,
  masked: isSensitive,
};

// Walidacja współrzędnych
if (boundingBox.box_2d.length !== 4 || boundingBox.box_2d.some(isNaN)) {
  boundingBox.box_2d = [0, 0, 0, 0];
  boundingBox.found = false;
}
```

---

## 6. Przetwarzanie Odpowiedzi AI

### 6.1 Parsowanie JSON Response

```javascript
// 1. Pobierz tekst odpowiedzi
const responseText = result.response.text();

// 2. Zapisz surową odpowiedź do debugowania (przed parsowaniem)
console.log(`Raw AI response length: ${responseText.length} characters`);
await ctx.runMutation(internal.internal.updateJobStatus, {
  jobId: args.jobId,
  status: "processing",
  rawAiResponse: responseText,  // Zapisz dla debugowania
});

// 3. Parsuj JSON
let analysisResult;
try {
  analysisResult = JSON.parse(responseText);
} catch (parseError) {
  console.error(`JSON parse error at response length: ${responseText.length}`);
  throw new Error(`Failed to parse Gemini response as JSON: ${parseError}`);
}

// 4. Waliduj strukturę
if (!analysisResult.processes || analysisResult.processes.length === 0) {
  throw new Error("No processes found in Gemini response");
}
```

### 6.2 Konwersja snake_case → camelCase

Gemini zwraca snake_case, baza danych używa camelCase:

```javascript
// Mapowanie pól
const fieldMapping = {
  "process_name"          : "processName",
  "process_description"   : "processDescription",
  "process_id"            : "processId",
  "parent_process_id"     : "parentProcessId",
  "is_main_process"       : "isMainProcess",
  "recording_duration_seconds" : "recordingDurationSeconds",
  "total_steps"           : "totalSteps",
  "video_start_timestamp" : "videoStartTimestamp",
  "video_end_timestamp"   : "videoEndTimestamp",
  "business_rules_observed" : "businessRulesObserved",
  "exceptions_noted"      : "exceptionsNoted",

  "step_number"           : "stepNumber",
  "action_type"           : "actionType",
  "specific_action"       : "specificAction",
  "screen_name"           : "screenName",
  "screenshot_required"   : "screenshotRequired",
  "flow_node_id"          : "flowNodeId",
  "automation_hint"       : "automationHint",

  "element_name"          : "elementName",
  "element_type"          : "elementType",
  "location_description"  : "locationDescription",
  "screen_region"         : "screenRegion",
  "parent_element"        : "parentElement",
  "class_name"            : "className",
  "accessibility_id"      : "accessibilityId",

  "data_type"             : "dataType",
  "is_sensitive"          : "isSensitive",
  "validation_rules"      : "validationRules",

  "wait_type"             : "waitType",
  "timeout_seconds"       : "timeoutSeconds",
  "retry_count"           : "retryCount",

  "node_id"               : "nodeId",
  "node_type"             : "nodeType",
  "condition_description" : "conditionDescription",
  "subprocess_id"         : "subprocessId",
  "end_type"              : "endType",

  "edge_id"               : "edgeId",
  "from_node_id"          : "fromNodeId",
  "to_node_id"            : "toNodeId",
  "edge_type"             : "edgeType",
  "is_default"            : "isDefault"
};
```

### 6.3 Przetwarzanie Hierarchii Procesów

```javascript
// Map to track process IDs (for subprocess references)
const processIdMap = new Map();

// 1. Sortuj: główne procesy pierwsze
const mainProcesses = analysisResult.processes.filter(
  p => !p.parent_process_id || p.is_main_process
);
const subprocesses = analysisResult.processes.filter(
  p => p.parent_process_id && !p.is_main_process
);

// 2. Przetwórz główne procesy
let mainProcessId = null;
let colorCounter = 0;

for (const processData of mainProcesses) {
  const processId = await processProcessData(
    ctx,
    processData,
    jobId,
    null,                                    // parentProcessId
    1,                                       // hierarchyLevel
    colorCounter++ % 8,                      // colorIndex (0-7)
    videoPath,
    tempDir,
    processIdMap
  );

  if (!mainProcessId) {
    mainProcessId = processId;
  }
}

// 3. Przetwórz subprocesy (wielokrotne iteracje dla głębokiego zagnieżdżenia)
const processedSubprocesses = new Set();
let maxIterations = 5;  // Max hierarchy depth

while (processedSubprocesses.size < subprocesses.length && maxIterations > 0) {
  for (const processData of subprocesses) {
    // Skip if already processed
    if (processedSubprocesses.has(processData.process_id)) continue;

    // Check if parent has been processed
    const parentId = processData.parent_process_id;
    if (parentId && processIdMap.has(parentId)) {
      const parentProcessId = processIdMap.get(parentId);

      await processProcessData(
        ctx,
        processData,
        jobId,
        parentProcessId,
        hierarchyLevel + 1,  // Increment hierarchy
        colorCounter++ % 8,
        videoPath,
        tempDir,
        processIdMap
      );

      processedSubprocesses.add(processData.process_id);
    }
  }
  maxIterations--;
}
```

### 6.4 Ekstrakcja Screenshots (FFmpeg)

```javascript
// Parsowanie timestamp
function parseTimestamp(timestamp) {
  // "01:30.5" → 90.5 seconds
  // "00:05.2" → 5.2 seconds
  const parts = timestamp.split(':');

  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return 0;
}

// Ekstrakcja klatki z wideo
async function extractFrame(videoPath, timestampSeconds, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestampSeconds)
      .frames(1)
      .output(outputPath)
      .outputOptions(["-q:v", "2"])  // Wysoka jakość JPEG
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

// Użycie
const timestampSeconds = parseTimestamp(step.timestamp);  // "00:15.3" → 15.3
const screenshotPath = join(tempDir, `step-${step.step_number}.jpg`);
await extractFrame(videoPath, timestampSeconds, screenshotPath);
```

---

## 7. Typy Danych (Enumy)

### 7.1 Action Types (6)

| Typ | Opis |
|-----|------|
| `ui_interaction` | Bezpośrednia interakcja z elementami UI (klik, wpisywanie, wybór) |
| `navigation` | Nawigacja między stronami, aplikacjami, zakładkami |
| `data_transfer` | Odczyt, kopiowanie, wklejanie, import/export danych |
| `explanation` | Reguły biznesowe, decyzje, notatki wyjaśniające logikę |
| `wait` | Oczekiwanie na elementy, strony, procesy |
| `validation` | Weryfikacja elementów, wartości, stanów |

### 7.2 Specific Actions (34)

```
UI Interaction (10):
  click, double_click, right_click, type, select, check, uncheck,
  drag_and_drop, scroll, hover

Navigation (6):
  navigate_to_url, open_application, close_application, switch_tab,
  switch_window, go_back

Data Transfer (7):
  read, copy, paste, download, upload, export, import

Explanation (4):
  note, decision, business_rule, exception

Wait (4):
  wait_for_element, wait_for_page, wait_for_process, wait_fixed_time

Validation (3):
  verify_element, verify_value, verify_state
```

### 7.3 UI Element Types (37)

```
button, link, text_field, text_area, dropdown, combobox, checkbox,
radio_button, toggle, slider, date_picker, time_picker, file_upload,
menu, menu_item, tab, table, table_row, table_cell, tree_view,
tree_node, list, list_item, card, modal, dialog, tooltip, notification,
icon, image, label, heading, paragraph, breadcrumb, pagination,
search_field, other
```

### 7.4 Screen Regions (10)

```
┌─────────────┬─────────────┬─────────────┐
│  top_left   │ top_center  │  top_right  │
├─────────────┼─────────────┼─────────────┤
│ middle_left │middle_center│ middle_right│
├─────────────┼─────────────┼─────────────┤
│ bottom_left │bottom_center│ bottom_right│
└─────────────┴─────────────┴─────────────┘

+ full_screen (dla modali, overlayów)
```

### 7.5 Data Types (13)

```
text, number, date, datetime, currency, percentage, boolean,
email, phone, url, file, password, other
```

### 7.6 Data Sources (7)

```
user_input, system_generated, database, external_api,
file_import, calculation, other
```

### 7.7 Wait Types (9)

```
page_load, element_visible, element_clickable, api_response,
file_download, animation_complete, manual_trigger, timeout, other
```

### 7.8 Application Types (5)

```
web_application, desktop_application, mobile_application, terminal, other
```

### 7.9 Flow Node Types (8)

| Typ | Opis |
|-----|------|
| `start` | Pojedynczy punkt wejścia procesu |
| `end` | Punkt wyjścia (może być wiele) |
| `action` | Krok wykonywany przez user/system |
| `decision` | Binarny punkt decyzyjny (tak/nie) |
| `switch` | Wielokrotny wybór (3+ opcje) |
| `merge` | Punkt zbieżności gałęzi |
| `subprocess` | Odniesienie do zagnieżdżonego procesu |
| `loop_back` | Powrót do wcześniejszego węzła |

### 7.10 Edge Types (4)

```
normal, exception, timeout, loop
```

### 7.11 End Types (4)

```
success, failure, cancelled, exception
```

---

## 8. Kluczowe Aspekty do Odtworzenia

### 8.1 Structured Output

```javascript
// KRYTYCZNE: Używaj responseMimeType + responseSchema dla wymuszenia struktury
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: JSON_SCHEMA_V2,
  maxOutputTokens: 65536
}
```

### 8.2 Video Upload (Gemini File API)

```javascript
const fileManager = new GoogleAIFileManager(apiKey);

// 1. Upload pliku
const uploadResult = await fileManager.uploadFile(videoPath, {
  mimeType: "video/mp4",
  displayName: `video-${jobId}`,
});

// 2. Oczekiwanie na przetworzenie
let file = await fileManager.getFile(uploadResult.file.name);
while (file.state === "PROCESSING") {
  await new Promise(resolve => setTimeout(resolve, 2000));
  file = await fileManager.getFile(uploadResult.file.name);
}

if (file.state === "FAILED") {
  throw new Error("Video processing failed");
}

// 3. Użycie w generateContent
const result = await model.generateContent([
  {
    fileData: {
      mimeType: file.mimeType,
      fileUri: file.uri,
    },
  },
  { text: USER_PROMPT_V2 },
]);

// 4. Cleanup
await fileManager.deleteFile(file.name);
```

### 8.3 Deterministyczne Bounding Boxy

```javascript
// Dla zadań spatial (bounding box):
// - temperature: 0 (deterministyczny)
// - thinkingBudget: 0 (wyłączone reasoning)
config: {
  temperature: 0,
  thinkingConfig: { thinkingBudget: 0 }
}
```

### 8.4 Normalizacja Współrzędnych

```javascript
// Gemini zwraca box_2d w skali 0-1000
// [ymin, xmin, ymax, xmax]

// Przeliczenie na rzeczywiste piksele:
const realYmin = (box_2d[0] / 1000) * originalImageHeight;
const realXmin = (box_2d[1] / 1000) * originalImageWidth;
const realYmax = (box_2d[2] / 1000) * originalImageHeight;
const realXmax = (box_2d[3] / 1000) * originalImageWidth;

// Wymiary prostokąta:
const width = realXmax - realXmin;
const height = realYmax - realYmin;
```

### 8.5 Hierarchia Procesów

```javascript
// Maksymalnie 5 poziomów zagnieżdżenia
if (hierarchyLevel > 5) {
  throw new Error(`Maximum hierarchy depth (5) exceeded`);
}

// Przetwarzanie: parent → child (nie odwrotnie)
// Subprocesy wymagają istniejącego parent_process_id w processIdMap
```

### 8.6 Maskowanie Danych Wrażliwych

```javascript
// W opisach (automatycznie przez AI):
// - Hasła: "[MASKED]"
// - PII: "[PII MASKED]"
// - Karty kredytowe: "[CC MASKED]"
// - Dokumenty: "[ID MASKED]"

// W data_info zawsze ustawiaj:
is_sensitive: true  // dla danych wrażliwych

// W bounding box detection:
masked: isSensitive  // do późniejszego blurowania na overlay
```

### 8.7 Rate Limiting

```javascript
// Przy batch processing (np. bounding box dla wielu kroków):
await new Promise(resolve => setTimeout(resolve, 300));  // 300ms delay
```

---

## 9. Przykładowy Output

### 9.1 Przykładowa Odpowiedź AI

```json
{
  "processes": [
    {
      "process_id": "proc_login_main",
      "process_name": "User Login Process",
      "process_description": "Complete login flow for web application including credential entry and verification",
      "recording_duration_seconds": 45.5,
      "total_steps": 8,
      "parent_process_id": null,
      "is_main_process": true,
      "video_start_timestamp": "00:00.0",
      "video_end_timestamp": "00:45.5",
      "applications": [
        {
          "name": "Chrome Browser",
          "type": "web_application",
          "url": "https://app.example.com/login"
        }
      ],
      "business_rules_observed": [
        "Password must be at least 8 characters",
        "Account locks after 3 failed attempts"
      ],
      "exceptions_noted": [
        "Invalid credentials error handling"
      ],
      "flow": {
        "nodes": [
          { "node_id": "start", "node_type": "start", "label": "Start" },
          { "node_id": "step_1", "node_type": "action", "step_number": 1 },
          { "node_id": "step_2", "node_type": "action", "step_number": 2 },
          { "node_id": "step_3", "node_type": "action", "step_number": 3 },
          { "node_id": "decision_1", "node_type": "decision", "condition": "Are credentials valid?", "condition_description": "System validates entered username and password" },
          { "node_id": "step_4", "node_type": "action", "step_number": 4 },
          { "node_id": "step_5", "node_type": "action", "step_number": 5 },
          { "node_id": "end_success", "node_type": "end", "end_type": "success", "label": "Login Successful" },
          { "node_id": "end_failure", "node_type": "end", "end_type": "failure", "label": "Login Failed" }
        ],
        "edges": [
          { "edge_id": "e1", "from_node_id": "start", "to_node_id": "step_1" },
          { "edge_id": "e2", "from_node_id": "step_1", "to_node_id": "step_2" },
          { "edge_id": "e3", "from_node_id": "step_2", "to_node_id": "step_3" },
          { "edge_id": "e4", "from_node_id": "step_3", "to_node_id": "decision_1" },
          { "edge_id": "e5", "from_node_id": "decision_1", "to_node_id": "step_4", "label": "TAK", "is_default": true },
          { "edge_id": "e6", "from_node_id": "decision_1", "to_node_id": "step_5", "label": "NIE" },
          { "edge_id": "e7", "from_node_id": "step_4", "to_node_id": "end_success" },
          { "edge_id": "e8", "from_node_id": "step_5", "to_node_id": "end_failure" }
        ]
      },
      "steps": [
        {
          "step_number": 1,
          "timestamp": "00:02.5",
          "flow_node_id": "step_1",
          "action_type": "navigation",
          "specific_action": "navigate_to_url",
          "description": "User navigates to login page at https://app.example.com/login",
          "application": "Chrome Browser",
          "screen_name": "Login Page",
          "screenshot_required": true,
          "notes": "Direct URL entry in address bar"
        },
        {
          "step_number": 2,
          "timestamp": "00:08.3",
          "flow_node_id": "step_2",
          "action_type": "ui_interaction",
          "specific_action": "type",
          "description": "User types username 'john.doe@example.com' in 'Username' field",
          "application": "Chrome Browser",
          "screen_name": "Login Page",
          "screenshot_required": true,
          "ui_element": {
            "element_name": "Username",
            "element_type": "text_field",
            "location_description": "Username input field in the center of login form",
            "screen_region": "middle_center",
            "identifiers": {
              "id": "username",
              "class_name": "form-input"
            }
          },
          "data_info": {
            "value": "john.doe@example.com",
            "data_type": "email",
            "source": "user_input",
            "is_sensitive": false
          }
        },
        {
          "step_number": 3,
          "timestamp": "00:15.7",
          "flow_node_id": "step_3",
          "action_type": "ui_interaction",
          "specific_action": "type",
          "description": "User types password '[MASKED]' in 'Password' field",
          "application": "Chrome Browser",
          "screen_name": "Login Page",
          "screenshot_required": true,
          "ui_element": {
            "element_name": "Password",
            "element_type": "text_field",
            "location_description": "Password input field below username field",
            "screen_region": "middle_center",
            "identifiers": {
              "id": "password",
              "class_name": "form-input"
            }
          },
          "data_info": {
            "value": "[MASKED]",
            "data_type": "password",
            "source": "user_input",
            "is_sensitive": true
          }
        },
        {
          "step_number": 4,
          "timestamp": "00:22.1",
          "flow_node_id": "step_4",
          "action_type": "ui_interaction",
          "specific_action": "click",
          "description": "User clicks 'Sign In' button to submit login form",
          "application": "Chrome Browser",
          "screen_name": "Login Page",
          "screenshot_required": true,
          "ui_element": {
            "element_name": "Sign In",
            "element_type": "button",
            "location_description": "Primary action button below password field",
            "screen_region": "middle_center",
            "identifiers": {
              "id": "submit-btn",
              "class_name": "btn-primary"
            }
          },
          "wait_condition": {
            "wait_type": "page_load",
            "description": "Wait for dashboard to load after successful login",
            "timeout_seconds": 10
          },
          "automation_hint": "Add explicit wait for dashboard element to appear before proceeding"
        },
        {
          "step_number": 5,
          "timestamp": "00:35.0",
          "flow_node_id": "step_5",
          "action_type": "validation",
          "specific_action": "verify_element",
          "description": "System displays error message 'Invalid credentials' on failed login",
          "application": "Chrome Browser",
          "screen_name": "Login Page",
          "screenshot_required": true,
          "ui_element": {
            "element_name": "Error Message",
            "element_type": "notification",
            "location_description": "Red error banner above login form",
            "screen_region": "top_center"
          },
          "notes": "This step only appears on failed login attempt"
        }
      ]
    }
  ]
}
```

---

## 10. Biblioteki i Zależności

### 10.1 Node.js / Backend

```json
{
  "@google/generative-ai": "^0.x.x",      // Gemini SDK (video analysis)
  "@google/genai": "^0.x.x",               // Gemini SDK (bounding box)
  "fluent-ffmpeg": "^2.x.x",               // FFmpeg wrapper
  "@ffmpeg-installer/ffmpeg": "^1.x.x",    // FFmpeg binary
  "jimp": "^1.x.x",                         // Image processing
  "sharp": "^0.x.x"                         // Alternative image processing
}
```

### 10.2 Alternatywne podejścia

- **OpenAI GPT-4 Vision** - może obsługiwać wideo jako sekwencję klatek
- **Azure Computer Vision** - dla bounding box detection
- **AWS Rekognition** - dla analizy wideo
- **Tesseract OCR** - dla ekstrakcji tekstu z screenshotów

---

*Dokument wygenerowany: 2024*
*Wersja: 2.0 (Flowchart-enabled)*
