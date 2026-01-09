"use client";

import { useState, useEffect } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";

interface BoundingBoxDetectorProps {
  processId: Id<"processes">;
  stepsWithScreenshots: number;
  stepsWithBoundingBoxes: number;
  stepsWithUiElement: number;
  variant?: "card" | "embedded";
}

export function BoundingBoxDetector({
  processId,
  stepsWithScreenshots,
  stepsWithBoundingBoxes,
  stepsWithUiElement,
  variant = "card",
}: BoundingBoxDetectorProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    processed: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const detectBoundingBoxes = useAction(api.boundingBoxes.detectBoundingBoxes);

  // Queries and mutations for prompt
  const savedPromptQuery = useQuery(api.processes.getProcessPrompts, { processId });
  const savePromptMutation = useMutation(api.processes.updateBoundingBoxPrompt);

  const savedPrompt = savedPromptQuery?.boundingBoxPrompt;

  useEffect(() => {
    if (savedPrompt && !prompt) {
      setPrompt(savedPrompt);
    }
  }, [savedPrompt]);

  // Steps that can be processed (have screenshot + uiElement + not yet detected)
  const stepsNeedingDetection = stepsWithUiElement - stepsWithBoundingBoxes;
  const stepsWithoutUiElement = stepsWithScreenshots - stepsWithUiElement;

  const handleSavePrompt = async () => {
    if (!prompt.trim()) return;
    try {
      await savePromptMutation({ processId, prompt: prompt.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save prompt:", error);
    }
  };

  const handleDetect = async () => {
    if (isDetecting) return;
    setIsDetecting(true);
    setResult(null);

    try {
      // Save prompt if editing or changed
      if (prompt.trim()) {
        await savePromptMutation({ processId, prompt: prompt.trim() });
      }

      const detectionResult = await detectBoundingBoxes({
        processId,
        customPrompt: prompt.trim() || undefined
      });
      setResult(detectionResult);
      setIsEditing(false);
    } catch (error) {
      setResult({
        success: false,
        processed: 0,
        skipped: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsDetecting(false);
    }
  };

  // Don't hide if no screenshots, show a message instead
  const hasNoScreenshots = stepsWithScreenshots === 0;

  // All done state - only if result is NOT present (indicating it hasn't just run)
  if (stepsNeedingDetection <= 0 && !result && stepsWithBoundingBoxes > 0) {
    if (variant === "embedded") {
      return (
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-green-800 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            UI Elements Detected
          </h4>
          <p className="text-sm text-green-700">
            {stepsWithBoundingBoxes} step(s) have UI element bounding boxes.
            {stepsWithBoundingBoxes > 0 && " Sensitive data fields are masked with blur effect."}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="mt-2 text-green-700 hover:text-green-800 hover:bg-green-100"
          >
            Edit Prompt & Re-detect
          </Button>
        </div>
      );
    }

    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            UI Elements Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700">
            {stepsWithBoundingBoxes} step(s) have UI element bounding boxes.
            Sensitive data fields are masked with blur effect.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="mt-3 border-green-300 text-green-800 hover:bg-green-100"
          >
            Edit Prompt & Re-detect
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (variant === "embedded") {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="space-y-3">
          {/* Prompt Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-blue-900">Custom Detection Instructions (Optional)</label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                  disabled={isDetecting}
                >
                  {prompt ? "Edit" : "Add Instructions"}
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="E.g. Focus on enabled buttons only, ignore background elements..."
                  className="min-h-20 text-sm border-blue-200 bg-white"
                  disabled={isDetecting}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setPrompt(savedPrompt || "");
                    }}
                    disabled={isDetecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSavePrompt}
                    disabled={isDetecting || !prompt.trim()}
                    className="bg-white border-blue-200"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              prompt ? (
                <p className="text-xs text-blue-800 bg-blue-100 p-2 rounded italic">
                  "{prompt}"
                </p>
              ) : (
                <p className="text-xs text-blue-500 italic">No custom instructions provided (using default detection).</p>
              )
            )}
          </div>

          {result ? (
            <div className={`text-sm ${result.success ? "text-green-700" : "text-amber-700"}`}>
              {result.success ? (
                <p>
                  Successfully detected {result.processed} UI element(s).
                  {result.skipped > 0 && ` ${result.skipped} step(s) skipped (no UI element defined).`}
                </p>
              ) : (
                <>
                  <p>Processed {result.processed}, {result.failed} failed, {result.skipped} skipped.</p>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {result.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {result.errors.length > 3 && (
                        <li>...and {result.errors.length - 3} more</li>
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <strong>{stepsNeedingDetection}</strong> step(s) can have UI elements detected.
              </p>
              {stepsWithoutUiElement > 0 && (
                <p className="text-xs text-blue-600">
                  {stepsWithoutUiElement} step(s) will be skipped (no UI element in step data).
                </p>
              )}
              <p className="text-xs">
                Gemini AI will find the specific UI element for each step.
                Sensitive data fields will be masked.
              </p>
            </div>
          )}

          {isDetecting ? (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Detecting UI elements... This may take a moment.</span>
            </div>
          ) : (
            <Button
              onClick={handleDetect}
              variant="outline"
              className="border-blue-300 hover:bg-blue-100 bg-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 mr-2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Add Bounding Boxes
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-blue-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          UI Element Detection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result ? (
          <div className={`text-sm ${result.success ? "text-green-700" : "text-amber-700"}`}>
            {result.success ? (
              <p>
                Successfully detected {result.processed} UI element(s).
                {result.skipped > 0 && ` ${result.skipped} step(s) skipped (no UI element defined).`}
              </p>
            ) : (
              <>
                <p>Processed {result.processed}, {result.failed} failed, {result.skipped} skipped.</p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-xs">
                    {result.errors.slice(0, 3).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {result.errors.length > 3 && (
                      <li>...and {result.errors.length - 3} more</li>
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-sm text-blue-700 space-y-1">
            <p>
              <strong>{stepsNeedingDetection}</strong> step(s) can have UI elements detected.
            </p>
            {stepsWithoutUiElement > 0 && (
              <p className="text-xs text-blue-600">
                {stepsWithoutUiElement} step(s) will be skipped (no UI element in step data).
              </p>
            )}
            <p className="text-xs">
              Gemini AI will find the specific UI element for each step.
              Sensitive data fields will be masked.
            </p>
          </div>
        )}

        {isDetecting ? (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Detecting UI elements... This may take a moment.</span>
          </div>
        ) : (
          <Button
            onClick={handleDetect}
            variant="outline"
            className="border-blue-300 hover:bg-blue-100 bg-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 mr-2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            Add Bounding Boxes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
