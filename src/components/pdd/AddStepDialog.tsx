"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VideoPlayer } from "./VideoPlayer";

// Type definitions
const ACTION_TYPES = [
  "ui_interaction",
  "navigation",
  "data_transfer",
  "explanation",
  "wait",
  "validation",
] as const;

const SPECIFIC_ACTIONS = {
  ui_interaction: ["click", "double_click", "right_click", "type", "select", "check", "uncheck", "drag_and_drop", "scroll", "hover"],
  navigation: ["navigate_to_url", "open_application", "close_application", "switch_tab", "switch_window", "go_back"],
  data_transfer: ["read", "copy", "paste", "download", "upload", "export", "import"],
  explanation: ["note", "decision", "business_rule", "exception"],
  wait: ["wait_for_element", "wait_for_page", "wait_for_process", "wait_fixed_time"],
  validation: ["verify_element", "verify_value", "verify_state"],
} as const;

const ELEMENT_TYPES = [
  "button", "link", "text_field", "text_area", "dropdown", "combobox", "checkbox",
  "radio_button", "toggle", "slider", "date_picker", "time_picker", "file_upload",
  "menu", "menu_item", "tab", "table", "table_row", "table_cell", "tree_view",
  "tree_node", "list", "list_item", "card", "modal", "dialog", "tooltip",
  "notification", "icon", "image", "label", "heading", "paragraph", "breadcrumb",
  "pagination", "search_field", "other",
] as const;

const SCREEN_REGIONS = [
  "top_left", "top_center", "top_right",
  "middle_left", "middle_center", "middle_right",
  "bottom_left", "bottom_center", "bottom_right",
  "full_screen",
] as const;

const DATA_TYPES = [
  "text", "number", "date", "datetime", "currency", "percentage",
  "boolean", "email", "phone", "url", "file", "password", "other",
] as const;

const DATA_SOURCES = [
  "user_input", "system_generated", "database", "external_api",
  "file_import", "calculation", "other",
] as const;

interface AddStepDialogProps {
  processId: string;
  afterStepNumber?: number; // Insert after this step, or at end if not provided
  totalSteps: number;
  defaultApplication?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

type TabType = "basic" | "uiElement" | "dataInfo" | "screenshot";

export function AddStepDialog({
  processId,
  afterStepNumber,
  totalSteps,
  defaultApplication = "",
  open,
  onOpenChange,
  onSave,
}: AddStepDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [editorMode, setEditorMode] = useState<"compact" | "expanded">("compact");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedStorageId, setUploadedStorageId] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [cloneSourceStepId, setCloneSourceStepId] = useState<string | null>(null);

  // Form state
  const [insertPosition, setInsertPosition] = useState<number>(afterStepNumber ?? totalSteps);

  // Update insertPosition when afterStepNumber prop changes
  useEffect(() => {
    if (afterStepNumber !== undefined) {
      setInsertPosition(afterStepNumber);
    }
  }, [afterStepNumber]);

  const [formData, setFormData] = useState({
    description: "",
    application: defaultApplication,
    screenName: "",
    timestamp: "00:00.000",
    timestampSeconds: 0,
    actionType: "ui_interaction" as const,
    specificAction: "click" as const,
    screenshotRequired: true,
    notes: "",
    automationHint: "",
  });

  const [uiElement, setUiElement] = useState({
    enabled: false,
    elementName: "",
    elementType: "button" as const,
    locationDescription: "",
    screenRegion: "middle_center" as const,
    parentElement: "",
  });

  const [dataInfo, setDataInfo] = useState({
    enabled: false,
    value: "",
    dataType: "text" as const,
    source: "user_input" as const,
    isSensitive: false,
    format: "",
  });

