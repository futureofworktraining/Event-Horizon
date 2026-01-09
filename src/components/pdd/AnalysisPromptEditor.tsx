"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileText,
  Code,
  Workflow,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Play,
  ChevronDown,
  ChevronUp,
  Cpu,
  Settings,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
} from "lucide-react";

// Types
interface WorkflowStep {
  stepId: string;
  name: string;
  description?: string;
  model: string;
  input: {
    type: "video" | "image" | "text" | "previous_step" | "combined";
    sources?: string[];
    includeVideo?: boolean;
    includeScreenshots?: boolean;
  };
  systemPrompt: string;
  userPrompt: string;
  output: {
    type: "json" | "text" | "structured";
    schema?: string;
    variableName?: string;
  };
  options?: {
    maxOutputTokens?: number;
    temperature?: number;
    enableThinking?: boolean;
    thinkingEffort?: "minimal" | "low" | "medium" | "high";
    thinkingBudget?: number;
  };
  condition?: string;
}

interface Workflow {
  _id: Id<"workflows">;
  name: string;
  description?: string;
  category?: string;
  isDefault?: boolean;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt?: number;
  version?: number;
}

interface GeminiModel {
  id: string;
  name: string;
  description: string;
  category: string;
  supportsVideo: boolean;
  supportsThinking: boolean;
  thinkingEffortLevels?: string[];
  defaultThinkingEffort?: string | null;
}

// Default prompts
const DEFAULT_SYSTEM_PROMPT = `You are an expert RPA (Robotic Process Automation) Business Analyst specializing in creating Process Design Documents (PDD) from screen recordings. Your task is to analyze a video of a business process and extract detailed, structured documentation with FLOWCHART representation that can be used for automation development.

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
- full_screen (for modals, overlays)`;

const DEFAULT_USER_PROMPT = `Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

Watch the entire video carefully and document:
1. **All User Actions** - clicks, typing, selections, scrolling, drag-drop
2. **All System Responses** - page loads, popups, notifications, errors
3. **Decision Points** - any branching logic, conditions, choices
4. **Waiting Periods** - loading, processing, delays
5. **Subprocesses** - distinct reusable sequences (login, payment, etc.)

Return ONLY valid JSON matching the schema.`;

