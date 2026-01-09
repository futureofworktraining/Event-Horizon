"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Bell, Palette, Check, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const apiKeyStatus = useQuery(api.settings.getApiKeyStatus);
  const updateGeminiApiKey = useAction(api.settingsActions.updateGeminiApiKey);

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
    } catch (error) {
      setUpdateMessage({ type: "error", text: "An error occurred while updating the API key" });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
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

      <div className="max-w-2xl space-y-6">
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
            {/* Current Status */}
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
                <>
                  <div className="text-xs text-muted-foreground">
                    Current key: {apiKeyStatus.maskedValue}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last updated: {formatDate(apiKeyStatus.lastUpdated)}
                  </div>
                </>
              )}
            </div>

            {/* Update Form */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {apiKeyStatus?.isConfigured ? "Update Gemini API Key" : "Set Gemini API Key"}
              </label>
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
                <Button
                  variant="outline"
                  onClick={handleUpdateApiKey}
                  disabled={isUpdating || !apiKey.trim()}
                >
                  {isUpdating ? "Updating..." : "Update"}
                </Button>
              </div>

              {/* Message */}
              {updateMessage && (
                <div
                  className={`text-sm p-2 rounded ${
                    updateMessage.type === "success"
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}
                >
                  {updateMessage.text}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 hover:underline"
                >
                  Google AI Studio
                </a>
                . Your key is stored securely and never exposed in the UI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-violet-600" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">Notification settings coming soon</p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-violet-600" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">Theme settings coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
