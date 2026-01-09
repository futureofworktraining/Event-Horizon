"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface CloneScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processId: string;
  targetStepId: string;
  currentStepNumber?: number;
  onCloned: () => void;
}

export function CloneScreenshotDialog({
  open,
  onOpenChange,
  processId,
  targetStepId,
  currentStepNumber,
  onCloned,
}: CloneScreenshotDialogProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useQuery(
    api.steps.getStepsForProcess,
    processId ? { processId: processId as Id<"processes"> } : "skip"
  );

  const cloneScreenshotFromStep = useAction(api.stepsActions.cloneScreenshotFromStep);

  // Filter to only steps with screenshots (excluding current step)
  const availableSteps = steps?.filter(
    (step) => step.hasScreenshot && step._id !== targetStepId
  );

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedStepId(null);
      setIsCloning(false);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleClone = async () => {
    if (!selectedStepId) {
      setError("Please select a step to clone from");
      return;
    }

    setIsCloning(true);
    setError(null);

    try {
      await cloneScreenshotFromStep({
        targetStepId: targetStepId as Id<"steps">,
        sourceStepId: selectedStepId as Id<"steps">,
      });

      onCloned();
      onOpenChange(false);
    } catch (err) {
      console.error("Clone failed:", err);
      setError(err instanceof Error ? err.message : "Failed to clone screenshot");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Clone Screenshot from Another Step</DialogTitle>
          <DialogDescription>
            Select a step to copy its screenshot to this step.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {!availableSteps || availableSteps.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No other steps with screenshots available to clone from.
            </div>
          ) : (
            <div className="space-y-2">
              {availableSteps.map((step) => (
                <button
                  key={step._id}
                  onClick={() => setSelectedStepId(step._id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    selectedStepId === step._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-24 h-16 bg-gray-100 rounded overflow-hidden">
                    {step.screenshotUrl ? (
                      <img
                        src={step.screenshotUrl}
                        alt={`Step ${step.stepNumber}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Step info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        Step {step.stepNumber}
                      </span>
                      {currentStepNumber && (
                        <span className="text-xs text-gray-400">
                          {step.stepNumber < currentStepNumber
                            ? `${currentStepNumber - step.stepNumber} step${currentStepNumber - step.stepNumber > 1 ? "s" : ""} before`
                            : `${step.stepNumber - currentStepNumber} step${step.stepNumber - currentStepNumber > 1 ? "s" : ""} after`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-0.5">
                      {step.description}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedStepId === step._id
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedStepId === step._id && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={!selectedStepId || isCloning}
          >
            {isCloning ? "Cloning..." : "Clone Screenshot"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