const DEFAULT_SCHEMA = `{
  "type": "object",
  "properties": {
    "processes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "process_id": { "type": "string" },
          "process_name": { "type": "string" },
          "process_description": { "type": "string" },
          "recording_duration_seconds": { "type": "number" },
          "total_steps": { "type": "number" },
          "parent_process_id": { "type": "string" },
          "is_main_process": { "type": "boolean" },
          "video_start_timestamp": { "type": "string" },
          "video_end_timestamp": { "type": "string" },
          "applications": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "type": {
                  "type": "string",
                  "enum": ["web_application", "desktop_application", "mobile_application", "terminal", "other"]
                },
                "url": { "type": "string" },
                "version": { "type": "string" }
              },
              "required": ["name", "type"]
            }
          },
          "business_rules_observed": {
            "type": "array",
            "items": { "type": "string" }
          },
          "exceptions_noted": {
            "type": "array",
            "items": { "type": "string" }
          },
          "flow": {
            "type": "object",
            "properties": {
              "nodes": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "node_id": { "type": "string" },
                    "node_type": {
                      "type": "string",
                      "enum": ["start", "end", "action", "decision", "switch", "merge", "subprocess", "loop_back"]
                    },
                    "step_number": { "type": "number" },
                    "condition": { "type": "string" },
                    "condition_description": { "type": "string" },
                    "subprocess_id": { "type": "string" },
                    "end_type": {
                      "type": "string",
                      "enum": ["success", "failure", "cancelled", "exception"]
                    },
                    "label": { "type": "string" }
                  },
                  "required": ["node_id", "node_type"]
                }
              },
              "edges": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "edge_id": { "type": "string" },
                    "from_node_id": { "type": "string" },
                    "to_node_id": { "type": "string" },
                    "label": { "type": "string" },
                    "condition": { "type": "string" },
                    "edge_type": {
                      "type": "string",
                      "enum": ["normal", "exception", "timeout", "loop"]
                    },
                    "is_default": { "type": "boolean" }
                  },
                  "required": ["edge_id", "from_node_id", "to_node_id"]
                }
              }
            },
            "required": ["nodes", "edges"]
          },
          "steps": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "step_number": { "type": "number" },
                "timestamp": { "type": "string" },
                "flow_node_id": { "type": "string" },
                "action_type": {
                  "type": "string",
                  "enum": ["ui_interaction", "navigation", "data_transfer", "explanation", "wait", "validation"]
                },
                "specific_action": {
                  "type": "string",
                  "enum": [
                    "click", "double_click", "right_click", "type", "select", "check", "uncheck",
                    "drag_and_drop", "scroll", "hover", "navigate_to_url", "open_application",
                    "close_application", "switch_tab", "switch_window", "go_back", "read", "copy",
                    "paste", "download", "upload", "export", "import", "note", "decision",
                    "business_rule", "exception", "wait_for_element", "wait_for_page",
                    "wait_for_process", "wait_fixed_time", "verify_element", "verify_value", "verify_state"
                  ]
                },
                "description": { "type": "string" },
                "application": { "type": "string" },
                "screen_name": { "type": "string" },
                "screenshot_required": { "type": "boolean" },
                "ui_element": {
                  "type": "object",
                  "properties": {
                    "element_name": { "type": "string" },
                    "element_type": {
                      "type": "string",
                      "enum": [
                        "button", "link", "text_field", "text_area", "dropdown", "combobox",
                        "checkbox", "radio_button", "toggle", "slider", "date_picker", "time_picker",
                        "file_upload", "menu", "menu_item", "tab", "table", "table_row", "table_cell",
                        "tree_view", "tree_node", "list", "list_item", "card", "modal", "dialog",
                        "tooltip", "notification", "icon", "image", "label", "heading", "paragraph",
                        "breadcrumb", "pagination", "search_field", "other"
                      ]
                    },
                    "location_description": { "type": "string" },
                    "screen_region": {
                      "type": "string",
                      "enum": [
                        "top_left", "top_center", "top_right", "middle_left", "middle_center",
                        "middle_right", "bottom_left", "bottom_center", "bottom_right", "full_screen"
                      ]
                    },
                    "parent_element": { "type": "string" },
                    "identifiers": {
                      "type": "object",
                      "properties": {
                        "id": { "type": "string" },
                        "class_name": { "type": "string" },
                        "xpath": { "type": "string" },
                        "accessibility_id": { "type": "string" }
                      }
                    }
                  },
                  "required": ["element_name", "element_type", "location_description", "screen_region"]
                }
              },
              "required": ["step_number", "timestamp", "flow_node_id", "action_type", "specific_action", "description", "application", "screen_name", "screenshot_required"]
            }
          }
        },
        "required": ["process_id", "process_name", "process_description", "flow", "steps"]
      }
    }
  },
  "required": ["processes"]
}`;

interface AnalysisPromptEditorProps {
  jobId?: string;
  processId?: string;
  onSave?: () => void;
}

