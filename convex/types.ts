// TypeScript types for PDD Process Documentation
// These types match the JSON schema returned by Gemini

export type ApplicationType =
  | "web_application"
  | "desktop_application"
  | "mobile_application"
  | "terminal"
  | "other";

export interface ApplicationInfo {
  name: string;
  type: ApplicationType;
  url?: string;
  version?: string;
}

export type ElementType =
  | "button"
  | "link"
  | "text_field"
  | "text_area"
  | "dropdown"
  | "combobox"
  | "checkbox"
  | "radio_button"
  | "toggle"
  | "slider"
  | "date_picker"
  | "time_picker"
  | "file_upload"
  | "menu"
  | "menu_item"
  | "tab"
  | "table"
  | "table_row"
  | "table_cell"
  | "tree_view"
  | "tree_node"
  | "list"
  | "list_item"
  | "card"
  | "modal"
  | "dialog"
  | "tooltip"
  | "notification"
  | "icon"
  | "image"
  | "label"
  | "heading"
  | "paragraph"
  | "breadcrumb"
  | "pagination"
  | "search_field"
  | "other";

export type ScreenRegion =
  | "top_left"
  | "top_center"
  | "top_right"
  | "middle_left"
  | "middle_center"
  | "middle_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right"
  | "full_screen";

export interface UIElementIdentifiers {
  id?: string;
  class_name?: string;
  xpath?: string;
  accessibility_id?: string;
}

export interface UIElement {
  element_name: string;
  element_type: ElementType;
  location_description: string;
  screen_region: ScreenRegion;
  parent_element?: string;
  identifiers?: UIElementIdentifiers;
}

export type DataType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "currency"
  | "percentage"
  | "boolean"
  | "email"
  | "phone"
  | "url"
  | "file"
  | "password"
  | "other";

export type DataSource =
  | "user_input"
  | "system_generated"
  | "database"
  | "external_api"
  | "file_import"
  | "calculation"
  | "other";

export interface DataInfo {
  value: string;
  data_type: DataType;
  source: DataSource;
  is_sensitive: boolean;
  format?: string;
  validation_rules?: string[];
}

export type WaitType =
  | "page_load"
  | "element_visible"
  | "element_clickable"
  | "api_response"
  | "file_download"
  | "animation_complete"
  | "manual_trigger"
  | "timeout"
  | "other";

export interface WaitCondition {
  wait_type: WaitType;
  description: string;
  timeout_seconds?: number;
  retry_count?: number;
}

export type ActionType =
  | "ui_interaction"
  | "navigation"
  | "data_transfer"
  | "explanation"
  | "wait"
  | "validation";

export type SpecificAction =
  // UI Interaction
  | "click"
  | "double_click"
  | "right_click"
  | "type"
  | "select"
  | "check"
  | "uncheck"
  | "drag_and_drop"
  | "scroll"
  | "hover"
  // Navigation
  | "navigate_to_url"
  | "open_application"
  | "close_application"
  | "switch_tab"
  | "switch_window"
  | "go_back"
  // Data Transfer
  | "read"
  | "copy"
  | "paste"
  | "download"
  | "upload"
  | "export"
  | "import"
  // Explanation
  | "note"
  | "decision"
  | "business_rule"
  | "exception"
  // Wait
  | "wait_for_element"
  | "wait_for_page"
  | "wait_for_process"
  | "wait_fixed_time"
  // Validation
  | "verify_element"
  | "verify_value"
  | "verify_state";

export interface ProcessStep {
  step_number: number;
  timestamp: string;
  action_type: ActionType;
  specific_action: SpecificAction;
  description: string;
  application: string;
  screen_name: string;
  screenshot_required: boolean;
  ui_element?: UIElement;
  data_info?: DataInfo;
  wait_condition?: WaitCondition;
  notes?: string;
  automation_hint?: string;
}

export interface ProcessMetadata {
  process_name: string;
  process_description: string;
  recording_duration_seconds: number;
  total_steps: number;
  applications: ApplicationInfo[];
  business_rules_observed?: string[];
  exceptions_noted?: string[];
}

export interface PDDProcessDocumentation {
  process_metadata: ProcessMetadata;
  steps: ProcessStep[];
}

// ============================================
// FLOWCHART TYPES (V2)
// ============================================

// Flow node types
export type FlowNodeType =
  | "start"
  | "end"
  | "action"
  | "decision"
  | "switch"
  | "merge"
  | "subprocess"
  | "loop_back";

