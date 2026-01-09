import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Application types
const applicationTypeValidator = v.union(
  v.literal("web_application"),
  v.literal("desktop_application"),
  v.literal("mobile_application"),
  v.literal("terminal"),
  v.literal("other")
);

// Application info validator
const applicationValidator = v.object({
  name: v.string(),
  type: applicationTypeValidator,
  url: v.optional(v.string()),
  version: v.optional(v.string()),
});

// All 37 UI element types as specified
const elementTypeValidator = v.union(
  v.literal("button"),
  v.literal("link"),
  v.literal("text_field"),
  v.literal("text_area"),
  v.literal("dropdown"),
  v.literal("combobox"),
  v.literal("checkbox"),
  v.literal("radio_button"),
  v.literal("toggle"),
  v.literal("slider"),
  v.literal("date_picker"),
  v.literal("time_picker"),
  v.literal("file_upload"),
  v.literal("menu"),
  v.literal("menu_item"),
  v.literal("tab"),
  v.literal("table"),
  v.literal("table_row"),
  v.literal("table_cell"),
  v.literal("tree_view"),
  v.literal("tree_node"),
  v.literal("list"),
  v.literal("list_item"),
  v.literal("card"),
  v.literal("modal"),
  v.literal("dialog"),
  v.literal("tooltip"),
  v.literal("notification"),
  v.literal("icon"),
  v.literal("image"),
  v.literal("label"),
  v.literal("heading"),
  v.literal("paragraph"),
  v.literal("breadcrumb"),
  v.literal("pagination"),
  v.literal("search_field"),
  v.literal("other")
);

// Screen region validator (9-zone grid + other)
const screenRegionValidator = v.union(
  v.literal("top_left"),
  v.literal("top_center"),
  v.literal("top_right"),
  v.literal("middle_left"),
  v.literal("middle_center"),
  v.literal("middle_right"),
  v.literal("bottom_left"),
  v.literal("bottom_center"),
  v.literal("bottom_right"),
  v.literal("full_screen")
);

// UI element validator
const uiElementValidator = v.object({
  elementName: v.string(),
  elementType: elementTypeValidator,
  locationDescription: v.string(),
  screenRegion: screenRegionValidator,
  parentElement: v.optional(v.string()),
  identifiers: v.optional(v.object({
    id: v.optional(v.string()),
    className: v.optional(v.string()),
    xpath: v.optional(v.string()),
    accessibilityId: v.optional(v.string()),
  })),
});

// Data type validator
const dataTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("date"),
  v.literal("datetime"),
  v.literal("currency"),
  v.literal("percentage"),
  v.literal("boolean"),
  v.literal("email"),
  v.literal("phone"),
  v.literal("url"),
  v.literal("file"),
  v.literal("password"),
  v.literal("other")
);

// Data source validator
const dataSourceValidator = v.union(
  v.literal("user_input"),
  v.literal("system_generated"),
  v.literal("database"),
  v.literal("external_api"),
  v.literal("file_import"),
  v.literal("calculation"),
  v.literal("other")
);

// Data info validator
const dataInfoValidator = v.object({
  value: v.string(),
  dataType: dataTypeValidator,
  source: dataSourceValidator,
  isSensitive: v.boolean(),
  format: v.optional(v.string()),
  validationRules: v.optional(v.array(v.string())),
});

// Wait type validator
const waitTypeValidator = v.union(
  v.literal("page_load"),
  v.literal("element_visible"),
  v.literal("element_clickable"),
  v.literal("api_response"),
  v.literal("file_download"),
  v.literal("animation_complete"),
  v.literal("manual_trigger"),
  v.literal("timeout"),
  v.literal("other")
);

// Wait condition validator
const waitConditionValidator = v.object({
  waitType: waitTypeValidator,
  description: v.string(),
  timeoutSeconds: v.optional(v.number()),
  retryCount: v.optional(v.number()),
});

// Action type validator (6 main categories)
const actionTypeValidator = v.union(
  v.literal("ui_interaction"),
  v.literal("navigation"),
  v.literal("data_transfer"),
  v.literal("explanation"),
  v.literal("wait"),
  v.literal("validation")
);

