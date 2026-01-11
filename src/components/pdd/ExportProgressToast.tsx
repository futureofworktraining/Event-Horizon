/* eslint-disable react-hooks/static-components */
"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExport, ExportStatus, ExportItem } from "@/contexts/ExportContext";

function getStatusLabel(status: ExportStatus, format: string): string {
  switch (status) {
    case "exporting": return `Generating ${format.toUpperCase()}`;
    case "downloading": return "Downloading...";
    case "complete": return "Export Complete";
    case "error": return "Export Failed";
    default: return "Preparing...";
  }
}

function getStatusIcon(status: ExportStatus) {
  switch (status) {
    case "exporting": return Loader2;
    case "downloading": return Download;
    case "complete": return CheckCircle2;
    case "error": return AlertCircle;
    default: return FileText;
  }
}

function getStatusColor(status: ExportStatus): string {
  switch (status) {
    case "exporting": return "text-blue-600";
    case "downloading": return "text-cyan-600";
    case "complete": return "text-green-600";
    case "error": return "text-red-600";
    default: return "text-gray-600";
  }
}

function getProgressBarColor(status: ExportStatus): string {
  switch (status) {
    case "exporting": return "bg-blue-500";
    case "downloading": return "bg-cyan-500";
    case "complete": return "bg-green-500";
    case "error": return "bg-red-500";
    default: return "bg-gray-500";
  }
}

function SingleExportToast({ item, dismissFn }: { item: ExportItem, dismissFn: (id: string) => void }) {
  const { id, status, format, filename, error, startTime, stepCount, estimatedDuration } = item;
  const [isMinimized, setIsMinimized] = useState(false);
  const [progress, setProgress] = useState(0);

  // Calculate progress based on elapsed time vs estimated duration
  useEffect(() => {
    if (status !== "exporting" || !startTime || !estimatedDuration) {
      if (status === "downloading") setProgress(95);
      else if (status === "complete") setProgress(100);
      else if (status === "error") setProgress(0);
      return;
    }

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      // Calculate progress, cap at 95% until actually complete
      const calculatedProgress = Math.min(95, (elapsed / estimatedDuration) * 100);
      setProgress(calculatedProgress);
    };

    // Update immediately
    updateProgress();

    // Then update every 500ms
    const interval = setInterval(updateProgress, 500);
    return () => clearInterval(interval);
  }, [status, startTime, estimatedDuration]);

  // Auto-dismiss on complete after delay
  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(() => dismissFn(id), 4000);
      return () => clearTimeout(timer);
    }
  }, [status, id, dismissFn]);

  const Icon = getStatusIcon(status);
  const iconColor = getStatusColor(status);
  const barColor = getProgressBarColor(status);

  // Format remaining time estimate
  const getRemainingTimeText = () => {
    if (status !== "exporting" || !startTime || !estimatedDuration) return null;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, estimatedDuration - elapsed);
    const remainingSeconds = Math.ceil(remaining / 1000);
    if (remainingSeconds <= 0) return "Almost done...";
    if (remainingSeconds < 60) return `~${remainingSeconds}s remaining`;
    const mins = Math.ceil(remainingSeconds / 60);
    return `~${mins}min remaining`;
  };

  return (
    <div
      className={cn(
        "bg-white border border-border rounded-lg shadow-lg overflow-hidden transition-all duration-200",
        isMinimized ? "w-64" : "w-80"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColor, status === "exporting" && "animate-spin")} />
          <span className="text-sm font-medium">{getStatusLabel(status, format)}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isMinimized ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3 space-y-3">
          {/* Filename */}
          <div className="text-xs text-muted-foreground truncate">
            {filename}.{format === "word" ? "docx" : format}
          </div>

          {/* Step info */}
          {status === "exporting" && stepCount > 0 && (
            <div className="text-xs text-muted-foreground">
              Processing {stepCount} steps...
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {status === "exporting" && (getRemainingTimeText() || "Processing...")}
                {status === "downloading" && "Preparing download..."}
                {status === "complete" && "Document ready!"}
                {status === "error" && "Export failed"}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-500 ease-out", barColor)}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Error message */}
          {status === "error" && error && (
            <div className="text-xs text-red-600 truncate">
              {error}
            </div>
          )}

          {/* Success message */}
          {status === "complete" && (
            <div className="text-xs text-green-600">
              Document downloaded successfully!
            </div>
          )}

          {/* Dismiss button for complete/error states */}
          {(status === "complete" || status === "error") && (
            <button
              onClick={() => dismissFn(id)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ExportProgressToast() {
  const { exports, dismissExport } = useExport();
  const activeItems = Object.values(exports);

  if (activeItems.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {activeItems.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <SingleExportToast item={item} dismissFn={dismissExport} />
        </div>
      ))}
    </div>
  );
}
