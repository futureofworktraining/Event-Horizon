"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "./ExportDialog";
import { Id } from "../../../convex/_generated/dataModel";

interface ExportButtonProps {
  processData: any;
  processName: string;
}

export function ExportButton({ processData, processName }: ExportButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)} variant="outline">
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