// Specific action validator (34 specific actions)
const specificActionValidator = v.union(
  // UI Interaction (10)
  v.literal("click"),
  v.literal("double_click"),
  v.literal("right_click"),
  v.literal("type"),
  v.literal("select"),
  v.literal("check"),
  v.literal("uncheck"),
  v.literal("drag_and_drop"),
  v.literal("scroll"),
  v.literal("hover"),
  // Navigation (6)
  v.literal("navigate_to_url"),
  v.literal("open_application"),
  v.literal("close_application"),
  v.literal("switch_tab"),
  v.literal("switch_window"),
  v.literal("go_back"),
  // Data Transfer (7)
  v.literal("read"),
  v.literal("copy"),
  v.literal("paste"),
  v.literal("download"),
  v.literal("upload"),
  v.literal("export"),
  v.literal("import"),
  // Explanation (4)
  v.literal("note"),
  v.literal("decision"),
  v.literal("business_rule"),
  v.literal("exception"),
  // Wait (4)
  v.literal("wait_for_element"),
  v.literal("wait_for_page"),
  v.literal("wait_for_process"),
  v.literal("wait_fixed_time"),
  // Validation (3)
  v.literal("verify_element"),
  v.literal("verify_value"),
  v.literal("verify_state")
);

// ============================================
// FLOWCHART VALIDATORS
// ============================================

// Flow node types for flowchart visualization
const flowNodeTypeValidator = v.union(
  v.literal("start"),           // Entry point
  v.literal("end"),             // Exit point (success/failure/cancelled)
  v.literal("action"),          // Regular step (links to step)
  v.literal("decision"),        // Binary decision (if/else)
  v.literal("switch"),          // Multi-way decision (switch/case)
  v.literal("merge"),           // Convergence point
  v.literal("subprocess"),      // Reference to nested process
  v.literal("loop_back")        // Return to earlier node
);

// End node types
const endTypeValidator = v.union(
  v.literal("success"),
  v.literal("failure"),
  v.literal("cancelled"),
  v.literal("exception")
);

// Edge types for flowchart connections
const edgeTypeValidator = v.union(
  v.literal("normal"),          // Standard flow
  v.literal("exception"),       // Exception path
  v.literal("timeout"),         // Timeout path
  v.literal("loop")             // Loop back
);

// Flow node validator
const flowNodeValidator = v.object({
  nodeId: v.string(),
  nodeType: flowNodeTypeValidator,
  // For action nodes - link to step
  stepNumber: v.optional(v.number()),
  // For decision/switch nodes
  condition: v.optional(v.string()),
  conditionDescription: v.optional(v.string()),
  // For subprocess nodes
  subprocessId: v.optional(v.string()),
  // For end nodes
  endType: v.optional(endTypeValidator),
  // Display
  label: v.optional(v.string()),
  // Position (optional, for manual layout)
  position: v.optional(v.object({
    x: v.number(),
    y: v.number(),
  })),
});

// Flow edge validator
const flowEdgeValidator = v.object({
  edgeId: v.string(),
  fromNodeId: v.string(),
  toNodeId: v.string(),
  // For edges from decision/switch nodes
  label: v.optional(v.string()),
  condition: v.optional(v.string()),
  edgeType: v.optional(edgeTypeValidator),
  isDefault: v.optional(v.boolean()),
});

// ============================================
// SENSITIVE INFORMATION DETECTION VALIDATORS
// ============================================

// Sensitive information bounding box validator
const sensitiveInfoBoxValidator = v.object({
  label: v.string(),              // Type of sensitive info (e.g., "SSN", "Credit Card Number")
  box_2d: v.array(v.number()),    // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: v.boolean(),
  confidence: v.optional(v.number()), // AI confidence score 0-1
});

// Crop coordinates validator (normalized 0-1000 like bounding boxes)
const cropCoordinatesValidator = v.object({
  x: v.number(),      // Left edge (0-1000)
  y: v.number(),      // Top edge (0-1000)
  width: v.number(),  // Width (0-1000)
  height: v.number(), // Height (0-1000)
});

