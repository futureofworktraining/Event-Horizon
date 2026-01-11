"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FileVideo, Loader2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Sparkles, Upload, Clock, Database, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface PddGenerationToastProps {
  jobId: Id<"jobs">;
}

type GenerationPhase = "downloading" | "uploading" | "waiting" | "analyzing" | "parsing" | "storing" | "complete" | "error" | "idle";

function getPhaseFromProgress(progress: number): GenerationPhase {
  if (progress < 5) return "downloading";
  if (progress < 15) return "downloading";
  if (progress < 30) return "uploading";
  if (progress < 45) return "waiting";
  if (progress < 60) return "analyzing";
  if (progress < 65) return "parsing";
  if (progress < 95) return "storing";
  if (progress < 100) return "storing";
  return "complete";
}

function getPhaseLabel(phase: GenerationPhase): string {
  switch (phase) {
    case "downloading": return "Downloading Video";
    case "uploading": return "Uploading to AI";
    case "waiting": return "Processing Video";
    case "analyzing": return "AI Analysis";
    case "parsing": return "Parsing Response";
    case "storing": return "Saving Results";
    case "complete": return "Generation Complete";
    case "error": return "Generation Failed";
    default: return "Preparing...";
  }
}

function getPhaseIcon(phase: GenerationPhase) {
  switch (phase) {
    case "downloading": return FileVideo;
    case "uploading": return Upload;
    case "waiting": return Clock;
    case "analyzing": return Brain;
    case "parsing": return Sparkles;
    case "storing": return Database;
    case "complete": return CheckCircle2;
    case "error": return AlertCircle;
    default: return Loader2;
  }
}

function getPhaseColor(phase: GenerationPhase): string {
  switch (phase) {
    case "downloading": return "text-blue-600";
    case "uploading": return "text-cyan-600";
    case "waiting": return "text-amber-600";
    case "analyzing": return "text-purple-600";
    case "parsing": return "text-indigo-600";
    case "storing": return "text-emerald-600";
    case "complete": return "text-green-600";
    case "error": return "text-red-600";
    default: return "text-gray-600";
  }
}

function getProgressBarColor(phase: GenerationPhase): string {
  switch (phase) {
    case "downloading": return "bg-blue-500";
    case "uploading": return "bg-cyan-500";
    case "waiting": return "bg-amber-500";
    case "analyzing": return "bg-purple-500";
    case "parsing": return "bg-indigo-500";
    case "storing": return "bg-emerald-500";
    case "complete": return "bg-green-500";
    case "error": return "bg-red-500";
    default: return "bg-gray-500";
  }
}

export function PddGenerationToast({ jobId }: PddGenerationToastProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const hasShownRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);

  // Query job status
  const job = useQuery(api.jobs.getJob, { jobId });

  // Determine phase from progress
  const progress = job?.progress ?? 0;
  const status = job?.status ?? "pending";
  const phase: GenerationPhase =
    status === "failed" ? "error" :
      status === "completed" ? "complete" :
        status === "processing" ? getPhaseFromProgress(progress) :
          status === "pending" ? "idle" :
            "idle";

  // Auto-dismiss when complete after a delay
  useEffect(() => {
    if (phase === "complete" && !isDismissed) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 5000); // Auto-dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [phase, isDismissed]);

  // Track if we should show the toast - ONLY during active generation
  useEffect(() => {
    // Only show if we observed the transition TO processing state
    // This prevents showing for already completed jobs
    if (status === "processing" && prevStatusRef.current === "pending") {
      hasShownRef.current = true;
      setIsDismissed(false);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Don't render if:
  // - Dismissed
  // - Job is completed (we only show during active processing)
  // - Job is pending (not started yet)
  // - Job is failed but we didn't track its processing
  // - We never observed it transition to processing
  if (isDismissed) return null;
  if (status === "completed" && !hasShownRef.current) return null;
  if (status === "pending") return null;
  if (status === "failed" && !hasShownRef.current) return null;
  if (!hasShownRef.current && status !== "processing") return null;

  const Icon = getPhaseIcon(phase);
  const iconColor = getPhaseColor(phase);
  const barColor = getProgressBarColor(phase);

  return (
    <div className="fixed bottom-20 right-4 z-50">
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
            <Icon className={cn("w-4 h-4", iconColor, phase === "idle" && "animate-spin")} />
            <span className="text-sm font-medium">{getPhaseLabel(phase)}</span>
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
            {/* Phase description */}
            {phase !== "complete" && phase !== "error" && (
              <div className="text-xs text-muted-foreground">
                {phase === "idle" && "Preparing to start analysis..."}
                {phase === "downloading" && "Fetching video from storage..."}
                {phase === "uploading" && "Uploading video to Gemini AI..."}
                {phase === "waiting" && "Gemini is processing the video..."}
                {phase === "analyzing" && "AI is analyzing the process steps..."}
                {phase === "parsing" && "Parsing and validating AI response..."}
                {phase === "storing" && "Saving process data to database..."}
              </div>
            )}

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Generating PDD</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-500", barColor)}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Error message */}
            {phase === "error" && job?.errorMessage && (
              <div className="text-xs text-red-600 truncate">
                {job.errorMessage}
              </div>
            )}

            {/* Success message */}
            {phase === "complete" && (
              <div className="text-xs text-green-600">
                Process Design Document generated successfully!
              </div>
            )}

            {/* Dismiss button for complete/error states */}
            {(phase === "complete" || phase === "error") && (
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
