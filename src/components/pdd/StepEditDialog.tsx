/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface StepData {
  _id: string;
  stepNumber: number;
  timestamp: string;
  timestampSeconds?: number;
  actionType: string;
  specificAction: string;
  description: string;
  application: string;
  screenName: string;
  screenshotRequired: boolean;
  screenshotUrl?: string | null;
  uiElement?: {
    elementName: string;
    elementType: string;
    locationDescription: string;
    screenRegion: string;
    parentElement?: string;
  } | null;
  dataInfo?: {
    value: string;
    dataType: string;
    source: string;
    isSensitive: boolean;
    format?: string;
  } | null;
  notes?: string;
  automationHint?: string;
}

interface StepEditDialogProps {
  step: StepData;
  processId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

type TabType = "basic" | "uiElement" | "dataInfo" | "screenshot";

export function StepEditDialog({
  step,
  processId,
  open,
  onOpenChange,
  onSave,
}: StepEditDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    description: step.description,
    application: step.application,
    screenName: step.screenName,
    timestamp: step.timestamp,
    timestampSeconds: step.timestampSeconds,
    actionType: step.actionType,
    specificAction: step.specificAction,
    screenshotRequired: step.screenshotRequired,
    notes: step.notes || "",
    automationHint: step.automationHint || "",
  });

  const [uiElement, setUiElement] = useState({
    enabled: !!step.uiElement,
    elementName: step.uiElement?.elementName || "",
    elementType: step.uiElement?.elementType || "button",
    locationDescription: step.uiElement?.locationDescription || "",
    screenRegion: step.uiElement?.screenRegion || "middle_center",
    parentElement: step.uiElement?.parentElement || "",
  });

  const [dataInfo, setDataInfo] = useState({
    enabled: !!step.dataInfo,
    value: step.dataInfo?.value || "",
    dataType: step.dataInfo?.dataType || "text",
    source: step.dataInfo?.source || "user_input",
    isSensitive: step.dataInfo?.isSensitive || false,
    format: step.dataInfo?.format || "",
  });

  // Screenshot state
  const [screenshotMode, setScreenshotMode] = useState<"keep" | "upload" | "clone" | "video">("keep");
  const [selectedCloneStepId, setSelectedCloneStepId] = useState<string | null>(null);
  const [showVideoCapture, setShowVideoCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video capture state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoTime, setVideoTime] = useState(step.timestampSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Queries and mutations
  const updateStep = useMutation(api.steps.updateStep);
  const updateStepScreenshot = useMutation(api.steps.updateStepScreenshot);
  const cloneScreenshotFromStep = useAction(api.stepsActions.cloneScreenshotFromStep);
  const generateUploadUrl = useMutation(api.steps.generateUploadUrl);
  const stepsForClone = useQuery(api.steps.getStepsForProcess, { processId: processId as Id<"processes"> });
  const videoInfo = useQuery(api.steps.getVideoForProcess, { processId: processId as Id<"processes"> });

  // Reset form when step changes
  useEffect(() => {
    setFormData({
      description: step.description,
      application: step.application,
      screenName: step.screenName,
      timestamp: step.timestamp,
      timestampSeconds: step.timestampSeconds,
      actionType: step.actionType,
      specificAction: step.specificAction,
      screenshotRequired: step.screenshotRequired,
      notes: step.notes || "",
      automationHint: step.automationHint || "",
    });
    setUiElement({
      enabled: !!step.uiElement,
      elementName: step.uiElement?.elementName || "",
      elementType: step.uiElement?.elementType || "button",
      locationDescription: step.uiElement?.locationDescription || "",
      screenRegion: step.uiElement?.screenRegion || "middle_center",
      parentElement: step.uiElement?.parentElement || "",
    });
    setDataInfo({
      enabled: !!step.dataInfo,
      value: step.dataInfo?.value || "",
      dataType: step.dataInfo?.dataType || "text",
      source: step.dataInfo?.source || "user_input",
      isSensitive: step.dataInfo?.isSensitive || false,
      format: step.dataInfo?.format || "",
    });
    setScreenshotMode("keep");
    setSelectedCloneStepId(null);
    setShowVideoCapture(false);
    setActiveTab("basic");
    setError(null);
  }, [step]);

  // Get valid specific actions for current action type
  const validSpecificActions = SPECIFIC_ACTIONS[formData.actionType as keyof typeof SPECIFIC_ACTIONS] || [];

  // Handle action type change - reset specific action if invalid
  const handleActionTypeChange = (newActionType: string) => {
    const newValidActions = SPECIFIC_ACTIONS[newActionType as keyof typeof SPECIFIC_ACTIONS] || [];
    setFormData(prev => ({
      ...prev,
      actionType: newActionType,
      specificAction: (newValidActions as readonly string[]).includes(prev.specificAction) ? prev.specificAction : newValidActions[0] || "",
    }));
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { storageId } = await response.json();
      await updateStepScreenshot({
        stepId: step._id as Id<"steps">,
        screenshotStorageId: storageId,
      });

      setScreenshotMode("keep");
      onSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle clone screenshot
  const handleCloneScreenshot = async () => {
    if (!selectedCloneStepId) return;

    try {
      setIsUploading(true);
      setError(null);

      await cloneScreenshotFromStep({
        targetStepId: step._id as Id<"steps">,
        sourceStepId: selectedCloneStepId as Id<"steps">,
      });

      setScreenshotMode("keep");
      setSelectedCloneStepId(null);
      onSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
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
      await updateStepScreenshot({
        stepId: step._id as Id<"steps">,
        screenshotStorageId: storageId,
      });

      // Update timestamp to match video time
      const currentTime = video.currentTime;
      await updateStep({
        stepId: step._id as Id<"steps">,
        timestampSeconds: currentTime,
        timestamp: formatTimestamp(currentTime),
      });

      setShowVideoCapture(false);
      setScreenshotMode("keep");
      onSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setIsUploading(false);
    }
  }, [generateUploadUrl, updateStepScreenshot, updateStep, step._id, onSave]);

  // Format timestamp
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  // Save changes
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      await updateStep({
        stepId: step._id as Id<"steps">,
        description: formData.description,
        application: formData.application,
        screenName: formData.screenName,
        timestamp: formData.timestamp,
        timestampSeconds: formData.timestampSeconds,
        actionType: formData.actionType as any,
        specificAction: formData.specificAction as any,
        screenshotRequired: formData.screenshotRequired,
        notes: formData.notes || undefined,
        automationHint: formData.automationHint || undefined,
        uiElement: uiElement.enabled ? {
          elementName: uiElement.elementName,
          elementType: uiElement.elementType,
          locationDescription: uiElement.locationDescription,
          screenRegion: uiElement.screenRegion,
          parentElement: uiElement.parentElement || undefined,
        } : null,
        dataInfo: dataInfo.enabled ? {
          value: dataInfo.value,
          dataType: dataInfo.dataType,
          source: dataInfo.source,
          isSensitive: dataInfo.isSensitive,
          format: dataInfo.format || undefined,
        } : null,
      });

      onSave?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "basic", label: "Basic Info" },
    { id: "uiElement", label: "UI Element" },
    { id: "dataInfo", label: "Data Info" },
    { id: "screenshot", label: "Screenshot" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Step {step.stepNumber}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, specificAction: e.target.value }))}
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
                  <label className="text-sm font-medium mb-1 block">Application</label>
                  <Input
                    value={formData.application}
                    onChange={(e) => setFormData(prev => ({ ...prev, application: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Screen Name</label>
                  <Input
                    value={formData.screenName}
                    onChange={(e) => setFormData(prev => ({ ...prev, screenName: e.target.value }))}
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
              {uiElement.enabled && step.screenshotUrl && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                  <div className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <span>
                      After saving changes to the UI element, the application will automatically detect and mark this element on the screenshot (bounding box).
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
                        onChange={(e) => setUiElement(prev => ({ ...prev, elementType: e.target.value }))}
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
                        onChange={(e) => setUiElement(prev => ({ ...prev, screenRegion: e.target.value }))}
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
                        onChange={(e) => setDataInfo(prev => ({ ...prev, dataType: e.target.value }))}
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
                        onChange={(e) => setDataInfo(prev => ({ ...prev, source: e.target.value }))}
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
              {/* Current screenshot preview */}
              {step.screenshotUrl && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">Current Screenshot</label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={step.screenshotUrl}
                    alt="Current screenshot"
                    className="max-h-96 rounded-md border object-contain"
                  />
                </div>
              )}

              {/* Screenshot source options */}
              <div className="space-y-3">
                <label className="text-sm font-medium block">Change Screenshot</label>

                {/* Upload */}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="uploadNew"
                    checked={screenshotMode === "upload"}
                    onChange={() => setScreenshotMode("upload")}
                    className="h-4 w-4"
                  />
                  <label htmlFor="uploadNew" className="text-sm flex-1">Upload new image</label>
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
                      <div className="mt-2 flex gap-2">
                        <select
                          value={selectedCloneStepId || ""}
                          onChange={(e) => setSelectedCloneStepId(e.target.value || null)}
                          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select a step...</option>
                          {stepsForClone?.filter(s => s.hasScreenshot && s._id !== step._id).map((s) => (
                            <option key={s._id} value={s._id}>
                              Step {s.stepNumber}: {s.description.substring(0, 40)}...
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={handleCloneScreenshot}
                          disabled={!selectedCloneStepId || isUploading}
                        >
                          {isUploading ? "Cloning..." : "Clone"}
                        </Button>
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
                  duration={videoInfo.recordingDurationSeconds ?? 0}
                  currentTime={videoTime}
                  isPlaying={isPlaying}
                  onTimeChange={setVideoTime}
                  onPlayingChange={setIsPlaying}
                  mode="expanded"
                  initialTime={step.timestampSeconds ?? 0}
                  onCapture={captureVideoFrame}
                  isCapturing={isUploading}
                  onGoToStepTime={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = step.timestampSeconds ?? 0;
                      setVideoTime(step.timestampSeconds ?? 0);
                    }
                  }}
                  showGoToStepTime
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
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
