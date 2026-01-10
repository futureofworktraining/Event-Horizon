"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ExportDialogProps {
  processId: Id<"processes">;
  processName: string;
  processData: any;
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = "json" | "word" | "pdf";

const formatExtensions: Record<ExportFormat, string> = {
  json: ".json",
  word: ".docx",
  pdf: ".pdf",
};

function sanitizeFilename(name: string): string {
  if (!name) return "process_pdd";
  return name
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, "_")         // Replace spaces with underscores
    .toLowerCase();
}

export function ExportDialog({
  processId,
  processName,
  processData,
  isOpen,
  onClose,
}: ExportDialogProps) {
  const defaultFilename = sanitizeFilename(processName) + "_pdd";
  const [format, setFormat] = useState<ExportFormat>("word");
  const [filename, setFilename] = useState(defaultFilename);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateWordPDD = useAction(api.exportPdd.generateWordPDD);
  const generatePdfPDD = useAction(api.exportPdd.generatePdfPDD);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      if (format === "json") {
        // JSON export (existing logic)
        const exportData = {
          process_metadata: {
            process_name: processData.processName,
            process_description: processData.processDescription,
            recording_duration_seconds: processData.recordingDurationSeconds,
            total_steps: processData.totalSteps,
            applications: processData.applications?.map((app: any) => ({
              name: app.name,
              type: app.type,
              url: app.url,
              version: app.version,
            })),
            business_rules_observed: processData.businessRulesObserved,
            exceptions_noted: processData.exceptionsNoted,
          },
          steps: processData.steps?.map((step: any) => ({
            step_number: step.stepNumber,
            timestamp: step.timestamp,
            action_type: step.actionType,
            specific_action: step.specificAction,
            description: step.description,
            application: step.application,
            screen_name: step.screenName,
            screenshot_required: step.screenshotRequired,
            ui_element: step.uiElement
              ? {
                element_name: step.uiElement.elementName,
                element_type: step.uiElement.elementType,
                location_description: step.uiElement.locationDescription,
                screen_region: step.uiElement.screenRegion,
                parent_element: step.uiElement.parentElement,
                identifiers: step.uiElement.identifiers
                  ? {
                    id: step.uiElement.identifiers.id,
                    class_name: step.uiElement.identifiers.className,
                    xpath: step.uiElement.identifiers.xpath,
                    accessibility_id: step.uiElement.identifiers.accessibilityId,
                  }
                  : undefined,
              }
              : undefined,
            data_info: step.dataInfo
              ? {
                value: step.dataInfo.value,
                data_type: step.dataInfo.dataType,
                source: step.dataInfo.source,
                is_sensitive: step.dataInfo.isSensitive,
                format: step.dataInfo.format,
                validation_rules: step.dataInfo.validationRules,
              }
              : undefined,
            wait_condition: step.waitCondition
              ? {
                wait_type: step.waitCondition.waitType,
                description: step.waitCondition.description,
                timeout_seconds: step.waitCondition.timeoutSeconds,
                retry_count: step.waitCondition.retryCount,
              }
              : undefined,
            notes: step.notes,
            automation_hint: step.automationHint,
          })),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
      } else if (format === "word") {
        const result = await generateWordPDD({ processId, customFileName: filename });

        if (result.success && result.downloadUrl) {
          // Download with custom filename
          const response = await fetch(result.downloadUrl);
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `${filename}.docx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          onClose();
        } else {
          setError(result.error || "Failed to generate Word document");
        }
      } else if (format === "pdf") {
        const result = await generatePdfPDD({ processId, customFileName: filename });

        if (result.success && result.downloadUrl) {
          // Download with custom filename
          const response = await fetch(result.downloadUrl);
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = `${filename}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          onClose();
        } else {
          setError(result.error || "Failed to generate PDF document");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export PDD</DialogTitle>
          <DialogDescription>
            Export &quot;{processName}&quot; as a Process Design Document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Filename Input */}
          <div className="space-y-2">
            <Label htmlFor="filename">Document Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(sanitizeFilename(e.target.value) || defaultFilename)}
                placeholder="Enter filename"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {formatExtensions[format]}
              </span>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger id="format" className="w-full">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="word">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    Word Document (.docx)
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    PDF Document (.pdf)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-yellow-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    JSON (Data Only)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Info about Word/PDF export */}
          {format !== "json" && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 border border-blue-200">
              <p className="font-medium mb-2">Document includes:</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Modern cover page with process metadata</li>
                <li>Step-by-step documentation with compact details table</li>
                <li>
                  <span className="font-medium">Two screenshots per step:</span>
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>Overview - full screen with bounding boxes</li>
                    <li>Detail - zoomed view of UI element</li>
                  </ul>
                </li>
                <li>Bounding boxes for UI elements (green)</li>
                <li>Sensitive data areas highlighted (red)</li>
                <li>Business rules and exceptions sections</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
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
                Generating...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
