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
  FileText,
  Code,
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Save,
  Plus,
  Cpu,
} from "lucide-react";

interface AnalysisPromptEditorProps {
  processId?: string;
  onApply?: () => void;
}

export function AnalysisPromptEditor({ processId, onApply }: AnalysisPromptEditorProps) {
  const [activeTab, setActiveTab] = useState<"system" | "user" | "schema">("system");

  // Selected prompt IDs
  const [selectedSystemId, setSelectedSystemId] = useState<Id<"systemPrompts"> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<Id<"userPrompts"> | null>(null);
  const [selectedSchemaId, setSelectedSchemaId] = useState<Id<"jsonSchemas"> | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");

  // Editing state for each tab
  const [systemContent, setSystemContent] = useState("");
  const [systemName, setSystemName] = useState("");
  const [systemVersion, setSystemVersion] = useState("");

  const [userContent, setUserContent] = useState("");
  const [userName, setUserName] = useState("");
  const [userVersion, setUserVersion] = useState("");

  const [schemaContent, setSchemaContent] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("");

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Queries
  const systemPrompts = useQuery(api.analysisPrompts.listSystemPrompts);
  const userPrompts = useQuery(api.analysisPrompts.listUserPrompts);
  const jsonSchemas = useQuery(api.analysisPrompts.listJsonSchemas);
  const models = useQuery(api.workflows.getAvailableModels);
  const savedModel = useQuery(api.settings.getSetting, { key: "analysis_model" });

  // Get process current prompts
  const processPrompts = useQuery(
    api.processes.getProcessPrompts,
    processId ? { processId: processId as Id<"processes"> } : "skip"
  );

  // Mutations
  const createSystemPrompt = useMutation(api.analysisPrompts.createSystemPrompt);
  const createUserPrompt = useMutation(api.analysisPrompts.createUserPrompt);
  const createJsonSchema = useMutation(api.analysisPrompts.createJsonSchema);
  const updateSystemPrompt = useMutation(api.analysisPrompts.updateSystemPrompt);
  const updateUserPrompt = useMutation(api.analysisPrompts.updateUserPrompt);
  const updateJsonSchema = useMutation(api.analysisPrompts.updateJsonSchema);
  const setProcessPrompts = useMutation(api.processes.setProcessPrompts);
  const setSetting = useMutation(api.settings.setSetting);

  // Load model from settings
  useEffect(() => {
    if (savedModel?.value && !savedModel.isSecret) {
      setSelectedModel(savedModel.value);
    }
  }, [savedModel]);

  // Initialize selections from process or defaults
  useEffect(() => {
    if (processPrompts) {
      if (processPrompts.systemPromptId) {
        setSelectedSystemId(processPrompts.systemPromptId);
      }
      if (processPrompts.userPromptId) {
        setSelectedUserId(processPrompts.userPromptId);
      }
      if (processPrompts.jsonSchemaId) {
        setSelectedSchemaId(processPrompts.jsonSchemaId);
      }
    } else {
      // Set to defaults if available
      if (systemPrompts?.length && !selectedSystemId) {
        const defaultPrompt = systemPrompts.find(p => p.isDefault) || systemPrompts[0];
        if (defaultPrompt) setSelectedSystemId(defaultPrompt._id);
      }
      if (userPrompts?.length && !selectedUserId) {
        const defaultPrompt = userPrompts.find(p => p.isDefault) || userPrompts[0];
        if (defaultPrompt) setSelectedUserId(defaultPrompt._id);
      }
      if (jsonSchemas?.length && !selectedSchemaId) {
        const defaultSchema = jsonSchemas.find(s => s.isDefault) || jsonSchemas[0];
        if (defaultSchema) setSelectedSchemaId(defaultSchema._id);
      }
    }
  }, [processPrompts, systemPrompts, userPrompts, jsonSchemas]);

  // Load system prompt content when selected
  useEffect(() => {
    if (selectedSystemId && systemPrompts) {
      const prompt = systemPrompts.find(p => p._id === selectedSystemId);
      if (prompt) {
        setSystemContent(prompt.content);
        setSystemName(prompt.name);
        setSystemVersion(prompt.version);
        setIsCreatingNew(false);
      }
    }
  }, [selectedSystemId, systemPrompts]);

  // Load user prompt content when selected
  useEffect(() => {
    if (selectedUserId && userPrompts) {
      const prompt = userPrompts.find(p => p._id === selectedUserId);
      if (prompt) {
        setUserContent(prompt.content);
        setUserName(prompt.name);
        setUserVersion(prompt.version);
        setIsCreatingNew(false);
      }
    }
  }, [selectedUserId, userPrompts]);

  // Load schema content when selected
  useEffect(() => {
    if (selectedSchemaId && jsonSchemas) {
      const schema = jsonSchemas.find(s => s._id === selectedSchemaId);
      if (schema) {
        setSchemaContent(schema.content);
        setSchemaName(schema.name);
        setSchemaVersion(schema.version);
        setIsCreatingNew(false);
      }
    }
  }, [selectedSchemaId, jsonSchemas]);

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

  // Handle creating new prompt
  const handleCreateNew = () => {
    setIsCreatingNew(true);
    if (activeTab === "system") {
      setSystemName("New System Prompt");
      setSystemVersion("v1");
      setSystemContent("");
      setSelectedSystemId(null);
    } else if (activeTab === "user") {
      setUserName("New User Prompt");
      setUserVersion("v1");
      setUserContent("");
      setSelectedUserId(null);
    } else {
      setSchemaName("New Schema");
      setSchemaVersion("v1");
      setSchemaContent("");
      setSelectedSchemaId(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    const name = activeTab === "system" ? systemName : activeTab === "user" ? userName : schemaName;
    const content = activeTab === "system" ? systemContent : activeTab === "user" ? userContent : schemaContent;
    const version = activeTab === "system" ? systemVersion : activeTab === "user" ? userVersion : schemaVersion;

    if (!name.trim() || !content.trim()) {
      setMessage({ type: "error", text: "Name and content are required" });
      return;
    }

    if (activeTab === "schema" && !validateSchema(content)) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (isCreatingNew) {
        if (activeTab === "system") {
          const id = await createSystemPrompt({
            name, version, versionNumber: 1, content, source: "custom",
          });
          setSelectedSystemId(id);
        } else if (activeTab === "user") {
          const id = await createUserPrompt({
            name, version, versionNumber: 1, content, source: "custom",
          });
          setSelectedUserId(id);
        } else {
          const id = await createJsonSchema({
            name, version, versionNumber: 1, content, source: "custom",
          });
          setSelectedSchemaId(id);
        }
        setIsCreatingNew(false);
        setMessage({ type: "success", text: "Prompt created!" });
      } else {
        if (activeTab === "system" && selectedSystemId) {
          await updateSystemPrompt({ id: selectedSystemId, name, version, content });
        } else if (activeTab === "user" && selectedUserId) {
          await updateUserPrompt({ id: selectedUserId, name, version, content });
        } else if (activeTab === "schema" && selectedSchemaId) {
          await updateJsonSchema({ id: selectedSchemaId, name, version, content });
        }
        setMessage({ type: "success", text: "Saved!" });
      }
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error("Failed to save:", error);
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle apply for re-analysis
  const handleApply = async () => {
    if (!processId) return;
    if (!selectedSystemId || !selectedUserId || !selectedSchemaId) {
      setMessage({ type: "error", text: "Please select all three prompts" });
      return;
    }

    setIsApplying(true);
    setMessage(null);

    try {
      await setProcessPrompts({
        processId: processId as Id<"processes">,
        systemPromptId: selectedSystemId,
        userPromptId: selectedUserId,
        jsonSchemaId: selectedSchemaId,
      });
      await setSetting({ key: "analysis_model", value: selectedModel, isSecret: false });

      setMessage({ type: "success", text: "Applied! Ready for re-analysis." });
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
      {/* Model Selection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Cpu className="w-4 h-4" />
          Model:
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="flex-1 p-2 border rounded-md bg-background text-sm"
        >
          {models?.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          )) || (
            <>
              <option value="gemini-3-flash-preview">Gemini 3 Flash - Fast multimodal</option>
              <option value="gemini-3-pro-preview">Gemini 3 Pro - Advanced reasoning</option>
            </>
          )}
        </select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="system" className="gap-2">
            <FileText className="w-4 h-4" />
            System
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            User
          </TabsTrigger>
          <TabsTrigger value="schema" className="gap-2">
            <Code className="w-4 h-4" />
            Schema
          </TabsTrigger>
        </TabsList>

        {/* System Prompt Tab */}
        <TabsContent value="system" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedSystemId || ""}
              onChange={(e) => {
                setSelectedSystemId(e.target.value as Id<"systemPrompts"> || null);
                setIsCreatingNew(false);
              }}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select System Prompt --</option>
              {systemPrompts?.map((p) => (
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
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Version</label>
              <Input
                value={systemVersion}
                onChange={(e) => setSystemVersion(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Content</label>
            <Textarea
              value={systemContent}
              onChange={(e) => setSystemContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="Enter system prompt..."
            />
          </div>
        </TabsContent>

        {/* User Prompt Tab */}
        <TabsContent value="user" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedUserId || ""}
              onChange={(e) => {
                setSelectedUserId(e.target.value as Id<"userPrompts"> || null);
                setIsCreatingNew(false);
              }}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select User Prompt --</option>
              {userPrompts?.map((p) => (
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
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Version</label>
              <Input
                value={userVersion}
                onChange={(e) => setUserVersion(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Content</label>
            <Textarea
              value={userContent}
              onChange={(e) => setUserContent(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="Enter user prompt..."
            />
          </div>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedSchemaId || ""}
              onChange={(e) => {
                setSelectedSchemaId(e.target.value as Id<"jsonSchemas"> || null);
                setIsCreatingNew(false);
              }}
              className="flex-1 p-2 border rounded-md bg-background text-sm"
            >
              <option value="">-- Select JSON Schema --</option>
              {jsonSchemas?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.version}){s.isDefault ? " ★" : ""}
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
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Version</label>
              <Input
                value={schemaVersion}
                onChange={(e) => setSchemaVersion(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Content</label>
            <Textarea
              value={schemaContent}
              onChange={(e) => {
                setSchemaContent(e.target.value);
                if (schemaError) validateSchema(e.target.value);
              }}
              className={`min-h-[200px] font-mono text-xs ${schemaError ? "border-red-500" : ""}`}
              placeholder='{"type": "object", ...}'
            />
            {schemaError && (
              <div className="flex items-center gap-2 mt-1 text-red-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>Invalid JSON: {schemaError}</span>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isSaving || (activeTab === "schema" && !!schemaError)}
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

      {/* Apply Button */}
      {processId && (
        <div className="pt-3 border-t">
          <Button
            onClick={handleApply}
            disabled={isApplying || !selectedSystemId || !selectedUserId || !selectedSchemaId}
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
                Apply for Re-analysis
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Selected prompts will be used when you re-analyze this video
          </p>
        </div>
      )}
    </div>
  );
}