// End node types
export type EndType =
  | "success"
  | "failure"
  | "cancelled"
  | "exception";

// Edge types
export type EdgeType =
  | "normal"
  | "exception"
  | "timeout"
  | "loop";

// Flow node (snake_case - from Gemini)
export interface FlowNode {
  node_id: string;
  node_type: FlowNodeType;
  step_number?: number;           // For action nodes
  condition?: string;             // For decision/switch nodes
  condition_description?: string;
  subprocess_id?: string;         // For subprocess nodes
  end_type?: EndType;             // For end nodes
  label?: string;
  position?: {
    x: number;
    y: number;
  };
}

// Flow edge (snake_case - from Gemini)
export interface FlowEdge {
  edge_id: string;
  from_node_id: string;
  to_node_id: string;
  label?: string;
  condition?: string;
  edge_type?: EdgeType;
  is_default?: boolean;
}

// Process flow structure (snake_case - from Gemini)
export interface ProcessFlow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Extended step with flow node reference (snake_case - from Gemini)
export interface ProcessStepV2 extends ProcessStep {
  flow_node_id?: string;
}

// Extended process metadata (snake_case - from Gemini)
export interface ProcessMetadataV2 extends ProcessMetadata {
  process_id?: string;
  parent_process_id?: string;
  is_main_process?: boolean;
  video_start_timestamp?: string;
  video_end_timestamp?: string;
}

// Single process with flow (snake_case - from Gemini)
export interface ProcessWithFlow {
  process_id: string;
  process_name: string;
  process_description: string;
  recording_duration_seconds: number;
  total_steps: number;
  applications: ApplicationInfo[];
  business_rules_observed?: string[];
  exceptions_noted?: string[];
  parent_process_id?: string | null;
  is_main_process?: boolean;
  video_start_timestamp?: string;
  video_end_timestamp?: string;
  flow: ProcessFlow;
  steps: ProcessStepV2[];
}

// Analysis result with multiple processes (snake_case - from Gemini)
export interface PDDAnalysisResultV2 {
  analysis_metadata?: {
    video_duration_seconds: number;
    processes_count: number;
    has_decision_points: boolean;
    has_subprocesses: boolean;
  };
  processes: ProcessWithFlow[];
}

// ============================================
// CAMELCASE TYPES (for database storage)
// ============================================

// Flow node (camelCase - for DB)
export interface FlowNodeDB {
  nodeId: string;
  nodeType: FlowNodeType;
  stepNumber?: number;
  condition?: string;
  conditionDescription?: string;
  subprocessId?: string;
  endType?: EndType;
  label?: string;
  position?: {
    x: number;
    y: number;
  };
}

// Flow edge (camelCase - for DB)
export interface FlowEdgeDB {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  condition?: string;
  edgeType?: EdgeType;
  isDefault?: boolean;
}

// Process flow (camelCase - for DB)
export interface ProcessFlowDB {
  processId: string;
  nodes: FlowNodeDB[];
  edges: FlowEdgeDB[];
  createdAt: number;
  updatedAt?: number;
}

// Parse timestamp from MM:SS.s format to seconds
export function parseTimestamp(timestamp: string): number {
  // Handle formats like "00:05.2", "01:30.0", "1:30", "05.2"
  const parts = timestamp.split(':');

  if (parts.length === 2) {
    // MM:SS.s format
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    // Just seconds (SS.s)
    return parseFloat(parts[0]) || 0;
  }

  return 0;
}