export default defineSchema({
  // Settings table - stores application settings (like API keys)
  settings: defineTable({
    key: v.string(),       // Setting key (e.g., "gemini_api_key")
    value: v.string(),     // Setting value (encrypted for sensitive data)
    isSecret: v.boolean(), // Whether value should be masked in responses
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Jobs table - tracks video analysis jobs
  jobs: defineTable({
    videoStorageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    rawAiResponse: v.optional(v.string()),
    processId: v.optional(v.id("processes")),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Analysis options (checkboxes from upload form)
    autoExtractScreenshots: v.optional(v.boolean()), // Auto-extract screenshots from video
    autoBoundingBoxes: v.optional(v.boolean()), // Auto-detect UI element bounding boxes
    autoSensitiveInfo: v.optional(v.boolean()), // Auto-detect sensitive information
    sensitiveInfoPrompt: v.optional(v.string()), // Prompt for sensitive info detection
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"])
    .searchIndex("search_filename", {
      searchField: "fileName",
    }),

  // Processes table - stores completed PDD analysis results (metadata only)
  processes: defineTable({
    jobId: v.id("jobs"),
    processName: v.string(),
    processDescription: v.string(),
    recordingDurationSeconds: v.number(),
    totalSteps: v.number(),
    applications: v.array(applicationValidator),
    businessRulesObserved: v.optional(v.array(v.string())),
    exceptionsNoted: v.optional(v.array(v.string())),
    createdAt: v.number(),

    // NEW: Hierarchy support for subprocesses
    parentProcessId: v.optional(v.id("processes")),  // null for top-level process
    hierarchyLevel: v.optional(v.number()),          // 1-5, depth in hierarchy
    isMainProcess: v.optional(v.boolean()),          // true for the primary process from video

    // NEW: Video timestamp range (for multiple processes from one video)
    videoStartTimestamp: v.optional(v.string()),
    videoEndTimestamp: v.optional(v.string()),

    // NEW: Visual styling
    colorIndex: v.optional(v.number()),              // 0-7, for subprocess coloring

    // NEW: Flow metadata (for collapsed view)
    nodeCount: v.optional(v.number()),
    decisionCount: v.optional(v.number()),
    subprocessCount: v.optional(v.number()),

    // NEW: Sensitive information detection prompt
    sensitiveInfoPrompt: v.optional(v.string()), // User-defined definition of sensitive info

    // NEW: UI element detection prompt
    boundingBoxPrompt: v.optional(v.string()), // User-defined prompt for UI element detection

    // NEW: Model selection for AI detection tasks
    uiElementDetectionModel: v.optional(v.string()), // Model for UI element detection (default: gemini-2.5-flash)
    sensitiveInfoDetectionModel: v.optional(v.string()), // Model for sensitive info detection (default: gemini-2.5-flash)

    // DEPRECATED: Old schema had embedded steps - kept for backward compatibility during migration
    steps: v.optional(v.any()),
  })
    .index("by_job", ["jobId"])
    .index("by_parent", ["parentProcessId"])
    .searchIndex("search_process", {
      searchField: "processName",
    }),

  // Steps table - individual process steps with screenshots
  steps: defineTable({
    processId: v.id("processes"),
    stepNumber: v.number(),
    timestamp: v.string(),
    timestampSeconds: v.number(), // For screenshot extraction
    actionType: actionTypeValidator,
    specificAction: specificActionValidator,
    description: v.string(),
    application: v.string(),
    screenName: v.string(),
    screenshotRequired: v.boolean(),
    screenshotStorageId: v.optional(v.id("_storage")), // Screenshot image
    uiElement: v.optional(uiElementValidator),
    dataInfo: v.optional(dataInfoValidator),
    waitCondition: v.optional(waitConditionValidator),
    notes: v.optional(v.string()),
    automationHint: v.optional(v.string()),
    // Bounding box for the specific UI element in this step
    boundingBox: v.optional(v.object({
      label: v.string(),
      box_2d: v.array(v.number()), // [ymin, xmin, ymax, xmax] normalized 0-1000
      found: v.boolean(),
      masked: v.boolean(), // If true, contains sensitive data - should be blurred
    })),
    boundingBoxDetected: v.optional(v.boolean()), // Flag to track if detection was run
    overlayImageStorageId: v.optional(v.id("_storage")), // Screenshot with bounding box overlay

    // NEW: Sensitive information bounding boxes (array of multiple boxes per step)
    sensitiveInfoBoxes: v.optional(v.array(sensitiveInfoBoxValidator)), // Array of detected sensitive information areas
    sensitiveInfoDetected: v.optional(v.boolean()), // Flag to track if sensitive info detection was run

    // NEW: Link to flowchart node
    flowNodeId: v.optional(v.string()),

    // NEW: Crop coordinates for non-destructive cropping (coordinates stored, not a new image)
    cropCoordinates: v.optional(cropCoordinatesValidator),

    // DEPRECATED: Old fields for backward compatibility - will be removed
    boundingBoxes: v.optional(v.any()),
    boundingBoxesDetected: v.optional(v.boolean()),
  })
    .index("by_process", ["processId"])
    .index("by_process_step", ["processId", "stepNumber"]),

  // Process Flows table - stores flowchart structure (nodes and edges)
  processFlows: defineTable({
    processId: v.id("processes"),
    nodes: v.array(flowNodeValidator),
    edges: v.array(flowEdgeValidator),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_process", ["processId"]),

  // AI Workflows table - stores reusable AI workflow definitions
  workflows: defineTable({
    // Basic info
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()), // e.g., "video_analysis", "document_processing", "custom"
    isDefault: v.optional(v.boolean()), // Mark as default workflow for a category

    // Workflow steps (multi-step reasoning)
    steps: v.array(v.object({
      stepId: v.string(),
      name: v.string(),
      description: v.optional(v.string()),

      // Model configuration
      model: v.string(), // e.g., "gemini-2.5-flash", "gemini-2.5-pro"

      // Input configuration
      input: v.object({
        type: v.union(
          v.literal("video"),
          v.literal("image"),
          v.literal("text"),
          v.literal("previous_step"), // Output from previous step
          v.literal("combined") // Multiple inputs combined
        ),
        sources: v.optional(v.array(v.string())), // Step IDs for combined input
        includeVideo: v.optional(v.boolean()),
        includeScreenshots: v.optional(v.boolean()),
      }),

      // Prompt configuration
      systemPrompt: v.string(),
      userPrompt: v.string(),

      // Output configuration
      output: v.object({
        type: v.union(
          v.literal("json"),
          v.literal("text"),
          v.literal("structured")
        ),
        schema: v.optional(v.string()), // JSON schema as string for structured output
        variableName: v.optional(v.string()), // Name to reference this output in later steps
      }),

      // Processing options
      options: v.optional(v.object({
        maxOutputTokens: v.optional(v.number()),
        temperature: v.optional(v.number()),
        enableThinking: v.optional(v.boolean()), // For Gemini 3 thinking mode
        thinkingEffort: v.optional(v.union(  // Thinking effort level for Gemini 3
          v.literal("minimal"),  // Flash only
          v.literal("low"),      // Pro: basic, Flash: quick
          v.literal("medium"),   // Flash only
          v.literal("high")      // Pro: deep, Flash: thorough
        )),
        thinkingBudget: v.optional(v.number()), // Token budget for thinking (deprecated)
      })),

      // Conditional execution
      condition: v.optional(v.string()), // Expression to evaluate (e.g., "step1.success === true")
    })),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    version: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_default", ["isDefault"])
    .searchIndex("search_workflow", {
      searchField: "name",
    }),

  // Workflow Runs table - stores execution history
  workflowRuns: defineTable({
    workflowId: v.id("workflows"),
    processId: v.optional(v.id("processes")), // Process being analyzed (if applicable)
    jobId: v.optional(v.id("jobs")), // Job being processed (if applicable)

    // Execution status
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),

    // Step execution details
    stepResults: v.array(v.object({
      stepId: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("skipped")
      ),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      output: v.optional(v.string()), // JSON stringified output
      error: v.optional(v.string()),
      tokensUsed: v.optional(v.number()),
    })),

    // Overall metrics
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_process", ["processId"])
    .index("by_status", ["status"]),

  // API Logs table - tracks AI calls and costs
  apiLogs: defineTable({
    timestamp: v.number(),
    model: v.string(),
    category: v.string(), // "video_analysis", "bounding_boxes", "sensitive_info", "workflow", etc.
    source: v.string(),   // e.g., "analyze.ts", "boundingBoxes.ts"
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.number(),      // Final calculated cost in USD
    durationMs: v.number(), // Call duration in milliseconds
    status: v.union(v.literal("success"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    processId: v.optional(v.id("processes")), // Link to process if applicable
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_category", ["category"])
    .index("by_process", ["processId"]),
});

// Export validators for use in other files
export {
  applicationValidator,
  uiElementValidator,
  dataInfoValidator,
  waitConditionValidator,
  actionTypeValidator,
  specificActionValidator,
  elementTypeValidator,
  screenRegionValidator,
  dataTypeValidator,
  dataSourceValidator,
  waitTypeValidator,
  // Flowchart validators
  flowNodeTypeValidator,
  flowNodeValidator,
  flowEdgeValidator,
  edgeTypeValidator,
  endTypeValidator,
  // Sensitive information validators
  sensitiveInfoBoxValidator,
  // Crop coordinates validator
  cropCoordinatesValidator,
};