  // Screenshot state
  const [screenshotMode, setScreenshotMode] = useState<"none" | "upload" | "clone" | "video">("none");
  const [selectedCloneStepId, setSelectedCloneStepId] = useState<string | null>(null);
  const [showVideoCapture, setShowVideoCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video capture state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Queries and mutations
  const addStep = useMutation(api.steps.addStep);
  const cloneScreenshotFromStep = useAction(api.stepsActions.cloneScreenshotFromStep);
  const generateUploadUrl = useMutation(api.steps.generateUploadUrl);
  const stepsForClone = useQuery(api.steps.getStepsForProcess, { processId: processId as Id<"processes"> });
  const videoInfo = useQuery(api.steps.getVideoForProcess, { processId: processId as Id<"processes"> });

  // Get valid specific actions for current action type
  const validSpecificActions = SPECIFIC_ACTIONS[formData.actionType as keyof typeof SPECIFIC_ACTIONS] || [];

  // Clone details from another step
  const cloneFromStep = (stepId: string) => {
    const step = stepsForClone?.find(s => s._id === stepId);
    if (!step) return;

    setFormData({
      description: "", // Don't clone description - user should write new one
      application: step.application || defaultApplication,
      screenName: step.screenName || "",
      timestamp: "00:00.000",
      timestampSeconds: 0,
      actionType: (step.actionType as typeof formData.actionType) || "ui_interaction",
      specificAction: (step.specificAction as typeof formData.specificAction) || "click",
      screenshotRequired: step.screenshotRequired ?? true,
      notes: "", // Don't clone notes
      automationHint: step.automationHint || "",
    });

    if (step.uiElement) {
      setUiElement({
        enabled: true,
        elementName: "", // Don't clone element name - likely different
        elementType: step.uiElement.elementType || "button",
        locationDescription: step.uiElement.locationDescription || "",
        screenRegion: step.uiElement.screenRegion || "middle_center",
        parentElement: step.uiElement.parentElement || "",
      });
    }

    if (step.dataInfo) {
      setDataInfo({
        enabled: true,
        value: "", // Don't clone value
        dataType: step.dataInfo.dataType || "text",
        source: step.dataInfo.source || "user_input",
        isSensitive: step.dataInfo.isSensitive || false,
        format: step.dataInfo.format || "",
      });
    }

    setCloneSourceStepId(stepId);
    setError(null);
  };

  // Handle action type change - reset specific action if invalid
  const handleActionTypeChange = (newActionType: string) => {
    const newValidActions = SPECIFIC_ACTIONS[newActionType as keyof typeof SPECIFIC_ACTIONS] || [];
    setFormData(prev => ({
      ...prev,
      actionType: newActionType as any,
      specificAction: newValidActions[0] || "click",
    }));
  };

  // Format timestamp
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { storageId } = await response.json();
      setUploadedStorageId(storageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // Capture frame from video
  const captureVideoFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setIsUploading(true);
      setError(null);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      ctx.drawImage(video, 0, 0);

      // Set preview
      setScreenshotPreview(canvas.toDataURL("image/jpeg", 0.9));

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        }, "image/jpeg", 0.9);
      });

      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { storageId } = await response.json();
      setUploadedStorageId(storageId);

      // Update timestamp to match video time
      const currentTime = video.currentTime;
      setFormData(prev => ({
        ...prev,
        timestampSeconds: currentTime,
        timestamp: formatTimestamp(currentTime),
      }));

      setShowVideoCapture(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setIsUploading(false);
    }
  }, [generateUploadUrl]);

  // Save new step
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!formData.description.trim()) {
        setError("Description is required");
        setActiveTab("basic");
        setIsSaving(false);
        return;
      }

      if (!formData.application.trim()) {
        setError("Application is required");
        setActiveTab("basic");
        setIsSaving(false);
        return;
      }

      if (!formData.screenName.trim()) {
        setError("Screen name is required");
        setActiveTab("basic");
        setIsSaving(false);
        return;
      }

      // Create step
      const result = await addStep({
        processId: processId as Id<"processes">,
        afterStepNumber: insertPosition,
        timestamp: formData.timestamp,
        timestampSeconds: formData.timestampSeconds,
        actionType: formData.actionType,
        specificAction: formData.specificAction,
        description: formData.description,
        application: formData.application,
        screenName: formData.screenName,
        screenshotRequired: formData.screenshotRequired,
        screenshotStorageId: uploadedStorageId ? (uploadedStorageId as Id<"_storage">) : undefined,
        notes: formData.notes || undefined,
        automationHint: formData.automationHint || undefined,
        uiElement: uiElement.enabled ? {
          elementName: uiElement.elementName,
          elementType: uiElement.elementType,
          locationDescription: uiElement.locationDescription,
          screenRegion: uiElement.screenRegion,
          parentElement: uiElement.parentElement || undefined,
        } : undefined,
        dataInfo: dataInfo.enabled ? {
          value: dataInfo.value,
          dataType: dataInfo.dataType,
          source: dataInfo.source,
          isSensitive: dataInfo.isSensitive,
          format: dataInfo.format || undefined,
        } : undefined,
      });

      // If clone mode was selected, clone after creating the step
      if (screenshotMode === "clone" && selectedCloneStepId && result.stepId) {
        await cloneScreenshotFromStep({
          targetStepId: result.stepId,
          sourceStepId: selectedCloneStepId as Id<"steps">,
        });
      }

      onSave?.();
      onOpenChange(false);

      // Reset form
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      application: defaultApplication,
      screenName: "",
      timestamp: "00:00.000",
      timestampSeconds: 0,
      actionType: "ui_interaction",
      specificAction: "click",
      screenshotRequired: true,
      notes: "",
      automationHint: "",
    });
    setUiElement({
      enabled: false,
      elementName: "",
      elementType: "button",
      locationDescription: "",
      screenRegion: "middle_center",
      parentElement: "",
    });
    setDataInfo({
      enabled: false,
      value: "",
      dataType: "text",
      source: "user_input",
      isSensitive: false,
      format: "",
    });
    setScreenshotMode("none");
    setSelectedCloneStepId(null);
    setUploadedStorageId(null);
    setScreenshotPreview(null);
    setShowVideoCapture(false);
    setActiveTab("basic");
    setCloneSourceStepId(null);
    setError(null);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "basic", label: "Basic Info" },
    { id: "uiElement", label: "UI Element" },
    { id: "dataInfo", label: "Data Info" },
    { id: "screenshot", label: "Screenshot" },
  ];

  // Create position options (0 = beginning, 1 = after step 1, etc.)
  const positionOptions = Array.from({ length: totalSteps + 1 }, (_, i) => ({
    value: i,
    label: i === 0 ? "At the beginning" : `After step ${i}`,
  }));

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent
        className="overflow-hidden flex flex-col"
        style={{
          width: editorMode === "expanded" ? "90vw" : "48rem",
          maxWidth: "95vw",
          height: editorMode === "expanded" ? "85vh" : "80vh",
        }}
      >
        <DialogHeader>
          <DialogTitle>Add New Step</DialogTitle>
        </DialogHeader>

        {/* Mode toggle - positioned next to close button */}
        <button
          onClick={() => setEditorMode(editorMode === "compact" ? "expanded" : "compact")}
          className={`absolute top-4 right-12 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            editorMode === "expanded"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted border-input"
          }`}
        >
          {editorMode === "expanded" ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M4 14h6v6M14 4h6v6M20 10l-6-6M4 20l6-6" />
              </svg>
              Compact
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              Expanded
            </>
          )}
        </button>

        {/* Top bar: Position + Clone */}
        <div className="flex items-center gap-6 py-2 px-1 border-b flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Insert:</label>
            <select
              value={insertPosition}
              onChange={(e) => setInsertPosition(parseInt(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {positionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              (Step {insertPosition + 1})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Clone from:</label>
            <select
              value={cloneSourceStepId || ""}
              onChange={(e) => {
                if (e.target.value) {
                  cloneFromStep(e.target.value);
                }
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[200px]"
            >
              <option value="">-- Select step to clone --</option>
              {stepsForClone?.map((s) => (
                <option key={s._id} value={s._id}>
                  Step {s.stepNumber}: {s.description.substring(0, 35)}...
                </option>
              ))}
            </select>
            {cloneSourceStepId && (
              <span className="text-xs text-green-600 font-medium">Cloned!</span>
            )}
          </div>
        </div>


        {/* Tabs - show in both modes */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className={`flex-1 overflow-y-auto py-4 px-1 ${editorMode === "expanded" ? "space-y-6" : ""}`}>
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Description *</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe what this step does..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Action Type</label>
                  <select
                    value={formData.actionType}
                    onChange={(e) => handleActionTypeChange(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {ACTION_TYPES.map((type) => (
                      <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Specific Action</label>
                  <select
                    value={formData.specificAction}
                    onChange={(e) => setFormData(prev => ({ ...prev, specificAction: e.target.value as any }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {validSpecificActions.map((action) => (
                      <option key={action} value={action}>{action.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Application *</label>
                  <Input
                    value={formData.application}
                    onChange={(e) => setFormData(prev => ({ ...prev, application: e.target.value }))}
                    placeholder="e.g., SAP, Chrome, Excel"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Screen Name *</label>
                  <Input
                    value={formData.screenName}
                    onChange={(e) => setFormData(prev => ({ ...prev, screenName: e.target.value }))}
                    placeholder="e.g., Login Page, Dashboard"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Timestamp</label>
                  <Input
                    value={formData.timestamp}
                    onChange={(e) => setFormData(prev => ({ ...prev, timestamp: e.target.value }))}
                    placeholder="00:00.000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Timestamp (seconds)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.timestampSeconds}
                    onChange={(e) => setFormData(prev => ({ ...prev, timestampSeconds: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Automation Hint</label>
                <Input
                  value={formData.automationHint}
                  onChange={(e) => setFormData(prev => ({ ...prev, automationHint: e.target.value }))}
                  placeholder="Optional hint for RPA/automation..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="screenshotRequired"
                  checked={formData.screenshotRequired}
                  onChange={(e) => setFormData(prev => ({ ...prev, screenshotRequired: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="screenshotRequired" className="text-sm">Screenshot required</label>
              </div>
            </div>
          )}

          {/* UI Element Tab */}
          {activeTab === "uiElement" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="uiElementEnabled"
                  checked={uiElement.enabled}
                  onChange={(e) => setUiElement(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="uiElementEnabled" className="text-sm font-medium">This step has a UI element</label>
              </div>

              {/* Bounding box info */}
              {uiElement.enabled && (uploadedStorageId || screenshotMode === "clone" || screenshotMode === "video") && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <span>
                      Po dodaniu kroku, aplikacja automatycznie wykryje i oznaczy ten element na screenshocie (bounding box).
                    </span>
                  </div>
                </div>
              )}

              {uiElement.enabled && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Element Name</label>
                    <Input
                      value={uiElement.elementName}
                      onChange={(e) => setUiElement(prev => ({ ...prev, elementName: e.target.value }))}
                      placeholder="e.g., Submit Button, Email Field"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Element Type</label>
                      <select
                        value={uiElement.elementType}
                        onChange={(e) => setUiElement(prev => ({ ...prev, elementType: e.target.value as any }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {ELEMENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Screen Region</label>
                      <select
                        value={uiElement.screenRegion}
                        onChange={(e) => setUiElement(prev => ({ ...prev, screenRegion: e.target.value as any }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {SCREEN_REGIONS.map((region) => (
                          <option key={region} value={region}>{region.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Location Description</label>
                    <Textarea
                      value={uiElement.locationDescription}
                      onChange={(e) => setUiElement(prev => ({ ...prev, locationDescription: e.target.value }))}
                      rows={2}
                      placeholder="Describe where the element is located..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Parent Element (optional)</label>
                    <Input
                      value={uiElement.parentElement}
                      onChange={(e) => setUiElement(prev => ({ ...prev, parentElement: e.target.value }))}
                      placeholder="e.g., Login Form, Navigation Menu"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Data Info Tab */}
          {activeTab === "dataInfo" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="dataInfoEnabled"
                  checked={dataInfo.enabled}
                  onChange={(e) => setDataInfo(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="dataInfoEnabled" className="text-sm font-medium">This step involves data entry</label>
              </div>

              {dataInfo.enabled && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Value / Description</label>
                    <Textarea
                      value={dataInfo.value}
                      onChange={(e) => setDataInfo(prev => ({ ...prev, value: e.target.value }))}
                      rows={2}
                      placeholder="The data value or description..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Data Type</label>
                      <select
                        value={dataInfo.dataType}
                        onChange={(e) => setDataInfo(prev => ({ ...prev, dataType: e.target.value as any }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {DATA_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Data Source</label>
                      <select
                        value={dataInfo.source}
                        onChange={(e) => setDataInfo(prev => ({ ...prev, source: e.target.value as any }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {DATA_SOURCES.map((source) => (
                          <option key={source} value={source}>{source.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Format (optional)</label>
                    <Input
                      value={dataInfo.format}
                      onChange={(e) => setDataInfo(prev => ({ ...prev, format: e.target.value }))}
                      placeholder="e.g., YYYY-MM-DD, ###-###-####"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isSensitive"
                      checked={dataInfo.isSensitive}
                      onChange={(e) => setDataInfo(prev => ({ ...prev, isSensitive: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="isSensitive" className="text-sm">
                      Contains sensitive data (will be masked in documentation)
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Screenshot Tab */}
          {activeTab === "screenshot" && (
            <div className="space-y-4">
              {/* Screenshot preview */}
              {screenshotPreview && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Screenshot Preview</label>
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="max-h-48 rounded-md border object-contain"
                  />
                </div>
              )}

              {/* Screenshot source options */}
              <div className="space-y-3">
                <label className="text-sm font-medium block">Screenshot Source</label>

                {/* No screenshot */}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="noScreenshot"
                    checked={screenshotMode === "none"}
                    onChange={() => {
                      setScreenshotMode("none");
                      setUploadedStorageId(null);
                      setScreenshotPreview(null);
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor="noScreenshot" className="text-sm">No screenshot</label>
                </div>

                {/* Upload */}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="uploadNew"
                    checked={screenshotMode === "upload"}
                    onChange={() => setScreenshotMode("upload")}
                    className="h-4 w-4"
                  />
                  <label htmlFor="uploadNew" className="text-sm flex-1">Upload image</label>
                  {screenshotMode === "upload" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? "Uploading..." : "Choose File"}
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Clone from step */}
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    id="cloneFromStep"
                    checked={screenshotMode === "clone"}
                    onChange={() => setScreenshotMode("clone")}
                    className="h-4 w-4 mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="cloneFromStep" className="text-sm">Clone from another step</label>
                    {screenshotMode === "clone" && (
                      <div className="mt-2">
                        <select
                          value={selectedCloneStepId || ""}
                          onChange={(e) => setSelectedCloneStepId(e.target.value || null)}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select a step...</option>
                          {stepsForClone?.filter(s => s.hasScreenshot).map((s) => (
                            <option key={s._id} value={s._id}>
                              Step {s.stepNumber}: {s.description.substring(0, 40)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Capture from video */}
                {videoInfo?.videoUrl && (
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      id="captureFromVideo"
                      checked={screenshotMode === "video"}
                      onChange={() => {
                        setScreenshotMode("video");
                        setShowVideoCapture(true);
                      }}
                      className="h-4 w-4 mt-1"
                    />
                    <label htmlFor="captureFromVideo" className="text-sm">Capture from video</label>
                  </div>
                )}
              </div>

              {/* Video capture UI */}
              {screenshotMode === "video" && showVideoCapture && videoInfo?.videoUrl && (
                <VideoPlayer
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  videoUrl={videoInfo.videoUrl}
                  duration={videoInfo.recordingDurationSeconds}
                  currentTime={videoTime}
                  isPlaying={isPlaying}
                  onTimeChange={setVideoTime}
                  onPlayingChange={setIsPlaying}
                  onCapture={captureVideoFrame}
                  isCapturing={isUploading}
                />
              )}
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Adding..." : "Add Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
