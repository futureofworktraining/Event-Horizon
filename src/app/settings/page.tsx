"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
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
    } catch {
      setUpdateMessage({ type: "error", text: "An error occurred while updating the API key" });
    } finally {
      setIsUpdating(false);
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