export function AnalysisPromptEditor({ jobId, processId, onSave }: AnalysisPromptEditorProps) {
  const [activeTab, setActiveTab] = useState("prompt");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Workflow state
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<Id<"workflows"> | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  // Workflow run state
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    runId: string;
    stepResults: Array<{
      stepId: string;
      status: "completed" | "failed" | "skipped";
      output?: string;
      error?: string;
      tokensUsed?: number;
      durationMs?: number;
    }>;
    totalDurationMs: number;
    errorMessage?: string;
  } | null>(null);
  // Queries
  const models = useQuery(api.workflows.getAvailableModels);
  const workflows = useQuery(api.workflows.listWorkflows, { category: "video_analysis" });
  const savedSystemPrompt = useQuery(api.settings.getSetting, { key: "analysis_system_prompt" });
  const savedUserPrompt = useQuery(api.settings.getSetting, { key: "analysis_user_prompt" });
  const savedSchema = useQuery(api.settings.getSetting, { key: "analysis_schema" });
  const savedModel = useQuery(api.settings.getSetting, { key: "analysis_model" });

  // Mutations
  const setSetting = useMutation(api.settings.setSetting);
  const createWorkflow = useMutation(api.workflows.createWorkflow);
  const updateWorkflow = useMutation(api.workflows.updateWorkflow);
  const deleteWorkflow = useMutation(api.workflows.deleteWorkflow);
  const duplicateWorkflow = useMutation(api.workflows.duplicateWorkflow);

  // Actions
  const runWorkflow = useAction(api.runWorkflow.runWorkflow);

  // Load saved values
  useEffect(() => {
    if (savedSystemPrompt?.value && !savedSystemPrompt.isSecret) {
      setSystemPrompt(savedSystemPrompt.value);
    }
  }, [savedSystemPrompt]);

  useEffect(() => {
    if (savedUserPrompt?.value && !savedUserPrompt.isSecret) {
      setUserPrompt(savedUserPrompt.value);
    }
  }, [savedUserPrompt]);

  useEffect(() => {
    if (savedSchema?.value && !savedSchema.isSecret) {
      setSchema(savedSchema.value);
    } else if (savedSchema === null) {
      // If setting doesn't exist at all, keep default
      setSchema(DEFAULT_SCHEMA);
    }
  }, [savedSchema]);

  useEffect(() => {
    if (savedModel?.value && !savedModel.isSecret) {
      setSelectedModel(savedModel.value);
    }
  }, [savedModel]);

  // Validate JSON schema
  const validateSchema = (schemaStr: string): boolean => {
    if (!schemaStr.trim()) {
      setSchemaError(null);
      return true;
    }
    try {
      JSON.parse(schemaStr);
      setSchemaError(null);
      return true;
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : "Invalid JSON");
      return false;
    }
  };

  // Handle save
  const handleSave = async () => {
    if (activeTab === "schema" && schema && !validateSchema(schema)) {
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await Promise.all([
        setSetting({ key: "analysis_system_prompt", value: systemPrompt, isSecret: false }),
        setSetting({ key: "analysis_user_prompt", value: userPrompt, isSecret: false }),
        setSetting({ key: "analysis_schema", value: schema, isSecret: false }),
        setSetting({ key: "analysis_model", value: selectedModel, isSecret: false }),
      ]);

      setSaveStatus("success");
      onSave?.();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    switch (activeTab) {
      case "prompt":
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        setUserPrompt(DEFAULT_USER_PROMPT);
        setSelectedModel("gemini-3-flash-preview");
        break;
      case "schema":
        setSchema(DEFAULT_SCHEMA);
        setSchemaError(null);
        break;
    }
  };

  // Workflow handlers
  const handleCreateWorkflow = async () => {
    if (!workflowName.trim()) return;

    setIsCreatingWorkflow(true);
    try {
      const id = await createWorkflow({
        name: workflowName,
        description: workflowDescription,
        category: "video_analysis",
        steps: workflowSteps.length > 0 ? workflowSteps : [createDefaultStep()],
      });
      setSelectedWorkflowId(id);
      setIsCreatingWorkflow(false);
    } catch (error) {
      console.error("Failed to create workflow:", error);
      setIsCreatingWorkflow(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflowId) return;

    setIsSaving(true);
    try {
      await updateWorkflow({
        workflowId: selectedWorkflowId,
        name: workflowName,
        description: workflowDescription,
        steps: workflowSteps,
      });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save workflow:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!selectedWorkflowId) return;
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      await deleteWorkflow({ workflowId: selectedWorkflowId });
      setSelectedWorkflowId(null);
      setWorkflowName("");
      setWorkflowDescription("");
      setWorkflowSteps([]);
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    }
  };

  const handleDuplicateWorkflow = async () => {
    if (!selectedWorkflowId) return;

    try {
      const newId = await duplicateWorkflow({ workflowId: selectedWorkflowId });
      setSelectedWorkflowId(newId);
    } catch (error) {
      console.error("Failed to duplicate workflow:", error);
    }
  };

  const createDefaultStep = (): WorkflowStep => ({
    stepId: `step_${Date.now()}`,
    name: "New Step",
    model: "gemini-3-flash-preview",
    input: { type: "video", includeVideo: true },
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    output: { type: "structured" },
    options: { maxOutputTokens: 65536 },
  });

  const handleAddStep = () => {
    setWorkflowSteps([...workflowSteps, createDefaultStep()]);
  };

  const handleRemoveStep = (stepId: string) => {
    setWorkflowSteps(workflowSteps.filter((s) => s.stepId !== stepId));
  };

  const handleUpdateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflowSteps(
      workflowSteps.map((s) => (s.stepId === stepId ? { ...s, ...updates } : s))
    );
  };

  const toggleStepExpanded = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  // Load workflow when selected
  useEffect(() => {
    if (selectedWorkflowId && workflows) {
      const workflow = workflows.find((w) => w._id === selectedWorkflowId);
      if (workflow) {
        setWorkflowName(workflow.name);
        setWorkflowDescription(workflow.description || "");
        setWorkflowSteps(workflow.steps as WorkflowStep[]);
      }
    }
  }, [selectedWorkflowId, workflows]);

  // Run workflow handler
  const handleRunWorkflow = async (testMode: boolean = true) => {
    if (!selectedWorkflowId) return;

    setIsRunningWorkflow(true);
    setRunResult(null);

    try {
      const result = await runWorkflow({
        workflowId: selectedWorkflowId,
        processId: processId as Id<"processes"> | undefined,
        testMode,
      });
      setRunResult(result);
    } catch (error) {
      console.error("Workflow run failed:", error);
      setRunResult({
        success: false,
        runId: "",
        stepResults: [],
        totalDurationMs: 0,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRunningWorkflow(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prompt" className="gap-2">
            <FileText className="w-4 h-4" />
            Prompt
          </TabsTrigger>
          <TabsTrigger value="schema" className="gap-2">
            <Code className="w-4 h-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2">
            <Workflow className="w-4 h-4" />
            Workflow
          </TabsTrigger>
        </TabsList>

        {/* Prompt Tab */}
        <TabsContent value="prompt" className="space-y-4">
          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border rounded-md bg-background text-sm"
            >
              {models?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.description}
                </option>
              )) || (
                  <>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash - Fast multimodal with great performance</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro - Most capable model with advanced reasoning</option>
                  </>
                )}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the Gemini model for video analysis. Pro models have better reasoning but are slower.
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium mb-2 block">System Prompt</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[150px] font-mono text-xs"
              placeholder="Enter system prompt..."
            />
          </div>

          {/* User Prompt */}
          <div>
            <label className="text-sm font-medium mb-2 block">User Prompt</label>
            <Textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="min-h-[100px] font-mono text-xs"
              placeholder="Enter user prompt..."
            />
          </div>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">JSON Schema (Optional)</label>
            <p className="text-xs text-muted-foreground mb-2">
              Define the structure of AI response. Leave empty to use the default PDD schema.
            </p>
            <Textarea
              value={schema}
              onChange={(e) => {
                setSchema(e.target.value);
                if (schemaError) validateSchema(e.target.value);
              }}
              className={`min-h-[300px] font-mono text-xs ${schemaError ? "border-red-500" : ""}`}
              placeholder='{"type": "object", "properties": {...}}'
            />
            {schemaError && (
              <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Invalid JSON: {schemaError}</span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          {/* Workflow Selection */}
          <div className="flex items-center gap-2">
            <select
              value={selectedWorkflowId || ""}
              onChange={(e) => setSelectedWorkflowId(e.target.value as Id<"workflows"> | null)}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select or Create Workflow --</option>
              {workflows?.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} {w.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedWorkflowId(null);
                setWorkflowName("New Workflow");
                setWorkflowDescription("");
                setWorkflowSteps([createDefaultStep()]);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Workflow Editor */}
          {(selectedWorkflowId || workflowSteps.length > 0) && (
            <div className="space-y-4 border rounded-lg p-4">
              {/* Workflow Name & Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Workflow Name</label>
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="My Workflow"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <input
                    type="text"
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    className="w-full p-2 border rounded-md text-sm"
                    placeholder="Optional description"
                  />
                </div>
              </div>

              {/* Workflow Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Steps</label>
                  <Button size="sm" variant="outline" onClick={handleAddStep}>
                    <Plus className="w-4 h-4 mr-1" /> Add Step
                  </Button>
                </div>

                <div className="space-y-2">
                  {workflowSteps.map((step, index) => (
                    <div key={step.stepId} className="border rounded-lg">
                      {/* Step Header */}
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleStepExpanded(step.stepId)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="font-medium">{step.name}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                            {step.model}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStep(step.stepId);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                          {expandedSteps.has(step.stepId) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Step Details (Expanded) */}
                      {expandedSteps.has(step.stepId) && (
                        <div className="p-3 pt-0 border-t space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium mb-1 block">Step Name</label>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => handleUpdateStep(step.stepId, { name: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium mb-1 block">Model</label>
                              <select
                                value={step.model}
                                onChange={(e) => handleUpdateStep(step.stepId, { model: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                              >
                                {models?.map((m) => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium mb-1 block">Input Type</label>
                              <select
                                value={step.input.type}
                                onChange={(e) => handleUpdateStep(step.stepId, {
                                  input: { ...step.input, type: e.target.value as any }
                                })}
                                className="w-full p-2 border rounded text-sm"
                              >
                                <option value="video">Video</option>
                                <option value="image">Image</option>
                                <option value="text">Text</option>
                                <option value="previous_step">Previous Step Output</option>
                                <option value="combined">Combined</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium mb-1 block">Output Type</label>
                              <select
                                value={step.output.type}
                                onChange={(e) => handleUpdateStep(step.stepId, {
                                  output: { ...step.output, type: e.target.value as any }
                                })}
                                className="w-full p-2 border rounded text-sm"
                              >
                                <option value="structured">Structured JSON</option>
                                <option value="json">JSON</option>
                                <option value="text">Text</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium mb-1 block">System Prompt</label>
                            <Textarea
                              value={step.systemPrompt}
                              onChange={(e) => handleUpdateStep(step.stepId, { systemPrompt: e.target.value })}
                              className="min-h-[80px] font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium mb-1 block">User Prompt</label>
                            <Textarea
                              value={step.userPrompt}
                              onChange={(e) => handleUpdateStep(step.stepId, { userPrompt: e.target.value })}
                              className="min-h-[60px] font-mono text-xs"
                            />
                          </div>

                          {step.output.type === "structured" && (
                            <div>
                              <label className="text-xs font-medium mb-1 block">Output Schema (JSON)</label>
                              <Textarea
                                value={step.output.schema || ""}
                                onChange={(e) => handleUpdateStep(step.stepId, {
                                  output: { ...step.output, schema: e.target.value }
                                })}
                                className="min-h-[60px] font-mono text-xs"
                                placeholder='{"type": "object", ...}'
                              />
                            </div>
                          )}

                          {/* Advanced Options */}
                          <div className="pt-2 border-t">
                            <label className="text-xs font-medium mb-2 block flex items-center gap-1">
                              <Settings className="w-3 h-3" /> Advanced Options
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Max Tokens</label>
                                <input
                                  type="number"
                                  value={step.options?.maxOutputTokens || 65536}
                                  onChange={(e) => handleUpdateStep(step.stepId, {
                                    options: { ...step.options, maxOutputTokens: parseInt(e.target.value) }
                                  })}
                                  className="w-full p-1 border rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Temperature</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="2"
                                  value={step.options?.temperature || 1}
                                  onChange={(e) => handleUpdateStep(step.stepId, {
                                    options: { ...step.options, temperature: parseFloat(e.target.value) }
                                  })}
                                  className="w-full p-1 border rounded text-xs"
                                />
                              </div>
                            </div>

                            {/* Thinking Options for Gemini 3 models */}
                            {(() => {
                              const selectedModel = models?.find((m) => m.id === step.model);
                              if (selectedModel?.supportsThinking && selectedModel?.thinkingEffortLevels?.length) {
                                return (
                                  <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Zap className="w-3 h-3 text-purple-600" />
                                      <label className="text-xs font-medium text-purple-800">Thinking Mode (Gemini 3)</label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center">
                                        <label className="flex items-center gap-1 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={step.options?.enableThinking || false}
                                            onChange={(e) => {
                                              const updates: Partial<WorkflowStep["options"]> = {
                                                ...step.options,
                                                enableThinking: e.target.checked,
                                              };
                                              if (e.target.checked && !step.options?.thinkingEffort) {
                                                updates.thinkingEffort = selectedModel.defaultThinkingEffort as any || "medium";
                                              }
                                              handleUpdateStep(step.stepId, { options: updates });
                                            }}
                                          />
                                          Enable Thinking
                                        </label>
                                      </div>
                                      {step.options?.enableThinking && (
                                        <div>
                                          <select
                                            value={step.options?.thinkingEffort || selectedModel.defaultThinkingEffort || "medium"}
                                            onChange={(e) => handleUpdateStep(step.stepId, {
                                              options: { ...step.options, thinkingEffort: e.target.value as any }
                                            })}
                                            className="w-full p-1 border rounded text-xs"
                                          >
                                            {selectedModel.thinkingEffortLevels.map((level) => (
                                              <option key={level} value={level}>
                                                {level.charAt(0).toUpperCase() + level.slice(1)}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                    {step.options?.enableThinking && (
                                      <p className="text-xs text-purple-600 mt-1">
                                        {step.model === "gemini-3-pro-preview"
                                          ? "Pro: Low = faster, High = deeper reasoning"
                                          : "Flash: Minimal → High = speed vs depth tradeoff"}
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                {selectedWorkflowId ? (
                  <>
                    <Button size="sm" onClick={handleSaveWorkflow} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                      Save Workflow
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDuplicateWorkflow}>
                      <Copy className="w-4 h-4 mr-1" /> Duplicate
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={handleDeleteWorkflow}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleCreateWorkflow}
                    disabled={isCreatingWorkflow || !workflowName.trim()}
                  >
                    {isCreatingWorkflow ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Create Workflow
                  </Button>
                )}
              </div>

              {/* Test Workflow Section */}
              {selectedWorkflowId && (
                <div className="pt-4 border-t mt-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Test Workflow
                  </h4>

                  <div className="space-y-3">
                    {/* Process Context Info */}
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        {processId ? (
                          <>Testing will use the <span className="font-medium text-foreground">current process</span> as context.</>
                        ) : (
                          <>No process context available. Running in <span className="font-medium text-foreground">text-only mode</span>.</>
                        )}
                      </p>
                    </div>

                    {/* Run Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleRunWorkflow(true)}
                        disabled={isRunningWorkflow}
                      >
                        {isRunningWorkflow ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-1" />
                            Quick Test (First Step)
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunWorkflow(false)}
                        disabled={isRunningWorkflow || workflowSteps.length <= 1}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run All Steps
                      </Button>
                    </div>

                    {/* Run Results */}
                    {runResult && (
                      <div className={`mt-4 p-4 rounded-lg ${runResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className={`text-sm font-medium flex items-center gap-2 ${runResult.success ? "text-green-800" : "text-red-800"}`}>
                            {runResult.success ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Workflow Completed
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                Workflow Failed
                              </>
                            )}
                          </h5>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {(runResult.totalDurationMs / 1000).toFixed(1)}s
                          </span>
                        </div>

                        {runResult.errorMessage && (
                          <p className="text-sm text-red-700 mb-3">{runResult.errorMessage}</p>
                        )}

                        {/* Step Results */}
                        <div className="space-y-2">
                          {runResult.stepResults.map((result, index) => {
                            const step = workflowSteps.find((s) => s.stepId === result.stepId);
                            return (
                              <div key={result.stepId} className="bg-white rounded p-2 border">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                                      {index + 1}
                                    </span>
                                    <span className="text-sm font-medium">{step?.name || result.stepId}</span>
                                    {result.status === "completed" && (
                                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    )}
                                    {result.status === "failed" && (
                                      <XCircle className="w-4 h-4 text-red-600" />
                                    )}
                                    {result.status === "skipped" && (
                                      <SkipForward className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {result.tokensUsed && <span>~{result.tokensUsed} tokens</span>}
                                    {result.durationMs && <span>{(result.durationMs / 1000).toFixed(1)}s</span>}
                                  </div>
                                </div>

                                {result.error && (
                                  <p className="text-xs text-red-600 mt-1 pl-7">{result.error}</p>
                                )}

                                {result.output && (
                                  <div className="mt-2 pl-7">
                                    <details>
                                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                                        View Output ({result.output.length} chars)
                                      </summary>
                                      <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                                        {result.output.substring(0, 2000)}
                                        {result.output.length > 2000 && "..."}
                                      </pre>
                                    </details>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workflow Documentation */}
          {!selectedWorkflowId && workflowSteps.length === 0 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-3">About AI Workflows</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Workflows define multi-step AI pipelines for video analysis. Each step can:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use a different Gemini model (Pro for complex reasoning, Flash for speed)</li>
                  <li>Process video, images, text, or output from previous steps</li>
                  <li>Define custom prompts and output schemas</li>
                  <li>Enable "thinking" mode with adjustable effort (Gemini 3)</li>
                </ul>
                <p className="pt-2">Create a workflow to customize how videos are analyzed, then test it on different processes.</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Buttons (for Prompt & Schema tabs) */}
      {activeTab !== "workflow" && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || (activeTab === "schema" && !!schemaError)}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveStatus === "success" ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
