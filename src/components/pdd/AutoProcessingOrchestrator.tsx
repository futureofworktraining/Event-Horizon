"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { extractSingleFrame } from "@/lib/videoFrameExtractor";
import { Camera, Target, Loader2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AutoProcessingOrchestratorProps {
  jobId: Id<"jobs">;
}

type ProcessingPhase = "idle" | "screenshots" | "bounding_boxes" | "sensitive_info" | "complete" | "error";

interface ProcessingState {
  phase: ProcessingPhase;
  currentProcessName: string;
  currentStepNumber: number;
  // Overall progress
  processedScreenshots: number;
  totalScreenshots: number;
  processedBoundingBoxes: number;
  totalBoundingBoxes: number;
  processedSensitiveInfo: number;
  totalSensitiveInfo: number;
  // Errors (keep last 3)
  errors: string[];
}

export function AutoProcessingOrchestrator({ jobId }: AutoProcessingOrchestratorProps) {
  const [state, setState] = useState<ProcessingState>({
    phase: "idle",
    currentProcessName: "",
    currentStepNumber: 0,
    processedScreenshots: 0,
    totalScreenshots: 0,
    processedBoundingBoxes: 0,
    totalBoundingBoxes: 0,
    processedSensitiveInfo: 0,
    totalSensitiveInfo: 0,
    errors: [],
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const processingRef = useRef(false);
  const hasStartedRef = useRef(false);

  // Queries
  const processingStatus = useQuery(api.jobs.getJobProcessingStatus, { jobId });
  const stepsNeedingScreenshots = useQuery(api.jobs.getAllStepsNeedingScreenshots, { jobId });
  const stepsNeedingBoundingBoxes = useQuery(api.jobs.getAllStepsNeedingBoundingBoxes, { jobId });
  const stepsNeedingSensitiveInfo = useQuery(api.jobs.getAllStepsNeedingSensitiveInfo, { jobId });
  const videoUrl = useQuery(
    api.jobs.getVideoUrl,
    processingStatus?.job?.videoStorageId
      ? { storageId: processingStatus.job.videoStorageId }
      : "skip"
  );

  // Refs to hold latest data for async functions
  const stepsNeedingScreenshotsRef = useRef(stepsNeedingScreenshots);
  const stepsNeedingBoundingBoxesRef = useRef(stepsNeedingBoundingBoxes);
  const stepsNeedingSensitiveInfoRef = useRef(stepsNeedingSensitiveInfo);

  // Keep refs updated
  useEffect(() => {
    stepsNeedingScreenshotsRef.current = stepsNeedingScreenshots;
  }, [stepsNeedingScreenshots]);

  useEffect(() => {
    stepsNeedingBoundingBoxesRef.current = stepsNeedingBoundingBoxes;
  }, [stepsNeedingBoundingBoxes]);

  useEffect(() => {
    stepsNeedingSensitiveInfoRef.current = stepsNeedingSensitiveInfo;
  }, [stepsNeedingSensitiveInfo]);

  // Mutations and actions
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const updateStepScreenshot = useMutation(api.jobs.updateStepScreenshot);
  const detectSingleBoundingBox = useAction(api.boundingBoxes.detectSingleBoundingBox);
  const detectSensitiveBoxesSingleStep = useAction(api.sensitiveInfoDetection.detectSensitiveBoxesSingleStep);

  // Add error helper
  const addError = useCallback((error: string) => {
    setState(prev => ({
      ...prev,
      errors: [...prev.errors.slice(-2), error], // Keep last 3 errors
    }));
  }, []);

  // Process screenshots step by step
  const processScreenshots = useCallback(async () => {
    const freshSteps = stepsNeedingScreenshotsRef.current;

    if (!freshSteps || freshSteps.length === 0 || !videoUrl) {
      return true; // No work to do, success
    }

    setState(prev => ({
      ...prev,
      phase: "screenshots",
      totalScreenshots: freshSteps.length,
      processedScreenshots: 0,
    }));

    for (let i = 0; i < freshSteps.length; i++) {
      const step = freshSteps[i];

      setState(prev => ({
        ...prev,
        currentProcessName: step.processName,
        currentStepNumber: step.stepNumber,
        processedScreenshots: i,
      }));

      try {
        // Extract single frame at the step's timestamp
        const blob = await extractSingleFrame(videoUrl, step.timestampSeconds);

        if (blob) {
          // Upload to storage
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: blob,
          });

          if (response.ok) {
            const { storageId } = await response.json();
            await updateStepScreenshot({
              stepId: step.stepId as Id<"steps">,
              screenshotStorageId: storageId,
            });
          } else {
            addError(`Failed to upload screenshot for step ${step.stepNumber}`);
          }
        }
      } catch (error) {
        addError(`Screenshot error: ${step.processName} step ${step.stepNumber}`);
        console.error("Screenshot extraction error:", error);
      }

      // Small delay to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setState(prev => ({
      ...prev,
      processedScreenshots: freshSteps.length,
    }));

    return true;
  }, [videoUrl, generateUploadUrl, updateStepScreenshot, addError]);

  // Process bounding boxes step by step
  const processBoundingBoxes = useCallback(async () => {
    const freshSteps = stepsNeedingBoundingBoxesRef.current;

    if (!freshSteps || freshSteps.length === 0) {
      return false; // No work to do
    }

    setState(prev => ({
      ...prev,
      phase: "bounding_boxes",
      totalBoundingBoxes: freshSteps.length,
      processedBoundingBoxes: 0,
    }));

    for (let i = 0; i < freshSteps.length; i++) {
      const step = freshSteps[i];

      setState(prev => ({
        ...prev,
        currentProcessName: step.processName,
        currentStepNumber: step.stepNumber,
        processedBoundingBoxes: i,
      }));

      try {
        const result = await detectSingleBoundingBox({
          stepId: step.stepId as Id<"steps">,
        });

        if (!result.success) {
          addError(`Bounding box error: ${step.processName} step ${step.stepNumber}`);
        }
      } catch (error) {
        addError(`Bounding box error: ${step.processName} step ${step.stepNumber}`);
        console.error("Bounding box detection error:", error);
      }
    }

    setState(prev => ({
      ...prev,
      processedBoundingBoxes: freshSteps.length,
    }));

    return true;
  }, [detectSingleBoundingBox, addError]);

  // Process sensitive info step by step
  const processSensitiveInfo = useCallback(async () => {
    const freshSteps = stepsNeedingSensitiveInfoRef.current;

    if (!freshSteps || freshSteps.length === 0) {
      return true; // No work to do
    }

    setState(prev => ({
      ...prev,
      phase: "sensitive_info",
      totalSensitiveInfo: freshSteps.length,
      processedSensitiveInfo: 0,
    }));

    for (let i = 0; i < freshSteps.length; i++) {
      const step = freshSteps[i];

      // Skip if weird/empty prompt (should be handled by query but double check)
      if (!step.customPrompt) {
        // If no global prompt and no local prompt, we can't detect
        continue;
      }

      setState(prev => ({
        ...prev,
        currentProcessName: step.processName,
        currentStepNumber: step.stepNumber,
        processedSensitiveInfo: i,
      }));

      try {
        const result = await detectSensitiveBoxesSingleStep({
          stepId: step.stepId as Id<"steps">,
          customPrompt: step.customPrompt, // Use job default or process default
        });

        if (!result.success) {
          addError(`Sensitive info error: ${step.processName} step ${step.stepNumber}`);
        }
      } catch (error) {
        addError(`Sensitive info error: ${step.processName} step ${step.stepNumber}`);
        console.error("Sensitive info detection error:", error);
      }

      // Action has delay built in
    }

    setState(prev => ({
      ...prev,
      processedSensitiveInfo: freshSteps.length,
    }));

    return true;
  }, [detectSensitiveBoxesSingleStep, addError]);

  // Main processing function
  const runProcessing = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // Phase 1: Screenshots
      if (processingStatus?.job.autoExtractScreenshots) {
        await processScreenshots();
      }

      // Small delay before bounding boxes (let queries refresh)
      // This is crucial: wait for the database changes from screenshots 
      // to propagate to the getStepsNeedingBoundingBoxes query
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Phase 2: Bounding boxes
      if (processingStatus?.job.autoBoundingBoxes) {
        const didWork = await processBoundingBoxes();
        if (didWork) {
          toast.success("All bounding boxes generated", {
            description: "UI element detection completed for all steps.",
          });
        }
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Phase 3: Sensitive Info
      if (processingStatus?.job.autoSensitiveInfo) {
        await processSensitiveInfo();
      }

      setState(prev => ({
        ...prev,
        phase: "complete",
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        phase: "error",
        errors: [...prev.errors.slice(-2), `Processing failed: ${error}`],
      }));
    } finally {
      processingRef.current = false;
    }
  }, [processingStatus, processScreenshots, processBoundingBoxes, processSensitiveInfo]);

  // Auto-start when data is ready
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (!processingStatus || !videoUrl) return;

    const shouldProcess =
      (processingStatus.job.autoExtractScreenshots && processingStatus.totals.totalScreenshotsNeeded > 0) ||
      (processingStatus.job.autoBoundingBoxes && processingStatus.totals.totalBoundingBoxesNeeded > 0) ||
      (processingStatus.job.autoSensitiveInfo && processingStatus.totals.totalSensitiveInfoNeeded > 0);

    if (shouldProcess) {
      hasStartedRef.current = true;
      runProcessing();
    }
  }, [processingStatus, videoUrl, runProcessing]);

  // Don't render if dismissed or nothing to show
  if (isDismissed) return null;
  if (!processingStatus) return null;
  if (state.phase === "idle" && !hasStartedRef.current) return null;

  // Auto-hide after completion with no errors
  if (state.phase === "complete" && state.errors.length === 0) {
    // Show briefly then hide
    setTimeout(() => setIsDismissed(true), 3000);
  }

  const totalWork = state.totalScreenshots + state.totalBoundingBoxes + state.totalSensitiveInfo;
  const completedWork = state.processedScreenshots + state.processedBoundingBoxes + state.processedSensitiveInfo;
  const progress = totalWork > 0 ? (completedWork / totalWork) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={cn(
          "bg-white border border-border rounded-lg shadow-lg overflow-hidden transition-all duration-200",
          isMinimized ? "w-64" : "w-80"
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-muted/50 cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            {state.phase === "screenshots" && (
              <>
                <Camera className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium">Extracting Screenshots</span>
              </>
            )}
            {state.phase === "bounding_boxes" && (
              <>
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Detecting UI Elements</span>
              </>
            )}
            {state.phase === "sensitive_info" && (
              <>
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Scanning Sensitive Info</span>
              </>
            )}
            {state.phase === "complete" && (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Processing Complete</span>
              </>
            )}
            {state.phase === "error" && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium">Processing Error</span>
              </>
            )}
            {state.phase === "idle" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Preparing...</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isMinimized ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-3 space-y-3">
            {/* Current step info */}
            {state.currentProcessName && state.phase !== "complete" && state.phase !== "error" && (
              <div className="text-xs">
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="font-medium">{state.currentProcessName}</span>
                </div>
                <div className="text-muted-foreground ml-4">
                  Step {state.currentStepNumber}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {state.phase === "screenshots" && (
                    <>Screenshots: {state.processedScreenshots} / {state.totalScreenshots}</>
                  )}
                  {state.phase === "bounding_boxes" && (
                    <>
                      {state.totalScreenshots > 0 && (
                        <span className="text-green-600 mr-2">
                          {state.processedScreenshots} screenshots
                        </span>
                      )}
                      Boxes: {state.processedBoundingBoxes} / {state.totalBoundingBoxes}
                    </>
                  )}
                  {state.phase === "sensitive_info" && (
                    <>
                      Info: {state.processedSensitiveInfo} / {state.totalSensitiveInfo}
                    </>
                  )}
                  {state.phase === "complete" && (
                    <>
                      {state.processedScreenshots > 0 && `${state.processedScreenshots} screenshots`}
                      {state.processedScreenshots > 0 && state.processedBoundingBoxes > 0 && ", "}
                      {state.processedBoundingBoxes > 0 && `${state.processedBoundingBoxes} boxes`}
                    </>
                  )}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    state.phase === "screenshots" && "bg-amber-500",
                    state.phase === "bounding_boxes" && "bg-blue-500",
                    state.phase === "sensitive_info" && "bg-purple-500",
                    state.phase === "complete" && "bg-green-500",
                    state.phase === "error" && "bg-red-500"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Errors */}
            {state.errors.length > 0 && (
              <div className="text-xs text-red-600 space-y-0.5 max-h-16 overflow-y-auto">
                {state.errors.map((error, i) => (
                  <div key={i} className="truncate">{error}</div>
                ))}
              </div>
            )}

            {/* Dismiss button for complete/error states */}
            {(state.phase === "complete" || state.phase === "error") && (
              <button
                onClick={() => setIsDismissed(true)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
