"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Key, Bell, Palette, Check, AlertCircle, Eye, EyeOff, FileText, Code, MessageSquare, X, Save, Plus, Star, Trash2 } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

type PromptType = "system" | "user" | "schema";

interface SelectedItem {
  type: PromptType;
  id: string;
  name: string;
  version: string;
  description: string;
  content: string;
  isDefault?: boolean;
}

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Prompt state
  const [activePromptTab, setActivePromptTab] = useState("system");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedVersion, setEditedVersion] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [promptMessage, setPromptMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const apiKeyStatus = useQuery(api.settings.getApiKeyStatus);
  const updateGeminiApiKey = useAction(api.settingsActions.updateGeminiApiKey);

  // Prompt queries
  const systemPrompts = useQuery(api.analysisPrompts.listSystemPrompts);
  const userPrompts = useQuery(api.analysisPrompts.listUserPrompts);
  const jsonSchemas = useQuery(api.analysisPrompts.listJsonSchemas);

  // Mutations
  const updateSystemPrompt = useMutation(api.analysisPrompts.updateSystemPrompt);
  const updateUserPrompt = useMutation(api.analysisPrompts.updateUserPrompt);
  const updateJsonSchema = useMutation(api.analysisPrompts.updateJsonSchema);
  const createSystemPrompt = useMutation(api.analysisPrompts.createSystemPrompt);
  const createUserPrompt = useMutation(api.analysisPrompts.createUserPrompt);
  const createJsonSchema = useMutation(api.analysisPrompts.createJsonSchema);
  const setDefaultSystemPrompt = useMutation(api.analysisPrompts.setDefaultSystemPrompt);
  const setDefaultUserPrompt = useMutation(api.analysisPrompts.setDefaultUserPrompt);
  const setDefaultJsonSchema = useMutation(api.analysisPrompts.setDefaultJsonSchema);
  const deactivateSystemPrompt = useMutation(api.analysisPrompts.deactivateSystemPrompt);
  const deactivateUserPrompt = useMutation(api.analysisPrompts.deactivateUserPrompt);
  const deactivateJsonSchema = useMutation(api.analysisPrompts.deactivateJsonSchema);

  const handleUpdateApiKey = async () => {
    if (!apiKey.trim()) {
      setUpdateMessage({ type: "error", text: "Please enter an API key" });
      return;
    }

    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      const result = await updateGeminiApiKey({ apiKey: apiKey.trim() });
      if (result.success) {
        setUpdateMessage({ type: "success", text: "API key updated successfully!" });
        setApiKey("");
      } else {
        setUpdateMessage({ type: "error", text: result.error || "Failed to update API key" });
      }
    } catch {
      setUpdateMessage({ type: "error", text: "An error occurred while updating the API key" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectItem = (type: PromptType, item: any) => {
    const selected: SelectedItem = {
      type,
      id: item._id,
      name: item.name,
      version: item.version || "-",
      description: item.description || "",
      content: item.content || "",
      isDefault: item.isDefault || false,
    };
    setSelectedItem(selected);
    setEditedContent(selected.content);
    setEditedName(selected.name);
    setEditedDescription(selected.description);
    setEditedVersion(selected.version);
    setNewVersion("");
  };

  const handleCloseEditor = () => {
    setSelectedItem(null);
    setEditedContent("");
    setEditedName("");
    setEditedDescription("");
    setEditedVersion("");
    setNewVersion("");
  };

  const handleSaveExisting = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    setPromptMessage(null);

    try {
      if (selectedItem.type === "system") {
        await updateSystemPrompt({
          id: selectedItem.id as Id<"systemPrompts">,
          version: editedVersion,
          name: editedName,
          description: editedDescription,
          content: editedContent,
        });
      } else if (selectedItem.type === "user") {
        await updateUserPrompt({
          id: selectedItem.id as Id<"userPrompts">,
          version: editedVersion,
          name: editedName,
          description: editedDescription,
          content: editedContent,
        });
      } else if (selectedItem.type === "schema") {
        await updateJsonSchema({
          id: selectedItem.id as Id<"jsonSchemas">,
          version: editedVersion,
          name: editedName,
          description: editedDescription,
          content: editedContent,
        });
      }
      setPromptMessage({ type: "success", text: "Saved successfully!" });
      setTimeout(() => setPromptMessage(null), 3000);
    } catch (error) {
      setPromptMessage({ type: "error", text: "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!selectedItem || !newVersion.trim()) {
      setPromptMessage({ type: "error", text: "Please enter a version for the new prompt" });
      return;
    }
    setIsSaving(true);
    setPromptMessage(null);

    try {
      const versionNumber = parseInt(newVersion.replace(/[^0-9]/g, "")) || Date.now();

      if (selectedItem.type === "system") {
        await createSystemPrompt({
          version: newVersion,
          versionNumber,
          name: editedName,
          description: editedDescription,
          content: editedContent,
          source: "custom",
        });
      } else if (selectedItem.type === "user") {
        await createUserPrompt({
          version: newVersion,
          versionNumber,
          name: editedName,
          description: editedDescription,
          content: editedContent,
          source: "custom",
        });
      } else if (selectedItem.type === "schema") {
        await createJsonSchema({
          version: newVersion,
          versionNumber,
          name: editedName,
          description: editedDescription,
          content: editedContent,
          source: "custom",
        });
      }
      setPromptMessage({ type: "success", text: "Created new version!" });
      setNewVersion("");
      setTimeout(() => setPromptMessage(null), 3000);
    } catch (error) {
      setPromptMessage({ type: "error", text: "Failed to create new version" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (type: PromptType, id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    try {
      if (type === "system") {
        await setDefaultSystemPrompt({ id: id as Id<"systemPrompts"> });
      } else if (type === "user") {
        await setDefaultUserPrompt({ id: id as Id<"userPrompts"> });
      } else if (type === "schema") {
        await setDefaultJsonSchema({ id: id as Id<"jsonSchemas"> });
      }
      setPromptMessage({ type: "success", text: "Default updated!" });
      setTimeout(() => setPromptMessage(null), 3000);
    } catch {
      setPromptMessage({ type: "error", text: "Failed to set default" });
    }
  };

  const handleDelete = async (type: PromptType, id: string, isDefault: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click

    if (isDefault) {
      setPromptMessage({ type: "error", text: "Cannot delete the default prompt. Set another as default first." });
      setTimeout(() => setPromptMessage(null), 3000);
      return;
    }

    if (!confirm("Are you sure you want to delete this prompt?")) {
      return;
    }

    try {
      if (type === "system") {
        await deactivateSystemPrompt({ id: id as Id<"systemPrompts"> });
      } else if (type === "user") {
        await deactivateUserPrompt({ id: id as Id<"userPrompts"> });
      } else if (type === "schema") {
        await deactivateJsonSchema({ id: id as Id<"jsonSchemas"> });
      }

      // Clear selection if deleted item was selected
      if (selectedItem?.id === id) {
        handleCloseEditor();
      }

      setPromptMessage({ type: "success", text: "Prompt deleted!" });
      setTimeout(() => setPromptMessage(null), 3000);
    } catch {
      setPromptMessage({ type: "error", text: "Failed to delete prompt" });
    }
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your Event Horizon AI preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-600" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Manage your API keys and external service connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Gemini API Key Status</span>
                {apiKeyStatus?.isConfigured ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    Not configured
                  </span>
                )}
              </div>
              {apiKeyStatus?.isConfigured && (
                <div className="text-xs text-muted-foreground">
                  Current key: {apiKeyStatus.maskedValue}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your Gemini API key (AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" onClick={handleUpdateApiKey} disabled={isUpdating || !apiKey.trim()}>
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </div>

            {updateMessage && (
              <div className={`text-sm p-2 rounded ${updateMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {updateMessage.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Prompts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              Analysis Prompts
            </CardTitle>
            <CardDescription>
              Manage prompt versions. Click a row to edit. Click the star to set as default for video analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {promptMessage && (
              <div className={`text-sm p-2 rounded mb-4 ${promptMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {promptMessage.text}
              </div>
            )}

            <div className="flex gap-4">
              {/* Left: Table */}
              <div className="w-1/2">
                <Tabs value={activePromptTab} onValueChange={(v) => { setActivePromptTab(v); setSelectedItem(null); }}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="system" className="gap-1.5 text-xs">
                      <FileText className="w-3.5 h-3.5" />
                      System
                    </TabsTrigger>
                    <TabsTrigger value="user" className="gap-1.5 text-xs">
                      <MessageSquare className="w-3.5 h-3.5" />
                      User
                    </TabsTrigger>
                    <TabsTrigger value="schema" className="gap-1.5 text-xs">
                      <Code className="w-3.5 h-3.5" />
                      Schema
                    </TabsTrigger>
                  </TabsList>

                  {/* System Prompts Table */}
                  <TabsContent value="system">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-center p-2 font-medium w-12">Default</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-left p-2 font-medium w-16">Version</th>
                            <th className="text-right p-2 font-medium w-14">Size</th>
                            <th className="text-center p-2 font-medium w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {systemPrompts?.map((prompt) => (
                            <tr
                              key={prompt._id}
                              onClick={() => handleSelectItem("system", prompt)}
                              className={`border-t cursor-pointer hover:bg-muted/30 ${selectedItem?.id === prompt._id ? "bg-violet-50 dark:bg-violet-950/30" : ""}`}
                            >
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleSetDefault("system", prompt._id, e)}
                                  className="hover:scale-110 transition-transform"
                                  title={prompt.isDefault ? "Current default" : "Set as default"}
                                >
                                  <Star className={`w-4 h-4 ${prompt.isDefault ? "text-violet-600 fill-violet-600" : "text-gray-300 hover:text-violet-400"}`} />
                                </button>
                              </td>
                              <td className="p-2">
                                <div className="font-medium">{prompt.name}</div>
                                {prompt.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{prompt.description}</div>}
                              </td>
                              <td className="p-2">
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{prompt.version}</span>
                              </td>
                              <td className="p-2 text-right text-xs text-muted-foreground">{prompt.content?.length || 0}</td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleDelete("system", prompt._id, prompt.isDefault || false, e)}
                                  className={`hover:scale-110 transition-transform ${prompt.isDefault ? "opacity-30 cursor-not-allowed" : "hover:text-red-500"}`}
                                  title={prompt.isDefault ? "Cannot delete default" : "Delete prompt"}
                                >
                                  <Trash2 className="w-4 h-4 text-gray-400" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!systemPrompts?.length && (
                            <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No system prompts found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* User Prompts Table */}
                  <TabsContent value="user">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-center p-2 font-medium w-12">Default</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-left p-2 font-medium w-16">Version</th>
                            <th className="text-right p-2 font-medium w-14">Size</th>
                            <th className="text-center p-2 font-medium w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {userPrompts?.map((prompt) => (
                            <tr
                              key={prompt._id}
                              onClick={() => handleSelectItem("user", prompt)}
                              className={`border-t cursor-pointer hover:bg-muted/30 ${selectedItem?.id === prompt._id ? "bg-violet-50 dark:bg-violet-950/30" : ""}`}
                            >
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleSetDefault("user", prompt._id, e)}
                                  className="hover:scale-110 transition-transform"
                                  title={prompt.isDefault ? "Current default" : "Set as default"}
                                >
                                  <Star className={`w-4 h-4 ${prompt.isDefault ? "text-violet-600 fill-violet-600" : "text-gray-300 hover:text-violet-400"}`} />
                                </button>
                              </td>
                              <td className="p-2">
                                <div className="font-medium">{prompt.name}</div>
                                {prompt.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{prompt.description}</div>}
                              </td>
                              <td className="p-2">
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{prompt.version}</span>
                              </td>
                              <td className="p-2 text-right text-xs text-muted-foreground">{prompt.content?.length || 0}</td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleDelete("user", prompt._id, prompt.isDefault || false, e)}
                                  className={`hover:scale-110 transition-transform ${prompt.isDefault ? "opacity-30 cursor-not-allowed" : "hover:text-red-500"}`}
                                  title={prompt.isDefault ? "Cannot delete default" : "Delete prompt"}
                                >
                                  <Trash2 className="w-4 h-4 text-gray-400" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!userPrompts?.length && (
                            <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No user prompts found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* JSON Schemas Table */}
                  <TabsContent value="schema">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-center p-2 font-medium w-12">Default</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-left p-2 font-medium w-16">Version</th>
                            <th className="text-right p-2 font-medium w-14">Size</th>
                            <th className="text-center p-2 font-medium w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {jsonSchemas?.map((schema) => (
                            <tr
                              key={schema._id}
                              onClick={() => handleSelectItem("schema", schema)}
                              className={`border-t cursor-pointer hover:bg-muted/30 ${selectedItem?.id === schema._id ? "bg-violet-50 dark:bg-violet-950/30" : ""}`}
                            >
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleSetDefault("schema", schema._id, e)}
                                  className="hover:scale-110 transition-transform"
                                  title={schema.isDefault ? "Current default" : "Set as default"}
                                >
                                  <Star className={`w-4 h-4 ${schema.isDefault ? "text-violet-600 fill-violet-600" : "text-gray-300 hover:text-violet-400"}`} />
                                </button>
                              </td>
                              <td className="p-2">
                                <div className="font-medium">{schema.name}</div>
                                {schema.description && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{schema.description}</div>}
                              </td>
                              <td className="p-2">
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{schema.version}</span>
                              </td>
                              <td className="p-2 text-right text-xs text-muted-foreground">{schema.content?.length || 0}</td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={(e) => handleDelete("schema", schema._id, schema.isDefault || false, e)}
                                  className={`hover:scale-110 transition-transform ${schema.isDefault ? "opacity-30 cursor-not-allowed" : "hover:text-red-500"}`}
                                  title={schema.isDefault ? "Cannot delete default" : "Delete prompt"}
                                >
                                  <Trash2 className="w-4 h-4 text-gray-400" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!jsonSchemas?.length && (
                            <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No JSON schemas found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Editor Panel */}
              <div className="w-1/2 border rounded-lg p-4 bg-muted/20">
                {selectedItem ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium">
                        Edit {selectedItem.type === "system" ? "System Prompt" : selectedItem.type === "user" ? "User Prompt" : "JSON Schema"}
                      </h3>
                      <Button variant="ghost" size="sm" onClick={handleCloseEditor}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-24">
                          <label className="text-xs font-medium mb-1 block">Version</label>
                          <Input
                            value={editedVersion}
                            onChange={(e) => setEditedVersion(e.target.value)}
                            className={`text-sm ${
                              selectedItem.type === "system" ? "border-blue-200 focus:border-blue-400" :
                              selectedItem.type === "user" ? "border-green-200 focus:border-green-400" :
                              "border-orange-200 focus:border-orange-400"
                            }`}
                            placeholder="e.g. v2"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium mb-1 block">Name</label>
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">Description</label>
                        <Input
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          className="text-sm"
                          placeholder="Optional description"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium mb-1 block">Content</label>
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="min-h-[300px] font-mono text-xs"
                        />
                        <div className="text-xs text-muted-foreground mt-1">{editedContent.length} characters</div>
                      </div>

                      {/* Save Actions */}
                      <div className="border-t pt-3 space-y-3">
                        <Button onClick={handleSaveExisting} disabled={isSaving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>

                        <div className="border-t pt-3">
                          <label className="text-xs font-medium mb-1 block">Or save as new version</label>
                          <div className="flex gap-2">
                            <Input
                              value={newVersion}
                              onChange={(e) => setNewVersion(e.target.value)}
                              placeholder="e.g. v3"
                              className="text-sm"
                            />
                            <Button variant="outline" onClick={handleSaveAsNew} disabled={isSaving || !newVersion.trim()}>
                              <Plus className="w-4 h-4 mr-1" />
                              Save as New
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            New versions can be set as default for video analysis.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[400px]">
                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">Select a prompt from the table to edit</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other Settings */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-violet-600" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm text-center py-4">Coming soon</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-violet-600" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm text-center py-4">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