// Helper function to convert snake_case to camelCase for database storage
export function convertToCamelCase(pdd: PDDProcessDocumentation): {
  processName: string;
  processDescription: string;
  recordingDurationSeconds: number;
  totalSteps: number;
  applications: Array<{
    name: string;
    type: string;
    url?: string;
    version?: string;
  }>;
  businessRulesObserved?: string[];
  exceptionsNoted?: string[];
  steps: Array<{
    stepNumber: number;
    timestamp: string;
    actionType: string;
    specificAction: string;
    description: string;
    application: string;
    screenName: string;
    screenshotRequired: boolean;
    uiElement?: {
      elementName: string;
      elementType: string;
      locationDescription: string;
      screenRegion: string;
      parentElement?: string;
      identifiers?: {
        id?: string;
        className?: string;
        xpath?: string;
        accessibilityId?: string;
      };
    };
    dataInfo?: {
      value: string;
      dataType: string;
      source: string;
      isSensitive: boolean;
      format?: string;
      validationRules?: string[];
    };
    waitCondition?: {
      waitType: string;
      description: string;
      timeoutSeconds?: number;
      retryCount?: number;
    };
    notes?: string;
    automationHint?: string;
  }>;
} {
  return {
    processName: pdd.process_metadata.process_name,
    processDescription: pdd.process_metadata.process_description,
    recordingDurationSeconds: pdd.process_metadata.recording_duration_seconds,
    totalSteps: pdd.process_metadata.total_steps,
    applications: pdd.process_metadata.applications.map(app => ({
      name: app.name,
      type: app.type,
      url: app.url,
      version: app.version,
    })),
    businessRulesObserved: pdd.process_metadata.business_rules_observed,
    exceptionsNoted: pdd.process_metadata.exceptions_noted,
    steps: pdd.steps.map(step => ({
      stepNumber: step.step_number,
      timestamp: step.timestamp,
      actionType: step.action_type,
      specificAction: step.specific_action,
      description: step.description,
      application: step.application,
      screenName: step.screen_name,
      screenshotRequired: step.screenshot_required,
      uiElement: step.ui_element ? {
        elementName: step.ui_element.element_name,
        elementType: step.ui_element.element_type,
        locationDescription: step.ui_element.location_description,
        screenRegion: step.ui_element.screen_region,
        parentElement: step.ui_element.parent_element,
        identifiers: step.ui_element.identifiers ? {
          id: step.ui_element.identifiers.id,
          className: step.ui_element.identifiers.class_name,
          xpath: step.ui_element.identifiers.xpath,
          accessibilityId: step.ui_element.identifiers.accessibility_id,
        } : undefined,
      } : undefined,
      dataInfo: step.data_info ? {
        value: step.data_info.value,
        dataType: step.data_info.data_type,
        source: step.data_info.source,
        isSensitive: step.data_info.is_sensitive,
        format: step.data_info.format,
        validationRules: step.data_info.validation_rules,
      } : undefined,
      waitCondition: step.wait_condition ? {
        waitType: step.wait_condition.wait_type,
        description: step.wait_condition.description,
        timeoutSeconds: step.wait_condition.timeout_seconds,
        retryCount: step.wait_condition.retry_count,
      } : undefined,
      notes: step.notes,
      automationHint: step.automation_hint,
    })),
  };
}

// ============================================
// FLOWCHART CONVERSION FUNCTIONS
// ============================================

// Convert flow node from snake_case to camelCase
export function convertFlowNodeToCamelCase(node: FlowNode): FlowNodeDB {
  return {
    nodeId: node.node_id,
    nodeType: node.node_type,
    stepNumber: node.step_number,
    condition: node.condition,
    conditionDescription: node.condition_description,
    subprocessId: node.subprocess_id,
    endType: node.end_type,
    label: node.label,
    position: node.position,
  };
}

// Convert flow edge from snake_case to camelCase
export function convertFlowEdgeToCamelCase(edge: FlowEdge): FlowEdgeDB {
  return {
    edgeId: edge.edge_id,
    fromNodeId: edge.from_node_id,
    toNodeId: edge.to_node_id,
    label: edge.label,
    condition: edge.condition,
    edgeType: edge.edge_type,
    isDefault: edge.is_default,
  };
}

// Convert process flow from snake_case to camelCase
export function convertFlowToCamelCase(flow: ProcessFlow): { nodes: FlowNodeDB[]; edges: FlowEdgeDB[] } {
  return {
    nodes: flow.nodes.map(convertFlowNodeToCamelCase),
    edges: flow.edges.map(convertFlowEdgeToCamelCase),
  };
}

