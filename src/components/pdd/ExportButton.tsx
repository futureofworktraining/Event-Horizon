/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ExportDialog, ExportStartParams, ExportResultParams } from "./ExportDialog";
import { useExport } from "@/contexts/ExportContext";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

interface ExportButtonProps {
  processData: any;
  processName: string;
  jobId?: Id<"jobs">;
}

export function ExportButton({ processData, processName, jobId }: ExportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { startExport, setDownloading, completeExport, failExport } = useExport();

  const processingStatus = useQuery(
    api.jobs.getJobProcessingStatus,
    jobId ? { jobId } : "skip"
  );

  // Check if auto-detection is still in progress
  const isDetectionPending = processingStatus && processingStatus.job.autoBoundingBoxes && (
    processingStatus.totals.totalBoundingBoxesNeeded > 0 ||
    (processingStatus.job.autoExtractScreenshots && processingStatus.totals.totalScreenshotsNeeded > 0)
  );

  const handleExportStart = useCallback((params: ExportStartParams) => {
    // Calculate total steps including all subprocesses
    let stepCount = processData?.totalStepsAllProcesses || 0;

    // If totalStepsAllProcesses not available, calculate from available data
    if (!stepCount) {
      // Main process steps
      stepCount = processData?.steps?.length || processData?.totalSteps || 0;

      // Add subprocess steps if available
      if (processData?.subprocesses && Array.isArray(processData.subprocesses)) {
        for (const subprocess of processData.subprocesses) {
          stepCount += subprocess.totalSteps || 0;
        }
      }
    }

    // Return the exportId to the dialog so it can be passed back upon completion
    return startExport(params.format, params.filename, stepCount);
  }, [startExport, processData]);

  const handleExportComplete = useCallback((params: ExportResultParams & { exportId?: string }) => {
    // We expect an exportId for concurrent tracking
    if (!params.exportId) return;

    if (params.success) {
      setDownloading(params.exportId);
      // Small delay to show downloading state, then complete
      setTimeout(() => {
        completeExport(params.exportId!);
      }, 500);
    } else {
      failExport(params.exportId, params.error || "Export failed");
    }
  }, [setDownloading, completeExport, failExport]);

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        variant="outline"
        disabled={!!isDetectionPending}
        title={isDetectionPending ? "Waiting for auto-detection to complete..." : "Export PDD"}
      >
        {isDetectionPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
        )}
        Export PDD
      </Button>

      <ExportDialog
        processId={processData._id as Id<"processes">}
        processName={processName}
        processData={processData}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onExportStart={handleExportStart}
        onExportComplete={handleExportComplete}
      />
    </>
  );
}
