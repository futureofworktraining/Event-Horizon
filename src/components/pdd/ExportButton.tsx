"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "./ExportDialog";
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

  const processingStatus = useQuery(
    api.jobs.getJobProcessingStatus,
    jobId ? { jobId } : "skip"
  );

  // Check if auto-detection is still in progress
  // We check for bounding boxes specifically as requested, but also screenshots if they are needed for bounding boxes
  const isDetectionPending = processingStatus && processingStatus.job.autoBoundingBoxes && (
    processingStatus.totals.totalBoundingBoxesNeeded > 0 ||
    (processingStatus.job.autoExtractScreenshots && processingStatus.totals.totalScreenshotsNeeded > 0)
  );

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
      />
    </>
  );
}
