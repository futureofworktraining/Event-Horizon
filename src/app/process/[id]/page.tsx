"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { ProcessHeader } from "@/components/pdd/ProcessHeader";
import { ApplicationsList } from "@/components/pdd/ApplicationsList";
import { StepsList } from "@/components/pdd/StepsList";
import { ProcessingStatus } from "@/components/pdd/ProcessingStatus";
import { ScreenshotExtractor } from "@/components/pdd/ScreenshotExtractor";
import { BoundingBoxDetector } from "@/components/pdd/BoundingBoxDetector";
import { SensitiveInfoDetector } from "@/components/pdd/SensitiveInfoDetector";
import { AnalysisPromptEditor } from "@/components/pdd/AnalysisPromptEditor";
import { AutoProcessingOrchestrator } from "@/components/pdd/AutoProcessingOrchestrator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FlowchartViewer,
  ProcessNavigator,
  ProcessBreadcrumbs,
} from "@/components/flowchart";
import Link from "next/link";
import { Workflow, List, ChevronDown, ChevronUp, Settings2, RefreshCw, Target, ShieldAlert, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "flowchart" | "list";

export default function ProcessPage() {
  const params = useParams();
  const router = useRouter();

  // Safe ID extraction and validation
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isValidId = rawId && /^[a-zA-Z0-9]+$/.test(rawId) && rawId.length > 15;
  const processId = isValidId ? rawId : "";

  // State
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedStepNumber, setSelectedStepNumber] = useState<number | undefined>();
  const [collapsedSubprocesses, setCollapsedSubprocesses] = useState<Set<string>>(new Set());
  const [showNavigator, setShowNavigator] = useState(true);

  // Collapsible sections state
  const [showBoundingBoxSection, setShowBoundingBoxSection] = useState(false);
  const [showSensitiveInfoSection, setShowSensitiveInfoSection] = useState(false);
  const [showPromptSection, setShowPromptSection] = useState(false);

  // Re-analyze state
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  // Status tracking since last render
  const prevJobStatus = useRef<string | null>(null);

  // Subprocess fix state
  const [isFixingSubprocess, setIsFixingSubprocess] = useState(false);
  const fixSubprocessRefs = useMutation(api.flows.fixSubprocessReferences);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Query with flow data
  const processQuery = useQuery(api.flows.getProcessWithFlow,
    isValidId ? { processId: processId as any } : "skip"
  );

  // If ID is invalid, treat as not found (null).
  // If valid but loading, processQuery is undefined -> undefined.
  // If valid and loaded, processQuery -> result.
  const process = isValidId ? processQuery : null;

  // Query for process hierarchy (breadcrumbs)
  const hierarchy = useQuery(api.flows.getProcessHierarchy,
    isValidId ? { processId: processId as any } : "skip"
  );

  // Query for all processes in job (for navigator)
  const allProcesses = useQuery(
    api.flows.getProcessesForJob,
    process?.job?._id ? { jobId: process.job._id } : "skip"
  );

  // Job status monitoring for notifications
  // eslint-disable-next-line react-hooks/rules-of-hooks
  // Job status monitoring for notifications
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!process?.job?.status) return;

    const currentStatus = process.job.status;
    const prev = prevJobStatus.current;

    // Skip notifications on initial load
    if (prev === null) {
      prevJobStatus.current = currentStatus;
      return;
    }

    // "Process being analyzed" notification
    if (currentStatus === "processing" && prev !== "processing") {
      toast.info("Process is being analyzed", {
        description: "Gemini is analyzing the video content...",
      });
    }

    // "PDD generated" notification
    if (currentStatus === "completed" && prev !== "completed") {
      toast.success("PDD generated", {
        description: "Process Design Document has been successfully generated.",
      });
    }

    prevJobStatus.current = currentStatus;
  }, [process?.job?.status]);

  // Handlers
  const handleStepClick = useCallback((stepNumber: number) => {
    setSelectedStepNumber(stepNumber);
    // Scroll to step in list if in list view
    if (viewMode === "list") {
      const element = document.getElementById(`step-${stepNumber}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [viewMode]);

  const handleSubprocessClick = useCallback(async (subprocessId: string) => {
    if (!process?.subprocesses) return;

    // 1. Try direct ID match
    const directMatch = process.subprocesses.find((p: any) => p._id === subprocessId);
    if (directMatch) {
      router.push(`/process/${subprocessId}`);
      return;
    }

    // 2. Try name match (fuzzy)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = normalize(subprocessId);

    const nameMatch = process.subprocesses.find((p: any) =>
      normalize(p.processName) === target ||
      p.processName === subprocessId
    );

    if (nameMatch) {
      router.push(`/process/${nameMatch._id}`);
      return;
    }

    // 3. Fallback: If it looks like a Convex ID (base32), try it anyway
    // (A simple check: usually 20+ chars, alphanumeric)
    if (subprocessId.length > 15 && /^[a-zA-Z0-9]+$/.test(subprocessId)) {
      router.push(`/process/${subprocessId}`);
      return;
    }

    // 4. Try to auto-fix subprocess references
    if (!isFixingSubprocess && processId) {
      setIsFixingSubprocess(true);
      try {
        const result = await fixSubprocessRefs({ processId: processId as any });
        if (result.success && result.updatedCount && result.updatedCount > 0) {
          // Subprocess references fixed, the page will re-render with updated data
          alert(`Fixed ${result.updatedCount} subprocess link(s). Please click again to navigate.`);
        } else {
          alert(`Subprocess "${subprocessId}" not found. Available subprocesses: ${process.subprocesses.map((p: any) => p.processName).join(", ")}`);
        }
      } catch (error) {
        console.error("Failed to fix subprocess references:", error);
        alert(`Subprocess "${subprocessId}" not found in this process. It may not have been correctly linked or created.`);
      } finally {
        setIsFixingSubprocess(false);
      }
      return;
    }

    // 5. Not found
    alert(`Subprocess "${subprocessId}" not found in this process. It may not have been correctly linked or created.`);
  }, [router, process, processId, isFixingSubprocess, fixSubprocessRefs]);

  const handleToggleSubprocessCollapse = useCallback((subprocessId: string) => {
    setCollapsedSubprocesses(prev => {
      const next = new Set(prev);
      if (next.has(subprocessId)) {
        next.delete(subprocessId);
      } else {
        next.add(subprocessId);
      }
      return next;
    });
  }, []);

  const handleProcessSelect = useCallback((selectedProcessId: string) => {
    router.push(`/process/${selectedProcessId}`);
  }, [router]);

  const handleBreadcrumbNavigate = useCallback((targetProcessId: string) => {
    router.push(`/process/${targetProcessId}`);
  }, [router]);

  // Loading state
  if (!mounted || process === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="w-full mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-muted rounded" />
            <Card>
              <CardContent className="pt-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (process === null) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="w-full mx-auto text-center py-16">
          <h1 className="text-2xl font-bold mb-4">Process Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The process you are looking for does not exist or has been deleted.
          </p>
          <Link href="/projects">
            <Button>Go to Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if job is still processing
  if (process.job && (process.job.status === "pending" || process.job.status === "processing")) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="w-full mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>Processing</span>
          </div>
          <ProcessingStatus
            status={process.job.status}
            progress={process.job.progress}
            errorMessage={process.job.errorMessage}
          />
        </div>
      </div>
    );
  }

  // Check for failed job
  if (process.job && process.job.status === "failed") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="w-full mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>Failed</span>
          </div>
          <ProcessingStatus
            status="failed"
            errorMessage={process.job.errorMessage}
          />
          <div className="text-center">
            <Link href="/upload">
              <Button>Try Again</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasSubprocesses = process.subprocesses && process.subprocesses.length > 0;
  const hasFlow = process.flow && process.flow.nodes && process.flow.nodes.length > 0;

  return (
    <div className="p-8">
      {/* Header section */}
      <div className="w-full space-y-6">
        {/* Breadcrumbs - hierarchy navigation */}
        {hierarchy?.path && hierarchy.path.length > 1 ? (
          <ProcessBreadcrumbs
            path={hierarchy.path}
            onNavigate={handleBreadcrumbNavigate}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{process.processName}</span>
          </div>
        )}

        {/* Process Header */}
        <ProcessHeader
          processName={process.processName}
          processDescription={process.processDescription}
          recordingDurationSeconds={process.recordingDurationSeconds}
          totalSteps={process.totalSteps}
          status={process.job?.status}
          processData={process}
          jobId={process.job?._id}
          rootProcessName={hierarchy?.path?.[0]?.processName}
        />

        {/* Applications List */}
        <ApplicationsList applications={process.applications} />

        {/* Business Rules */}
        {process.businessRulesObserved && process.businessRulesObserved.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-3">Business Rules Observed</h3>
              <ul className="list-disc list-inside space-y-1">
                {process.businessRulesObserved.map((rule: string, index: number) => (
                  <li key={index} className="text-sm">{rule}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Exceptions */}
        {process.exceptionsNoted && process.exceptionsNoted.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-3">Exceptions Noted</h3>
              <ul className="list-disc list-inside space-y-1">
                {process.exceptionsNoted.map((exception: string, index: number) => (
                  <li key={index} className="text-sm text-orange-600">{exception}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Screenshot Extractor - shows if screenshots are missing (manual trigger) */}
        {process.job?.videoStorageId && (
          <ScreenshotExtractor
            processId={process._id}
            videoStorageId={process.job.videoStorageId}
          />
        )}

        {/* AI Detection Tools - Collapsible Section */}
        {process.steps && process.steps.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  AI Detection Tools
                </div>
                <div className="flex items-center gap-2">
                  {/* Status indicators */}
                  {process.steps.filter((s: any) => s.boundingBoxDetected).length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {process.steps.filter((s: any) => s.boundingBoxDetected).length} boxes
                    </span>
                  )}
                  {process.steps.filter((s: any) => s.sensitiveInfoDetected).length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      {process.steps.filter((s: any) => s.sensitiveInfoDetected).length} sensitive
                    </span>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bounding Box Detector - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setShowBoundingBoxSection(!showBoundingBoxSection)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">UI Element Detection</span>
                    {process.steps.filter((s: any) => s.boundingBoxDetected).length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({process.steps.filter((s: any) => s.boundingBoxDetected).length}/{process.steps.filter((s: any) => s.screenshotUrl).length} detected)
                      </span>
                    )}
                  </div>
                  {showBoundingBoxSection ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showBoundingBoxSection && (
                  <div className="p-3 border-t bg-gray-50/50">
                    <BoundingBoxDetector
                      processId={process._id}
                      stepsWithScreenshots={process.steps.filter((s: any) => s.screenshotUrl).length}
                      stepsWithBoundingBoxes={process.steps.filter((s: any) => s.boundingBoxDetected).length}
                      stepsWithUiElement={process.steps.filter((s: any) => s.screenshotUrl && s.uiElement).length}
                      variant="embedded"
                    />
                  </div>
                )}
              </div>

              {/* Sensitive Information Detector - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setShowSensitiveInfoSection(!showSensitiveInfoSection)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">Sensitive Information Detection</span>
                    {process.steps.filter((s: any) => s.sensitiveInfoDetected).length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({process.steps.filter((s: any) => s.sensitiveInfoDetected).length}/{process.steps.filter((s: any) => s.screenshotUrl).length} scanned)
                      </span>
                    )}
                  </div>
                  {showSensitiveInfoSection ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showSensitiveInfoSection && (
                  <div className="p-3 border-t bg-gray-50/50">
                    <SensitiveInfoDetector
                      processId={process._id}
                      stepsWithScreenshots={process.steps.filter((s: any) => s.screenshotUrl).length}
                      stepsWithSensitiveDetection={process.steps.filter((s: any) => s.sensitiveInfoDetected).length}
                      variant="embedded"
                    />
                  </div>
                )}
              </div>

              {/* Analysis Prompt Editor - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => setShowPromptSection(!showPromptSection)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">Analysis Prompt</span>
                    <span className="text-xs text-muted-foreground">(Advanced)</span>
                  </div>
                  {showPromptSection ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showPromptSection && (
                  <div className="p-4 border-t bg-gray-50/50">
                    <AnalysisPromptEditor jobId={process.job?._id} processId={process._id} />
                  </div>
                )}
              </div>

              {/* Re-analyze Button */}
              {process.job?.videoStorageId && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Re-analyze Video</p>
                      <p className="text-xs text-muted-foreground">
                        Run the AI analysis again with updated prompts
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isReanalyzing}
                      onClick={() => {
                        // TODO: Implement re-analyze functionality
                        setIsReanalyzing(true);
                        setReanalyzeError(null);
                        // For now, just simulate
                        setTimeout(() => {
                          setIsReanalyzing(false);
                        }, 2000);
                      }}
                    >
                      {isReanalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Re-analyze
                        </>
                      )}
                    </Button>
                  </div>
                  {reanalyzeError && (
                    <p className="text-sm text-red-600 mt-2">{reanalyzeError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Mode Toggle & Flowchart/List Section */}
      <div className="mt-8">
        {/* Header with title and controls */}
        <div className="w-full mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Process Steps</h2>
            <div className="flex items-center gap-2">
              {/* Navigator Toggle (only if subprocesses exist) */}
              {(hasSubprocesses || (allProcesses && allProcesses.length > 1)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNavigator(!showNavigator)}
                  className="gap-2"
                >
                  {showNavigator ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Navigator
                </Button>
              )}

              {/* View Mode Toggle */}
              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none gap-2"
                >
                  <List className="w-4 h-4" />
                  List
                </Button>
                <Button
                  variant={viewMode === "flowchart" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("flowchart")}
                  className="rounded-none gap-2"
                >
                  <Workflow className="w-4 h-4" />
                  Flowchart
                </Button>
              </div>
            </div>
          </div>

          {/* Process Navigator - below header */}
          {showNavigator && allProcesses && allProcesses.length > 0 && (
            <div className="mt-4">
              <ProcessNavigator
                processes={allProcesses}
                selectedProcessId={processId}
                onProcessSelect={handleProcessSelect}
              />
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div>
          {/* Flowchart or List View */}
          <div className="w-full">
            {viewMode === "flowchart" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Workflow className="w-5 h-5" />
                    Process Flow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasFlow ? (
                    <FlowchartViewer
                      flow={process.flow}
                      steps={process.steps || []}
                      subprocesses={process.subprocesses}
                      colorIndex={process.colorIndex}
                      selectedStepNumber={selectedStepNumber}
                      onStepClick={handleStepClick}
                      onSubprocessClick={handleSubprocessClick}
                      collapsedSubprocesses={collapsedSubprocesses}
                      onToggleSubprocessCollapse={handleToggleSubprocessCollapse}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No flowchart data available for this process.</p>
                      <p className="text-sm mt-2">
                        Try switching to list view to see the steps.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <StepsList
                steps={process.steps}
                processId={process._id}
                selectedStepNumber={selectedStepNumber}
                onStepSelect={handleStepClick}
                flowNodes={process.flow?.nodes}
                flowEdges={process.flow?.edges}
                subprocesses={process.subprocesses}
                onSubprocessClick={handleSubprocessClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Auto-processing orchestrator - handles screenshots and bounding boxes automatically */}
      {process.job?._id && (
        <AutoProcessingOrchestrator jobId={process.job._id} />
      )}
    </div>
  );
}
