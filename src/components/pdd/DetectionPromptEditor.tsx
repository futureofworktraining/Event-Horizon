/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Target,
  ShieldAlert,
  Loader2,
  Check,
  AlertCircle,
  Save,
  Plus,
} from "lucide-react";

interface DetectionPromptEditorProps {
  processId?: string;
  onApply?: () => void;
}

export function DetectionPromptEditor({ processId, onApply }: DetectionPromptEditorProps) {
  const [activeTab, setActiveTab] = useState<"ui_element" | "sensitive_info">("ui_element");

  // Selected prompt IDs (unified prompts table)
  const [selectedUiElementId, setSelectedUiElementId] = useState<Id<"prompts"> | null>(null);
  const [selectedSensitiveInfoId, setSelectedSensitiveInfoId] = useState<Id<"prompts"> | null>(null);

  // Editing state for each tab
  const [uiElementContent, setUiElementContent] = useState("");
  const [uiElementName, setUiElementName] = useState("");
  const [uiElementVersion, setUiElementVersion] = useState("");

  const [sensitiveInfoContent, setSensitiveInfoContent] = useState("");
  const [sensitiveInfoName, setSensitiveInfoName] = useState("");
  const [sensitiveInfoVersion, setSensitiveInfoVersion] = useState("");

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Queries - using unified prompts table
  const uiElementPrompts = useQuery(api.unifiedPrompts.listUiElementPrompts);
  const sensitiveInfoPrompts = useQuery(api.unifiedPrompts.listSensitiveInfoPrompts);

  // Get process current prompts (unified)
  const processPrompts = useQuery(
    api.processes.getUnifiedProcessPrompts,
    processId ? { processId: processId as Id<"processes"> } : "skip"
  );

  // Mutations - using unified prompts API
  const createPrompt = useMutation(api.unifiedPrompts.createPrompt);
  const updatePrompt = useMutation(api.unifiedPrompts.updatePrompt);
  const setUiElementPrompt = useMutation(api.processes.setUiElementPrompt);
  const setSensitiveInfoPrompt = useMutation(api.processes.setSensitiveInfoPrompt);

  // Initialize selections from process or defaults
  useEffect(() => {
    if (processPrompts) {
      if (processPrompts.uiElementPromptId) {
        setSelectedUiElementId(processPrompts.uiElementPromptId);
      }
      if (processPrompts.sensitiveInfoPromptId) {
        setSelectedSensitiveInfoId(processPrompts.sensitiveInfoPromptId);
      }
    }

    // Set to defaults if not yet selected
    if (uiElementPrompts?.length && !selectedUiElementId) {
      const defaultPrompt = uiElementPrompts.find(p => p.isDefault) || uiElementPrompts[0];
      if (defaultPrompt) setSelectedUiElementId(defaultPrompt._id);
    }
    if (sensitiveInfoPrompts?.length && !selectedSensitiveInfoId) {
      const defaultPrompt = sensitiveInfoPrompts.find(p => p.isDefault) || sensitiveInfoPrompts[0];
      if (defaultPrompt) setSelectedSensitiveInfoId(defaultPrompt._id);
    }
  }, [processPrompts, uiElementPrompts, sensitiveInfoPrompts, selectedUiElementId, selectedSensitiveInfoId]);

  // Load UI element prompt content when selected
  useEffect(() => {
    if (selectedUiElementId && uiElementPrompts) {
      const prompt = uiElementPrompts.find(p => p._id === selectedUiElementId);
      if (prompt) {
        setUiElementContent(prompt.content);
        setUiElementName(prompt.name);
        setUiElementVersion(prompt.version);
        setIsCreatingNew(false);
      }
    }
  }, [selectedUiElementId, uiElementPrompts]);

  // Load sensitive info prompt content when selected
  useEffect(() => {
    if (selectedSensitiveInfoId && sensitiveInfoPrompts) {
      const prompt = sensitiveInfoPrompts.find(p => p._id === selectedSensitiveInfoId);
      if (prompt) {
        setSensitiveInfoContent(prompt.content);
        setSensitiveInfoName(prompt.name);
        setSensitiveInfoVersion(prompt.version);
        setIsCreatingNew(false);
      }
    }
  }, [selectedSensitiveInfoId, sensitiveInfoPrompts]);

  // Handle creating new prompt
  const handleCreateNew = () => {
    setIsCreatingNew(true);
    if (activeTab === "ui_element") {
      setUiElementName("New UI Element Detection Prompt");
      setUiElementVersion("v1");
      setUiElementContent("");
      setSelectedUiElementId(null);
    } else {
      setSensitiveInfoName("New Sensitive Info Detection Prompt");
      setSensitiveInfoVersion("v1");
      setSensitiveInfoContent("");
      setSelectedSensitiveInfoId(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    const name = activeTab === "ui_element" ? uiElementName : sensitiveInfoName;
    const content = activeTab === "ui_element" ? uiElementContent : sensitiveInfoContent;
    const version = activeTab === "ui_element" ? uiElementVersion : sensitiveInfoVersion;
    const promptType = activeTab;

    if (!name.trim() || !content.trim()) {
      setMessage({ type: "error", text: "Name and content are required" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (isCreatingNew) {
        const id = await createPrompt({
          type: promptType,
          name,
          version,
          content,
          source: "custom",
        });

        if (activeTab === "ui_element") {
          setSelectedUiElementId(id);
        } else {
          setSelectedSensitiveInfoId(id);
        }

        setIsCreatingNew(false);
        setMessage({ type: "success", text: "Prompt created!" });
      } else {
        const selectedId = activeTab === "ui_element" ? selectedUiElementId : selectedSensitiveInfoId;

        if (selectedId) {
          await updatePrompt({ id: selectedId, name, version, content });
          setMessage({ type: "success", text: "Saved!" });
        }
      }
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Failed to save:", error);
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle apply for detection
  const handleApply = async () => {
    if (!processId) return;

    setIsApplying(true);
    setMessage(null);

    try {
      if (activeTab === "ui_element" && selectedUiElementId) {
        await setUiElementPrompt({
          processId: processId as Id<"processes">,
          promptId: selectedUiElementId,
        });
      } else if (activeTab === "sensitive_info" && selectedSensitiveInfoId) {
        await setSensitiveInfoPrompt({
          processId: processId as Id<"processes">,
          promptId: selectedSensitiveInfoId,
        });
      }

      setMessage({ type: "success", text: "Applied! Ready for detection." });
      onApply?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to apply:", error);
      setMessage({ type: "error", text: "Failed to apply" });
    } finally {
      setIsApplying(false);
    }
  };

  // Apply both prompts at once
  const handleApplyBoth = async () => {
    if (!processId) return;

    setIsApplying(true);
    setMessage(null);

    try {
      if (selectedUiElementId) {
        await setUiElementPrompt({
          processId: processId as Id<"processes">,
          promptId: selectedUiElementId,
        });
      }
      if (selectedSensitiveInfoId) {
        await setSensitiveInfoPrompt({
          processId: processId as Id<"processes">,
          promptId: selectedSensitiveInfoId,
        });
      }

      setMessage({ type: "success", text: "Both prompts applied!" });
      onApply?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to apply:", error);
      setMessage({ type: "error", text: "Failed to apply" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ui_element" className="gap-2">
            <Target className="w-4 h-4" />
            UI Element
          </TabsTrigger>
          <TabsTrigger value="sensitive_info" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Sensitive Info
          </TabsTrigger>
        </TabsList>

        {/* UI Element Detection Tab */}
        <TabsContent value="ui_element" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedUiElementId || ""}
              onChange={(e) => {
                setSelectedUiElementId(e.target.value as Id<"prompts"> || null);
                setIsCreatingNew(false);
              }}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select UI Element Detection Prompt --</option>
              {uiElementPrompts?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.version}){p.isDefault ? " ★" : ""}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Name</label>
              <Input
                value={uiElementName}
                onChange={(e) => setUiElementName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Version</label>
              <Input
                value={uiElementVersion}
                onChange={(e) => setUiElementVersion(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Content</label>
            <Textarea
              value={uiElementContent}
              onChange={(e) => setUiElementContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="Enter UI element detection prompt... Use {elementName}, {elementType}, etc. as placeholders."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Placeholders: {"{elementName}"}, {"{elementType}"}, {"{locationDescription}"}, {"{screenRegion}"}, {"{description}"}
            </p>
          </div>
        </TabsContent>

        {/* Sensitive Info Detection Tab */}
        <TabsContent value="sensitive_info" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedSensitiveInfoId || ""}
              onChange={(e) => {
                setSelectedSensitiveInfoId(e.target.value as Id<"prompts"> || null);
                setIsCreatingNew(false);
              }}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select Sensitive Info Detection Prompt --</option>
              {sensitiveInfoPrompts?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.version}){p.isDefault ? " ★" : ""}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Name</label>
              <Input
                value={sensitiveInfoName}
                onChange={(e) => setSensitiveInfoName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Version</label>
              <Input
                value={sensitiveInfoVersion}
                onChange={(e) => setSensitiveInfoVersion(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Content</label>
            <Textarea
              value={sensitiveInfoContent}
              onChange={(e) => setSensitiveInfoContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="Enter sensitive info detection prompt... Use {userDefinition}, {stepDescription} as placeholders."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Placeholders: {"{userDefinition}"}, {"{stepDescription}"}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-1" />
          )}
          {isCreatingNew ? "Create New" : "Save Changes"}
        </Button>

        {/* Message */}
        {message && (
          <span className={`text-sm flex items-center gap-1 ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </span>
        )}
      </div>

      {/* Apply Buttons */}
      {processId && (
        <div className="pt-3 border-t space-y-2">
          <Button
            onClick={handleApply}
            disabled={isApplying || (activeTab === "ui_element" ? !selectedUiElementId : !selectedSensitiveInfoId)}
            className="w-full"
            variant="outline"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply {activeTab === "ui_element" ? "UI Element" : "Sensitive Info"} Prompt
              </>
            )}
          </Button>

          <Button
            onClick={handleApplyBoth}
            disabled={isApplying || !selectedUiElementId || !selectedSensitiveInfoId}
            className="w-full"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply Both Detection Prompts
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground mt-2 text-center">
            Selected prompts will be used when you run detection on this process
          </p>
        </div>
      )}
    </div>
  );
}
