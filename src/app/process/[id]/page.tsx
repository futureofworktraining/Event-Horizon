/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { ProcessHeader } from "@/components/pdd/ProcessHeader";
import { ApplicationsList } from "@/components/pdd/ApplicationsList";
import { StepsList } from "@/components/pdd/StepsList";
import { ProcessingStatus } from "@/components/pdd/ProcessingStatus";
import { ScreenshotExtractor } from "@/components/pdd/ScreenshotExtractor";
import { BoundingBoxDetector } from "@/components/pdd/BoundingBoxDetector";
import { SensitiveInfoDetector } from "@/components/pdd/SensitiveInfoDetector";
import { AgentPanel } from "@/components/pdd/AgentPanel";
import { AutoProcessingOrchestrator } from "@/components/pdd/AutoProcessingOrchestrator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  FlowchartViewer,
  ProcessNavigator,
  ProcessBreadcrumbs,
} from "@/components/flowchart";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Workflow, List, ChevronDown, ChevronUp, Settings2, RefreshCw, Target, ShieldAlert, Loader2, History, Eye, Image, Box, Lock } from "lucide-react";
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

  // Re-analyze state
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);

  // Re-analyze options state (initialized from current job settings)
  const [reanalyzeScreenshots, setReanalyzeScreenshots] = useState(true);
  const [reanalyzeBoundingBoxes, setReanalyzeBoundingBoxes] = useState(true);
  const [reanalyzeSensitiveInfo, setReanalyzeSensitiveInfo] = useState(false);
  const [reanalyzeSensitivePrompt, setReanalyzeSensitivePrompt] = useState("");

  // Status tracking since last render
  const prevJobStatus = useRef<string | null>(null);

  // Subprocess fix state
  const [isFixingSubprocess, setIsFixingSubprocess] = useState(false);
  const fixSubprocessRefs = useMutation(api.flows.fixSubprocessReferences);

  // Re-analyze action
  const reanalyzeJob = useAction(api.reanalyze.reanalyzeJob);

  // Version history state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);

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

  // Query for version history
  const versionHistory = useQuery(
    api.analysisVersions.getVersionsForJob,
    process?.job?._id ? { jobId: process.job._id } : "skip"
  );

  // Check if re-analysis is in progress (job processing but has existing process data)
  const isReanalysisInProgress = process?.job?.status === "processing" && !!process?.processName;

  // Check if job is actively processing (first analysis or re-analysis)
  const isJobActive = process?.job?.status === "processing" || process?.job?.status === "pending";

  // Agent panel state - open by default when job is active
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const agentPanelInitialized = useRef(false);

  // Initialize panel state when process data first loads
  useEffect(() => {
    if (process?.job && !agentPanelInitialized.current) {
      agentPanelInitialized.current = true;
      setIsAgentPanelOpen(!!isJobActive);
    }
  }, [process?.job, isJobActive]);



  // Check if this is the main process (not a subprocess)
  const isMainProcess = process?.isMainProcess !== false && !process?.parentProcessId;

  // Initialize re-analyze options from current job settings
  useEffect(() => {
    if (process?.job) {
      setReanalyzeScreenshots(process.job.autoExtractScreenshots ?? true);
      setReanalyzeBoundingBoxes(process.job.autoBoundingBoxes ?? true);
      setReanalyzeSensitiveInfo(process.job.autoSensitiveInfo ?? false);
      setReanalyzeSensitivePrompt(process.job.sensitiveInfoPrompt ?? "");
    }
  }, [process?.job]);

  // Job status monitoring for notifications
   
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
            jobId={process.job._id}
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
    <div className="flex h-full relative">
    <div className={cn("flex-1 overflow-auto p-8 transition-all duration-300",
      isAgentPanelOpen ? "pr-[416px]" : process?.job?._id ? "pr-20" : ""
    )}>
      {/* Re-analysis in progress banner */}
      {isReanalysisInProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-900">Re-analysis in progress</p>
              <p className="text-sm text-blue-700">
                A new analysis is running. You can view the current version below, but editing is disabled until the new analysis completes.
              </p>
            </div>
          </div>
        </div>
      )}

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

              {/* Re-analyze Button - Only for main process */}
              {process.job?.videoStorageId && isMainProcess && (
                <div className="pt-2 border-t space-y-3">
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
                      disabled={isReanalyzing || process.job?.status === "processing"}
                      onClick={() => setShowReanalyzeDialog(true)}
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

                  {/* Re-analyze Options Dialog */}
                  <Dialog open={showReanalyzeDialog} onOpenChange={setShowReanalyzeDialog}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Re-analyze Video</DialogTitle>
                        <DialogDescription>
                          Configure options for the new analysis. Current version will be archived.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="screenshots"
                            checked={reanalyzeScreenshots}
                            onCheckedChange={(checked) => setReanalyzeScreenshots(checked as boolean)}
                          />
                          <div className="flex items-center gap-2">
                            <Image className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="screenshots" className="cursor-pointer">
                              Auto-extract screenshots
                            </Label>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="boundingBoxes"
                            checked={reanalyzeBoundingBoxes}
                            onCheckedChange={(checked) => setReanalyzeBoundingBoxes(checked as boolean)}
                          />
                          <div className="flex items-center gap-2">
                            <Box className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="boundingBoxes" className="cursor-pointer">
                              Auto-detect UI elements (bounding boxes)
                            </Label>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="sensitiveInfo"
                            checked={reanalyzeSensitiveInfo}
                            onCheckedChange={(checked) => setReanalyzeSensitiveInfo(checked as boolean)}
                          />
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="sensitiveInfo" className="cursor-pointer">
                              Auto-detect sensitive information
                            </Label>
                          </div>
                        </div>
                        {reanalyzeSensitiveInfo && (
                          <div className="ml-7 space-y-2">
                            <Label htmlFor="sensitivePrompt" className="text-sm">
                              Sensitive info description (optional)
                            </Label>
                            <Input
                              id="sensitivePrompt"
                              placeholder="e.g., SSN, credit card numbers, passwords..."
                              value={reanalyzeSensitivePrompt}
                              onChange={(e) => setReanalyzeSensitivePrompt(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReanalyzeDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!process.job?._id) return;

                            setShowReanalyzeDialog(false);
                            setIsReanalyzing(true);
                            setReanalyzeError(null);

                            try {
                              toast.info("Starting re-analysis...", {
                                description: "Current analysis will be archived"
                              });

                              await reanalyzeJob({
                                jobId: process.job._id,
                                autoExtractScreenshots: reanalyzeScreenshots,
                                autoBoundingBoxes: reanalyzeBoundingBoxes,
                                autoSensitiveInfo: reanalyzeSensitiveInfo,
                                sensitiveInfoPrompt: reanalyzeSensitiveInfo ? reanalyzeSensitivePrompt : undefined,
                              });

                              toast.success("Re-analysis started", {
                                description: "The video is being analyzed again"
                              });
                            } catch (error) {
                              const errorMessage = error instanceof Error ? error.message : "Failed to start re-analysis";
                              setReanalyzeError(errorMessage);
                              const isApiKeyError = errorMessage.toLowerCase().includes("gemini api key not configured");
                              if (isApiKeyError) {
                                toast.error("Gemini API key not configured", {
                                  description: "Get your free API key at aistudio.google.com/apikey, then add it in Settings.",
                                  duration: 10000,
                                  action: {
                                    label: "Open Settings",
                                    onClick: () => window.location.href = "/settings",
                                  },
                                });
                              } else {
                                toast.error("Re-analysis failed", {
                                  description: errorMessage
                                });
                              }
                            } finally {
                              setIsReanalyzing(false);
                            }
                          }}
                        >
                          Start Re-analysis
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Version History Section */}
                  {versionHistory && versionHistory.length > 0 && (
                    <div className="border-t pt-3">
                      <button
                        onClick={() => setShowVersionHistory(!showVersionHistory)}
                        className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-md px-2 -mx-2"
                      >
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Version History</span>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                            {versionHistory.length} version{versionHistory.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {showVersionHistory ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {showVersionHistory && (
                        <div className="mt-2 space-y-2">
                          {versionHistory.map((version) => (
                            <div
                              key={version._id}
                              className={`p-3 border rounded-lg text-sm ${
                                version.isCurrent ? "border-blue-200 bg-blue-50/50" : "bg-gray-50/50"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">
                                  Version {version.versionNumber}
                                  {version.isCurrent && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                      Current
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => setViewingVersion(viewingVersion === version._id ? null : version._id)}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    {viewingVersion === version._id ? "Hide" : "View"}
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(version.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span>{version.totalSteps} steps</span>
                                <span className="mx-2">|</span>
                                <span>{version.processName}</span>
                              </div>
                              {/* Expanded version details */}
                              {viewingVersion === version._id && (
                                <div className="mt-3 pt-3 border-t space-y-3">
                                  <div className="text-xs">
                                    <p className="font-medium mb-2">Steps in this version:</p>
                                    <div className="max-h-60 overflow-y-auto space-y-1 bg-white rounded border p-2">
                                      {(() => {
                                        try {
                                          const steps = JSON.parse(version.stepsSnapshot);
                                          return steps.map((step: any, idx: number) => (
                                            <div key={idx} className="flex gap-2 py-1 border-b last:border-0">
                                              <span className="font-medium text-gray-500 w-6">{step.stepNumber}.</span>
                                              <span className="flex-1">{step.description}</span>
                                              <span className="text-gray-400">{step.timestamp}</span>
                                            </div>
                                          ));
                                        } catch {
                                          return <p className="text-muted-foreground">Unable to load steps</p>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* Live-mode indicator */}
        {isJobActive && !isReanalysisInProgress && (
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analysis in progress — steps update live</span>
          </div>
        )}

        {/* Main Content Area */}
        <div>
          {/* Flowchart or List View */}
          <div className="w-full">
            {(!process.steps || process.steps.length === 0) && isJobActive ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-amber-500" />
                  <p>Agent is analyzing the video...</p>
                  <p className="text-sm mt-1">Steps will appear here as they are identified.</p>
                </CardContent>
              </Card>
            ) : viewMode === "flowchart" ? (
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
                readOnly={isReanalysisInProgress || !!isJobActive}
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

    {/* Agent Panel - right side */}
    {process.job?._id && (
      <AgentPanel
        jobId={process.job._id}
        isOpen={isAgentPanelOpen}
        onToggle={() => setIsAgentPanelOpen(prev => !prev)}
        videoStorageId={process.job.videoStorageId}
      />
    )}
    </div>
  );
}