// Convert entire ProcessWithFlow to camelCase for database storage
export function convertProcessWithFlowToCamelCase(process: ProcessWithFlow): {
  processId: string;
  processName: string;
  processDescription: string;
  recordingDurationSeconds: number;
  totalSteps: number;
  applications: Array<{
    name: string;
    type: string;
    url?: string;
    version?: string;
  }>;
  businessRulesObserved?: string[];
  exceptionsNoted?: string[];
  parentProcessId?: string | null;
  isMainProcess?: boolean;
  videoStartTimestamp?: string;
  videoEndTimestamp?: string;
  flow: { nodes: FlowNodeDB[]; edges: FlowEdgeDB[] };
  steps: Array<{
    stepNumber: number;
    timestamp: string;
    actionType: string;
    specificAction: string;
    description: string;
    application: string;
    screenName: string;
    screenshotRequired: boolean;
    flowNodeId?: string;
    uiElement?: {
      elementName: string;
      elementType: string;
      locationDescription: string;
      screenRegion: string;
      parentElement?: string;
      identifiers?: {
        id?: string;
        className?: string;
        xpath?: string;
        accessibilityId?: string;
      };
    };
    dataInfo?: {
      value: string;
      dataType: string;
      source: string;
      isSensitive: boolean;
      format?: string;
      validationRules?: string[];
    };
    waitCondition?: {
      waitType: string;
      description: string;
      timeoutSeconds?: number;
      retryCount?: number;
    };
    notes?: string;
    automationHint?: string;
  }>;
} {
  return {
    processId: process.process_id,
    processName: process.process_name,
    processDescription: process.process_description,
    recordingDurationSeconds: process.recording_duration_seconds,
    totalSteps: process.total_steps,
    applications: process.applications.map(app => ({
      name: app.name,
      type: app.type,
      url: app.url,
      version: app.version,
    })),
    businessRulesObserved: process.business_rules_observed,
    exceptionsNoted: process.exceptions_noted,
    parentProcessId: process.parent_process_id,
    isMainProcess: process.is_main_process,
    videoStartTimestamp: process.video_start_timestamp,
    videoEndTimestamp: process.video_end_timestamp,
    flow: convertFlowToCamelCase(process.flow),
    steps: process.steps.map(step => ({
      stepNumber: step.step_number,
      timestamp: step.timestamp,
      actionType: step.action_type,
      specificAction: step.specific_action,
      description: step.description,
      application: step.application,
      screenName: step.screen_name,
      screenshotRequired: step.screenshot_required,
      flowNodeId: step.flow_node_id,
      uiElement: step.ui_element ? {
        elementName: step.ui_element.element_name,
        elementType: step.ui_element.element_type,
        locationDescription: step.ui_element.location_description,
        screenRegion: step.ui_element.screen_region,
        parentElement: step.ui_element.parent_element,
        identifiers: step.ui_element.identifiers ? {
          id: step.ui_element.identifiers.id,
          className: step.ui_element.identifiers.class_name,
          xpath: step.ui_element.identifiers.xpath,
          accessibilityId: step.ui_element.identifiers.accessibility_id,
        } : undefined,
      } : undefined,
      dataInfo: step.data_info ? {
        value: step.data_info.value,
        dataType: step.data_info.data_type,
        source: step.data_info.source,
        isSensitive: step.data_info.is_sensitive,
        format: step.data_info.format,
        validationRules: step.data_info.validation_rules,
      } : undefined,
      waitCondition: step.wait_condition ? {
        waitType: step.wait_condition.wait_type,
        description: step.wait_condition.description,
        timeoutSeconds: step.wait_condition.timeout_seconds,
        retryCount: step.wait_condition.retry_count,
      } : undefined,
      notes: step.notes,
      automationHint: step.automation_hint,
    })),
  };
}

// Generate a simple linear flow from steps (for migration/backward compatibility)
export function generateLinearFlow(steps: Array<{ stepNumber: number }>): ProcessFlow {
  const nodes: FlowNode[] = [
    { node_id: "start", node_type: "start", label: "Start" },
  ];

  const edges: FlowEdge[] = [];

  // Add action nodes for each step
  steps.forEach((step, index) => {
    const nodeId = `step_${step.stepNumber}`;
    nodes.push({
      node_id: nodeId,
      node_type: "action",
      step_number: step.stepNumber,
    });

    // Connect to previous node
    const prevNodeId = index === 0 ? "start" : `step_${steps[index - 1].stepNumber}`;
    edges.push({
      edge_id: `edge_${prevNodeId}_${nodeId}`,
      from_node_id: prevNodeId,
      to_node_id: nodeId,
    });
  });

  // Add end node
  const endNodeId = "end_success";
  nodes.push({
    node_id: endNodeId,
    node_type: "end",
    end_type: "success",
    label: "End",
  });

  // Connect last step to end
  if (steps.length > 0) {
    const lastStepId = `step_${steps[steps.length - 1].stepNumber}`;
    edges.push({
      edge_id: `edge_${lastStepId}_${endNodeId}`,
      from_node_id: lastStepId,
      to_node_id: endNodeId,
    });
  } else {
    // No steps, connect start directly to end
    edges.push({
      edge_id: "edge_start_end",
      from_node_id: "start",
      to_node_id: endNodeId,
    });
  }

  return { nodes, edges };
}
