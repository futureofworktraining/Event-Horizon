"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface SensitiveInfoDetectorProps {
  processId: Id<"processes">;
  stepsWithScreenshots: number;
  stepsWithSensitiveDetection: number;
  onDetectionComplete?: () => void;
  variant?: "card" | "embedded";
}

const EXAMPLE_PROMPTS = [
  "SSN (123-45-6789), credit card numbers (4532...), passwords",
  "Patient medical records, health insurance numbers, diagnoses",
  "Employee IDs, salary information, personal phone numbers",
  "API keys, authentication tokens, private keys",
];

export function SensitiveInfoDetector({
  processId,
  stepsWithScreenshots,
  stepsWithSensitiveDetection,
  onDetectionComplete,
  variant = "card",
}: SensitiveInfoDetectorProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    processed: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const detectionAction = useAction(
    api.sensitiveInfoDetection.detectSensitiveInformation
  );
  const savePromptMutation = useMutation(
    api.processes.updateSensitiveInfoPrompt
  );
  const savedPromptQuery = useQuery(
    api.processes.getProcessPrompts,
    { processId }
  );

  // Load saved prompt when component mounts
  const savedPrompt = savedPromptQuery?.sensitiveInfoPrompt;

  useEffect(() => {
    if (savedPrompt && !prompt) {
      setPrompt(savedPrompt);
    }
  }, [savedPrompt]);

  const stepsNeedingDetection = stepsWithScreenshots - stepsWithSensitiveDetection;

  const handleSavePrompt = async () => {
    if (!prompt.trim()) return;
    try {
      await savePromptMutation({ processId, prompt: prompt.trim() });
    } catch (error) {
      console.error("Failed to save prompt:", error);
    }
  };

  const handleDetect = async () => {
    if (!prompt.trim()) {
      setResult({
        success: false,
        processed: 0,
        skipped: 0,
        failed: 1,
        errors: ["Please define what constitutes sensitive information"],
      });
      return;
    }

    setIsDetecting(true);
    setResult(null);

    try {
      // Save prompt first
      await savePromptMutation({ processId, prompt: prompt.trim() });

      // Then run detection
      const detectionResult = await detectionAction({
        processId,
        customPrompt: prompt.trim(),
      });
      setResult(detectionResult);
      setIsEditing(false);
      onDetectionComplete?.();
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

  // Don't show if no screenshots
  // if (stepsWithScreenshots === 0) {
  //   return null;
  // }

  // All done state - but allow editing if user clicks "Edit Definition"
  // All done state - only if result is NOT present
  if (stepsNeedingDetection <= 0 && !result && !isEditing) {
    if (stepsWithSensitiveDetection > 0) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <ShieldAlert className="h-5 w-5" />
              Sensitive Information Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700 mb-3">
              {stepsWithSensitiveDetection} step(s) have sensitive areas marked
              with red boxes.
            </p>
            <p className="text-xs text-red-600">
              <strong>Current definition:</strong> {savedPrompt || "Not defined"}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setPrompt(savedPrompt || "");
                setIsEditing(true);
              }}
            >
              Edit Definition
            </Button>
          </CardContent>
        </Card>
      );
    }

    // If we're here, it means stepsNeedingDetection <= 0 but also stepsWithSensitiveDetection is 0.
    // We should still allow the user to run detection if there are screenshots.
  }

  if (variant === "embedded") {
    return (
      <div className="bg-orange-50 rounded-lg p-4">
        {stepsWithScreenshots === 0 && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-xs border border-yellow-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Warning: No screenshots found in this process. Detection requires screenshots.
          </div>
        )}
        {/* Header skipped or simplified for embedded mode */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-orange-900">
              Define Sensitive Information
            </label>
            <p className="text-xs text-orange-700 mb-2">
              Describe what information should be marked as sensitive.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., SSN (123-45-6789), credit card numbers, passwords, employee IDs"
              className="min-h-16 text-sm border-orange-200 bg-white"
              disabled={isDetecting}
            />
            <div className="mt-2">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="text-xs text-orange-600 hover:text-orange-700 underline"
              >
                {showExamples ? "Hide" : "Show"} example prompts
              </button>
              {showExamples && (
                <div className="mt-2 space-y-1 p-2 bg-orange-100 rounded text-xs">
                  {EXAMPLE_PROMPTS.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(example)}
                      className="block w-full text-left text-orange-700 hover:text-orange-900 hover:underline"
                    >
                      • {example}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {result && (
            <div
              className={`p-3 rounded text-sm ${result.success
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
                }`}
            >
              <div className="font-medium mb-1">
                {result.success
                  ? `✓ Detection Complete`
                  : `✗ Detection Failed`}
              </div>
              <div className="text-xs">
                <div>
                  Processed: <strong>{result.processed}</strong> steps
                </div>
                <div>
                  Skipped: <strong>{result.skipped}</strong> steps
                </div>
                {result.failed > 0 && <div>Failed: <strong>{result.failed}</strong> steps</div>}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="opacity-80">
                      • {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {isEditing && (
              <Button
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setPrompt("");
                  setResult(null);
                }}
                disabled={isDetecting}
                variant="ghost"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSavePrompt}
              disabled={!prompt.trim() || isDetecting}
              variant="outline"
              className="bg-white border-orange-200"
            >
              Save Definition
            </Button>
            <Button
              size="sm"
              onClick={() => handleDetect()}
              disabled={!prompt.trim() || isDetecting}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isDetecting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                  Detecting...
                </>
              ) : (
                "Detect Sensitive Information"
              )}
            </Button>
          </div>

          <p className="text-xs text-orange-700">
            {isEditing ? (
              <>ℹ️ Re-running detection will update all {stepsWithScreenshots} screenshot(s) with the new definition.</>
            ) : (
              <>ℹ️ Detection will scan {stepsNeedingDetection > 0 ? stepsNeedingDetection : stepsWithScreenshots} screenshot(s) and mark sensitive areas with red boxes.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-orange-800">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4" />
            <path d="M10 12h4" />
          </svg>
          Detect Sensitive Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm font-medium text-orange-900">
            Define Sensitive Information
          </label>
          <p className="text-xs text-orange-700 mb-2">
            Describe what information should be marked as sensitive (e.g.,
            "SSN, credit card numbers, passwords")
          </p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., SSN (123-45-6789), credit card numbers, passwords, employee IDs"
            className="min-h-16 text-sm border-orange-200"
            disabled={isDetecting}
          />
          <div className="mt-2">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs text-orange-600 hover:text-orange-700 underline"
            >
              {showExamples ? "Hide" : "Show"} example prompts
            </button>
            {showExamples && (
              <div className="mt-2 space-y-1 p-2 bg-orange-100 rounded text-xs">
                {EXAMPLE_PROMPTS.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(example)}
                    className="block w-full text-left text-orange-700 hover:text-orange-900 hover:underline"
                  >
                    • {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {result && (
          <div
            className={`p-3 rounded text-sm ${result.success
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
              }`}
          >
            <div className="font-medium mb-1">
              {result.success
                ? `✓ Detection Complete`
                : `✗ Detection Failed`}
            </div>
            <div className="text-xs">
              <div>
                Processed: <strong>{result.processed}</strong> steps
              </div>
              <div>
                Skipped: <strong>{result.skipped}</strong> steps
              </div>
              {result.failed > 0 && <div>Failed: <strong>{result.failed}</strong> steps</div>}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 text-xs">
                {result.errors.map((error, idx) => (
                  <div key={idx} className="opacity-80">
                    • {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {isEditing && (
            <Button
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setPrompt("");
                setResult(null);
              }}
              disabled={isDetecting}
              variant="ghost"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSavePrompt}
            disabled={!prompt.trim() || isDetecting}
            variant="outline"
          >
            Save Definition
          </Button>
          <Button
            size="sm"
            onClick={() => handleDetect()}
            disabled={!prompt.trim() || isDetecting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isDetecting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                Detecting...
              </>
            ) : (
              "Detect Sensitive Information"
            )}
          </Button>
        </div>

        <p className="text-xs text-orange-700">
          {isEditing ? (
            <>ℹ️ Re-running detection will update all {stepsWithScreenshots} screenshot(s) with the new definition.</>
          ) : (
            <>ℹ️ Detection will scan {stepsNeedingDetection > 0 ? stepsNeedingDetection : stepsWithScreenshots} screenshot(s) and mark sensitive areas with red boxes.</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
