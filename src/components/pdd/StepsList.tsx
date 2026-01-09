"use client";

import { useState, useEffect, useMemo } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionTypeBadge } from "./ActionTypeBadge";
import { StepDetail } from "./StepDetail";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";
import { StepEditDialog } from "./StepEditDialog";
import { AddStepDialog } from "./AddStepDialog";
import { ScreenshotLightbox, LightboxStep } from "./ScreenshotLightbox";

interface BoundingBox {
  label: string;
  box_2d: number[];
  found: boolean;
  masked: boolean;
}

interface SensitiveInfoBox {
  label: string;
  box_2d: number[];
  found: boolean;
  confidence?: number;
}

interface ProcessStep {
  _id: string;
  stepNumber: number;
  timestamp: string;
  actionType: string;
  specificAction: string;
  description: string;
  application: string;
  screenName: string;
  screenshotRequired: boolean;
  screenshotUrl?: string | null;
  overlayImageUrl?: string | null;
  uiElement?: any;
  dataInfo?: any;
  waitCondition?: any;
  notes?: string;
  automationHint?: string;
  boundingBox?: BoundingBox | null;
  boundingBoxDetected?: boolean;
  sensitiveInfoBoxes?: SensitiveInfoBox[] | null;
  sensitiveInfoDetected?: boolean;
  flowNodeId?: string;
}

interface FlowNode {
  nodeId: string;
  nodeType: string;
  stepNumber?: number;
  condition?: string;
  conditionDescription?: string;
  label?: string;
  endType?: string;
}

interface FlowEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  condition?: string;
  isDefault?: boolean;
}

interface StepsListProps {
  selectedStepNumber?: number;
  onStepSelect?: (stepNumber: number) => void;
  steps: ProcessStep[];
  processId?: string;
  flowNodes?: FlowNode[];
  flowEdges?: FlowEdge[];
}

interface StepItemProps {
  step: ProcessStep;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenLightbox: (stepNumber: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onAddAfter: () => void;
}

// Decision/Switch node item component
interface DecisionItemProps {
  node: FlowNode;
  edges?: FlowEdge[];
  flowNodes?: FlowNode[];
  onStepSelect?: (stepNumber: number) => void;
}

function DecisionItem({ node, edges, flowNodes, onStepSelect }: DecisionItemProps) {
  const isDecision = node.nodeType === "decision";
  const isSwitch = node.nodeType === "switch";

  // Get outgoing edges to show conditions
  const outgoingEdges = edges?.filter(e => e.fromNodeId === node.nodeId) || [];

  // Helper to find target step number from edge
  const getTargetStepInfo = (edge: FlowEdge): { stepNumber?: number; label: string } | null => {
    const targetNode = flowNodes?.find(n => n.nodeId === edge.toNodeId);
    if (!targetNode) return null;

    if (targetNode.nodeType === "action" && targetNode.stepNumber) {
      return { stepNumber: targetNode.stepNumber, label: `Step ${targetNode.stepNumber}` };
    } else if (targetNode.nodeType === "decision" || targetNode.nodeType === "switch") {
      return { label: targetNode.label || targetNode.condition || "Decision" };
    } else if (targetNode.nodeType === "merge") {
      return { label: "Merge" };
    } else if (targetNode.nodeType === "end") {
      return { label: "End" };
    }
    return null;
  };

  // Scroll to step
  const scrollToStep = (stepNumber: number) => {
    if (onStepSelect) {
      onStepSelect(stepNumber);
    }
    // Also scroll the step element into view
    const stepElement = document.getElementById(`step-${stepNumber}`);
    if (stepElement) {
      stepElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight effect
      stepElement.classList.add("ring-2", "ring-amber-400", "ring-offset-2");
      setTimeout(() => {
        stepElement.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
      }, 2000);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-amber-50 border-amber-200">
      <div className="flex items-start gap-3">
        {/* Diamond icon for decision */}
        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center ${isDecision ? "text-amber-600" : "text-orange-600"
          }`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.41L18.59 12 12 18.59 5.41 12 12 5.41z" />
            <text x="12" y="13" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">?</text>
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDecision ? "bg-amber-200 text-amber-800" : "bg-orange-200 text-orange-800"
              }`}>
              {isDecision ? "Decision" : "Switch"}
            </span>
          </div>

          <p className="text-sm font-medium text-gray-800">
            {node.label || node.condition || "Condition check"}
          </p>

          {node.conditionDescription && (
            <p className="text-xs text-gray-600 mt-1">{node.conditionDescription}</p>
          )}

          {/* Show branch options with links to target steps */}
          {outgoingEdges.length > 0 && (
            <div className="mt-2 space-y-1">
              {outgoingEdges.map((edge, i) => {
                const branchLabel = edge.label || edge.condition || `Branch ${i + 1}`;
                const targetInfo = getTargetStepInfo(edge);
                const isYes = branchLabel.toLowerCase() === "yes" || branchLabel.toLowerCase() === "tak";
                const isNo = branchLabel.toLowerCase() === "no" || branchLabel.toLowerCase() === "nie";

                return (
                  <div
                    key={edge.edgeId || i}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${isYes
                      ? "bg-green-100 text-green-800"
                      : isNo
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-700"
                      }`}
                  >
                    <span className="font-medium">{branchLabel}</span>
                    {targetInfo && (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 opacity-50">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        {targetInfo.stepNumber ? (
                          <button
                            onClick={() => scrollToStep(targetInfo.stepNumber!)}
                            className={`underline hover:no-underline font-medium ${isYes ? "text-green-700 hover:text-green-900" : isNo ? "text-red-700 hover:text-red-900" : "text-gray-600 hover:text-gray-900"
                              }`}
                          >
                            {targetInfo.label}
                          </button>
                        ) : (
                          <span className="opacity-70">{targetInfo.label}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepItem({ step, isExpanded, onToggle, onOpenLightbox, onEdit, onDelete, isDeleting, onAddAfter }: StepItemProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [isDetectingSensitive, setIsDetectingSensitive] = useState(false);
  const [sensitiveError, setSensitiveError] = useState<string | null>(null);
  const [showCroppedElement, setShowCroppedElement] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHoveringButtons, setIsHoveringButtons] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Reset loading state when screenshot URL changes (e.g., new overlay applied)
  useEffect(() => {
    if (step.screenshotUrl || step.overlayImageUrl) {
      setIsImageLoading(true);
    }
  }, [step.screenshotUrl, step.overlayImageUrl]);

  const detectAndOverlay = useAction(api.boundingBoxOverlay.detectAndOverlay);
  const detectSensitive = useAction(api.sensitiveInfoDetection.detectSensitiveBoxesSingleStep);

  const hasDetails =
    step.uiElement || step.dataInfo || step.waitCondition || step.notes || step.automationHint;

  const canDetect = step.screenshotUrl && step.uiElement;

  // Detect bounding box
  const handleQuickDetect = async () => {
    if (!canDetect) return;

    setIsDetecting(true);
    setDetectError(null);
    try {
      const result = await detectAndOverlay({ stepId: step._id as any });
      if (!result.success) {
        setDetectError(result.error || "Detection failed");
      }
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : "Detection failed");
    } finally {
      setIsDetecting(false);
    }
  };

  // Detect sensitive information
  const handleDetectSensitive = async () => {
    if (!step.screenshotUrl) return;

    setIsDetectingSensitive(true);
    setSensitiveError(null);
    try {
      const result = await detectSensitive({
        stepId: step._id as any,
        customPrompt: "SSN, credit card numbers, passwords, email addresses, phone numbers, employee IDs, personal data, Client ID, Client Name, Client Country",
      });
      if (!result.success) {
        setSensitiveError(result.error || "Detection failed");
      }
    } catch (error) {
      setSensitiveError(error instanceof Error ? error.message : "Detection failed");
    } finally {
      setIsDetectingSensitive(false);
    }
  };

  // Use overlay image if available, otherwise original screenshot
  const displayImageUrl = step.overlayImageUrl || step.screenshotUrl;

  // Check if step has sensitive boxes
  const hasSensitiveBoxes = step.sensitiveInfoBoxes && step.sensitiveInfoBoxes.length > 0;

  return (
    <div id={`step-${step.stepNumber}`} className="border rounded-lg h-full relative">
      <div className="flex h-full">
        {/* Left side: Step details - takes remaining space */}
        <div className="flex-1 p-3 min-w-0 flex flex-col">
          <div className="flex items-start gap-2">
            {/* Step number */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
              {step.stepNumber}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">
                      {step.timestamp}
                    </span>
                    <ActionTypeBadge
                      actionType={step.actionType}
                      specificAction={step.specificAction}
                    />
                  </div>
                  <p className="text-sm font-medium leading-snug break-words">{step.description}</p>
                  <div className="text-xs text-muted-foreground">
                    <span>{step.application}</span>
                    <span className="mx-1">•</span>
                    <span>{step.screenName}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!step.screenshotUrl && step.screenshotRequired && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                        Screenshot needed
                      </span>
                    )}
                    {step.boundingBox?.found && (
                      <span className={`px-1.5 py-0.5 rounded text-xs ${step.boundingBox.masked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {step.boundingBox.masked ? "Masked" : "Box detected"}
                      </span>
                    )}
                    {step.boundingBoxDetected && !step.boundingBox?.found && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        Not found
                      </span>
                    )}
                    {detectError && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        {detectError}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Edit button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEdit}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    title="Edit step"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Button>
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    title="Delete step"
                  >
                    {isDeleting ? (
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </Button>
                  {/* Expand/collapse button */}
                  {hasDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggle}
                      className="h-6 w-6 p-0"
                    >
                      {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </Button>
                  )}
                </div>
                {/* Delete confirmation dialog */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                      <h3 className="text-lg font-semibold mb-2">Delete Step {step.stepNumber}?</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This will permanently delete this step and its screenshot. This action cannot be undone.
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            onDelete();
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {isExpanded && hasDetails && (
                <StepDetail
                  uiElement={step.uiElement}
                  dataInfo={step.dataInfo}
                  waitCondition={step.waitCondition}
                  notes={step.notes}
                  automationHint={step.automationHint}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right side: Screenshot with preserved aspect ratio */}
        {step.screenshotUrl && (
          <div className="relative flex-shrink-0 w-[45%] min-w-[200px] max-w-[320px] overflow-visible">
            <div
              onClick={() => onOpenLightbox(step.stepNumber)}
              className="relative cursor-pointer group aspect-[16/10] bg-muted flex items-center justify-center overflow-hidden ring-1 ring-gray-300 shadow-md rounded-md"
            >
              {/* Loading indicator for screenshot */}
              {isImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted z-50">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  </div>
                </div>
              )}
              {/* Show zoomed element when eye button is active */}
              {showCroppedElement && step.boundingBox?.found && !step.boundingBox.masked ? (() => {
                const bb = step.boundingBox;
                const centerX = (bb.box_2d[1] + bb.box_2d[3]) / 2 / 10;
                const centerY = (bb.box_2d[0] + bb.box_2d[2]) / 2 / 10;
                const boxWidth = (bb.box_2d[3] - bb.box_2d[1]) / 10;
                const boxHeight = (bb.box_2d[2] - bb.box_2d[0]) / 10;
                const zoomFactor = Math.min(120 / boxWidth, 120 / boxHeight, 12);
                return (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(-${centerX}%, -${centerY}%) scale(${zoomFactor})`,
                      transformOrigin: `${centerX}% ${centerY}%`,
                    }}
                  >
                    {/* Image with bounding box overlay */}
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img
                        src={step.screenshotUrl}
                        alt={`Zoomed element: ${step.uiElement?.elementName || bb.label}`}
                        style={{ display: "block" }}
                      />
                      {/* Bounding box overlay - scales with the image */}
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${(bb.box_2d[1] / 1000) * 100}%`,
                          top: `${(bb.box_2d[0] / 1000) * 100}%`,
                          width: `${((bb.box_2d[3] - bb.box_2d[1]) / 1000) * 100}%`,
                          height: `${((bb.box_2d[2] - bb.box_2d[0]) / 1000) * 100}%`,
                          backgroundColor: bb.masked ? "rgba(220, 38, 38, 0.15)" : "rgba(234, 179, 8, 0.2)",
                        }}
                      />
                    </div>
                  </div>
                );
              })() : (
                <>
                  {/* Container that preserves aspect ratio */}
                  <div className="relative w-full h-full flex items-center justify-center">
                    {step.overlayImageUrl ? (
                      <img
                        src={step.overlayImageUrl}
                        alt={`Screenshot for step ${step.stepNumber}`}
                        className="max-w-full max-h-full object-contain"
                        onLoad={() => setIsImageLoading(false)}
                        onError={() => setIsImageLoading(false)}
                      />
                    ) : (
                      <div className="relative max-w-full max-h-full">
                        <img
                          src={step.screenshotUrl}
                          alt={`Screenshot for step ${step.stepNumber}`}
                          className="max-w-full max-h-full object-contain"
                          onLoad={() => setIsImageLoading(false)}
                          onError={() => setIsImageLoading(false)}
                        />
                        {/* Sensitive info boxes - rendered in back (z-10) */}
                        {step.sensitiveInfoBoxes && step.sensitiveInfoBoxes.length > 0 && step.sensitiveInfoBoxes.map((box, idx) => {
                          if (!box.box_2d || box.box_2d.length !== 4 || !box.found) return null;
                          const [ymin, xmin, ymax, xmax] = box.box_2d;
                          return (
                            <div
                              key={`sensitive-${idx}`}
                              className="absolute pointer-events-none z-10"
                              style={{
                                left: `${(xmin / 1000) * 100}%`,
                                top: `${(ymin / 1000) * 100}%`,
                                width: `${((xmax - xmin) / 1000) * 100}%`,
                                height: `${((ymax - ymin) / 1000) * 100}%`,
                                border: "3px solid #dc2626",
                                backgroundColor: "#dc2626",
                              }}
                            />
                          );
                        })}
                        {/* Bounding box overlay - rendered in front (z-20) */}
                        {step.boundingBox?.found && step.boundingBox.box_2d?.length === 4 && (
                          <div
                            className="absolute pointer-events-none z-20"
                            style={{
                              left: `${(step.boundingBox.box_2d[1] / 1000) * 100}%`,
                              top: `${(step.boundingBox.box_2d[0] / 1000) * 100}%`,
                              width: `${((step.boundingBox.box_2d[3] - step.boundingBox.box_2d[1]) / 1000) * 100}%`,
                              height: `${((step.boundingBox.box_2d[2] - step.boundingBox.box_2d[0]) / 1000) * 100}%`,
                              border: step.boundingBox.masked ? "3px solid #dc2626" : "2px solid #22c55e",
                              backgroundColor: step.boundingBox.masked ? "#dc2626" : "rgba(34, 197, 94, 0.15)",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              {/* Label badges - shown in both views at fixed position */}
              {(step.boundingBox?.found || hasSensitiveBoxes) && (
                <div className="absolute bottom-3 left-1 z-30 flex gap-1 pointer-events-none">
                  {step.boundingBox?.found && (
                    <div className="text-white text-xs px-2 py-1 rounded font-medium shadow-md bg-green-600">
                      {step.uiElement?.elementName || step.boundingBox.label}
                    </div>
                  )}
                  {(step.boundingBox?.masked || hasSensitiveBoxes) && (
                    <div className="text-white text-xs px-2 py-1 rounded font-medium shadow-md bg-red-600">
                      Sensitive
                    </div>
                  )}
                </div>
              )}
              {/* Hover overlay - shown in both views, hidden when hovering buttons */}
              <div className={`absolute inset-0 z-[25] transition-colors flex items-center justify-center pointer-events-none ${isHoveringButtons ? 'bg-black/0' : 'bg-black/0 group-hover:bg-black/20'}`}>
                <span className={`text-white text-xs font-medium bg-black/50 px-2 py-1 rounded transition-opacity ${isHoveringButtons ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                  Click to enlarge
                </span>
              </div>
              {/* Action buttons on thumbnail - inside clickable div, aligned with label */}
              {step.screenshotUrl && (
                <div
                  className="absolute bottom-3 right-1 z-40 flex gap-2"
                  onMouseEnter={() => setIsHoveringButtons(true)}
                  onMouseLeave={() => setIsHoveringButtons(false)}
                >
                  {/* Show element button - only when box is found and not masked */}
                  {step.boundingBox?.found && step.screenshotUrl && !step.boundingBox.masked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCroppedElement(!showCroppedElement);
                      }}
                      className={`text-white text-sm px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-lg ${showCroppedElement
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-blue-600/90 hover:bg-blue-600"
                        }`}
                      title={showCroppedElement ? "Hide element" : "Show element"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  )}
                  {/* Re-detect bounding box button - only when uiElement exists */}
                  {canDetect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickDetect();
                      }}
                      disabled={isDetecting}
                      className="bg-black/80 hover:bg-black/90 disabled:bg-black/50 text-white text-sm px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-lg"
                      title={step.boundingBoxDetected ? "Re-detect bounding box" : "Detect bounding box"}
                    >
                      {isDetecting ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 3v18" />
                        </svg>
                      )}
                    </button>
                  )}
                  {/* Detect Sensitive button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDetectSensitive();
                    }}
                    disabled={isDetectingSensitive}
                    className="bg-red-600/90 hover:bg-red-600 disabled:bg-red-600/50 text-white text-sm px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-lg"
                    title={step.sensitiveInfoDetected ? "Re-detect sensitive info" : "Detect sensitive info"}
                  >
                    {isDetectingSensitive ? (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Add step after button - bottom left corner */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddAfter}
        className="absolute bottom-1 left-1 h-7 w-7 p-0 bg-background/80 hover:bg-primary hover:text-primary-foreground border shadow-sm"
        title="Dodaj krok po tym kroku"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Button>
    </div>
  );
}

type ColumnCount = 1 | 2 | 3;

const columnGridClasses: Record<ColumnCount, string> = {
  1: "grid-cols-1 gap-4",
  2: "grid-cols-1 lg:grid-cols-2 gap-5",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5",
};

const cardWidthClasses: Record<ColumnCount, string> = {
  1: "max-w-[80%] w-full mx-auto",
  2: "w-full mx-auto",
  3: "w-full mx-auto",
};

export function StepsList({ steps, processId, selectedStepNumber, onStepSelect, flowNodes, flowEdges }: StepsListProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [columns, setColumns] = useState<ColumnCount>(1);
  const [showDecisions, setShowDecisions] = useState(true);

  // Build unified list with steps and decision nodes - sequential flow with branching
  const unifiedList = useMemo(() => {
    type ListItem =
      | { type: "step"; step: ProcessStep; branchLabel?: string }
      | { type: "decision"; node: FlowNode }
      | { type: "branch-header"; branchLabel: string; decisionLabel: string; decisionNodeId: string };
    const items: ListItem[] = [];

    // Get decision/switch nodes
    const decisionNodes = flowNodes?.filter(
      n => n.nodeType === "decision" || n.nodeType === "switch"
    ) || [];

    if (!showDecisions || decisionNodes.length === 0 || !flowNodes || !flowEdges) {
      // Just return steps sorted by step number
      return [...steps]
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map(s => ({ type: "step" as const, step: s }));
    }

    // Create a map of flowNodeId to step
    const nodeToStep = new Map<string, ProcessStep>();
    steps.forEach(s => {
      if (s.flowNodeId) {
        nodeToStep.set(s.flowNodeId, s);
      }
    });

    // Build adjacency list for outgoing edges
    const outgoingEdges = new Map<string, FlowEdge[]>();
    flowEdges.forEach(edge => {
      const existing = outgoingEdges.get(edge.fromNodeId) || [];
      existing.push(edge);
      outgoingEdges.set(edge.fromNodeId, existing);
    });

    // Find merge nodes (nodes with multiple incoming edges)
    const incomingEdgeCount = new Map<string, number>();
    flowEdges.forEach(edge => {
      incomingEdgeCount.set(edge.toNodeId, (incomingEdgeCount.get(edge.toNodeId) || 0) + 1);
    });
    const mergeNodes = new Set(
      Array.from(incomingEdgeCount.entries())
        .filter(([_, count]) => count > 1)
        .map(([nodeId]) => nodeId)
    );

    // Find start node
    const startNode = flowNodes.find(n => n.nodeType === "start");
    if (!startNode) {
      // Fallback: just show steps sorted by number
      return [...steps]
        .sort((a, b) => a.stepNumber - b.stepNumber)
        .map(s => ({ type: "step" as const, step: s }));
    }

    // Track globally visited nodes and pending branches
    const visited = new Set<string>();
    const pendingBranches: Array<{
      decisionNode: FlowNode;
      edge: FlowEdge;
      startNodeId: string;
    }> = [];

    // Helper to get step from node
    const getStepFromNode = (node: FlowNode): ProcessStep | null => {
      if (node.nodeType !== "action") return null;
      return node.stepNumber
        ? steps.find(s => s.stepNumber === node.stepNumber) || null
        : nodeToStep.get(node.nodeId) || null;
    };

    // Sequential traversal - follows one path, queues branches for later
    const traverseSequential = (nodeId: string, stopAtMerge: boolean = false): void => {
      if (visited.has(nodeId)) return;

      // Stop at merge nodes when processing branches (to avoid duplicates)
      if (stopAtMerge && mergeNodes.has(nodeId)) return;

      visited.add(nodeId);

      const node = flowNodes.find(n => n.nodeId === nodeId);
      if (!node) return;

      // Add node to list based on type
      if (node.nodeType === "action") {
        const step = getStepFromNode(node);
        if (step) {
          items.push({ type: "step", step });
        }
      } else if (node.nodeType === "decision" || node.nodeType === "switch") {
        items.push({ type: "decision", node });
      }
      // Skip start, end, merge, loopBack nodes

      // Get outgoing edges
      const edges = outgoingEdges.get(nodeId) || [];

      if (edges.length === 0) return;

      // For decision/switch nodes, find default branch and queue alternatives
      if (node.nodeType === "decision" || node.nodeType === "switch") {
        // Helper to check if edge is the "default/main" continuation
        const isDefaultBranch = (edge: FlowEdge): boolean => {
          if (edge.isDefault) return true;
          const label = (edge.label || "").toLowerCase();
          const condition = (edge.condition || "").toLowerCase();
          // "No/Nie/False" is often the "nothing special, continue" path
          return label === "no" || label === "nie" || label === "false" ||
            condition === "no" || condition === "nie" || condition === "false";
        };

        // Find default branch (main continuation) and alternative branches
        const defaultEdge = edges.find(e => isDefaultBranch(e) && !visited.has(e.toNodeId));
        const alternativeEdges = edges.filter(e => e !== defaultEdge && !visited.has(e.toNodeId));

        // Queue alternative branches for later processing (with colors)
        alternativeEdges.forEach(edge => {
          pendingBranches.push({ decisionNode: node, edge, startNodeId: edge.toNodeId });
        });

        // Continue with default branch as part of main flow (no color)
        if (defaultEdge) {
          traverseSequential(defaultEdge.toNodeId, stopAtMerge);
        }
      } else {
        // For regular nodes, continue with the first unvisited edge
        const nextEdge = edges.find(e => !visited.has(e.toNodeId));
        if (nextEdge) {
          traverseSequential(nextEdge.toNodeId, stopAtMerge);
        }
      }
    };

    // Collect items for a branch (steps and nested decisions)
    type BranchItem =
      | { type: "step"; step: ProcessStep }
      | { type: "decision"; node: FlowNode }
      | { type: "nested-branch"; decisionNode: FlowNode; edge: FlowEdge; startNodeId: string };

    const collectBranchItems = (nodeId: string): BranchItem[] => {
      const branchItems: BranchItem[] = [];
      const branchVisited = new Set<string>();

      const collect = (nId: string): void => {
        if (visited.has(nId) || branchVisited.has(nId)) return;
        if (mergeNodes.has(nId) && branchVisited.size > 0) return; // Stop at merge (but allow first node)

        branchVisited.add(nId);
        visited.add(nId);

        const node = flowNodes.find(n => n.nodeId === nId);
        if (!node) return;

        if (node.nodeType === "action") {
          const step = getStepFromNode(node);
          if (step) {
            branchItems.push({ type: "step", step });
          }
        } else if (node.nodeType === "decision" || node.nodeType === "switch") {
          // Add the decision
          branchItems.push({ type: "decision", node });

          // Queue nested branches
          const edges = outgoingEdges.get(nId) || [];
          edges.forEach(edge => {
            if (!visited.has(edge.toNodeId) && !branchVisited.has(edge.toNodeId)) {
              branchItems.push({
                type: "nested-branch",
                decisionNode: node,
                edge,
                startNodeId: edge.toNodeId
              });
            }
          });
          return; // Don't continue past decision - branches will handle it
        }

        // Continue traversing for non-decision nodes
        const edges = outgoingEdges.get(nId) || [];
        edges.forEach(edge => collect(edge.toNodeId));
      };

      collect(nodeId);
      return branchItems;
    };

    // PHASE 1: Traverse main flow from start
    traverseSequential(startNode.nodeId, false);

    // PHASE 2: Process pending branches (including nested ones)
    while (pendingBranches.length > 0) {
      const { decisionNode, edge, startNodeId } = pendingBranches.shift()!;

      if (visited.has(startNodeId)) continue;

      const branchLabel = edge.label || edge.condition || "Branch";
      const decisionLabel = decisionNode.label || decisionNode.condition || "Condition";

      // Add branch header
      items.push({
        type: "branch-header",
        branchLabel,
        decisionLabel,
        decisionNodeId: decisionNode.nodeId
      });

      // Collect and add branch items
      const branchItems = collectBranchItems(startNodeId);
      branchItems.forEach(branchItem => {
        if (branchItem.type === "step") {
          items.push({ type: "step", step: branchItem.step, branchLabel });
        } else if (branchItem.type === "decision") {
          items.push({ type: "decision", node: branchItem.node });
        } else if (branchItem.type === "nested-branch") {
          // Queue nested branches for processing
          pendingBranches.push({
            decisionNode: branchItem.decisionNode,
            edge: branchItem.edge,
            startNodeId: branchItem.startNodeId
          });
        }
      });
    }

    // Add any steps that weren't found in flow traversal
    const addedStepNumbers = new Set(
      items.filter(i => i.type === "step").map(i => (i as { type: "step"; step: ProcessStep }).step.stepNumber)
    );
    const missingSteps = [...steps]
      .filter(s => !addedStepNumbers.has(s.stepNumber))
      .sort((a, b) => a.stepNumber - b.stepNumber);

    if (missingSteps.length > 0) {
      items.push({
        type: "branch-header",
        branchLabel: "Other",
        decisionLabel: "Unlinked Steps",
        decisionNodeId: "other"
      });
      missingSteps.forEach(s => items.push({ type: "step", step: s }));
    }

    return items;
  }, [steps, flowNodes, flowEdges, showDecisions]);

  // Count decisions for display
  const decisionCount = flowNodes?.filter(
    n => n.nodeType === "decision" || n.nodeType === "switch"
  ).length || 0;
  const [isDetectingAll, setIsDetectingAll] = useState(false);
  const [detectAllResult, setDetectAllResult] = useState<{ processed: number; failed: number } | null>(null);
  const [lightboxStepNumber, setLightboxStepNumber] = useState<number | null>(null);

  // Edit/Add dialog state
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addAfterStepNumber, setAddAfterStepNumber] = useState<number | undefined>(undefined);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const detectAllBoundingBoxes = useAction(api.boundingBoxes.detectBoundingBoxes);
  const deleteStep = useMutation(api.steps.deleteStep);

  // Handle delete step
  const handleDeleteStep = async (stepId: string) => {
    try {
      setDeletingStepId(stepId);
      await deleteStep({ stepId: stepId as Id<"steps"> });
    } catch (error) {
      console.error("Failed to delete step:", error);
    } finally {
      setDeletingStepId(null);
    }
  };

  // Get current step for lightbox
  const currentLightboxStep = lightboxStepNumber !== null
    ? steps.find(s => s.stepNumber === lightboxStepNumber)
    : null;

  // Get prev/next steps for lightbox navigation
  const currentStepIndex = lightboxStepNumber !== null
    ? steps.findIndex(s => s.stepNumber === lightboxStepNumber)
    : -1;
  const prevLightboxStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;
  const nextLightboxStep = currentStepIndex < steps.length - 1 ? steps[currentStepIndex + 1] : null;

  const handleDetectAll = async () => {
    if (!processId) return;
    setIsDetectingAll(true);
    setDetectAllResult(null);
    try {
      const result = await detectAllBoundingBoxes({
        processId: processId as any,
        forceRedetect: true,
      });
      setDetectAllResult({ processed: result.processed, failed: result.failed });
    } catch (error) {
      console.error("Failed to detect all:", error);
    } finally {
      setIsDetectingAll(false);
    }
  };

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedSteps(new Set());
    } else {
      setExpandedSteps(new Set(steps.map((s) => s.stepNumber)));
    }
    setAllExpanded(!allExpanded);
  };

  if (!steps || steps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No steps found in this process.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardWidthClasses[columns]}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">
            Process Steps ({steps.length})
            {decisionCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                + {decisionCount} decision{decisionCount > 1 ? "s" : ""}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Show decisions toggle */}
            {decisionCount > 0 && (
              <Button
                variant={showDecisions ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDecisions(!showDecisions)}
                className="gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                {showDecisions ? "Hide" : "Show"} Decisions
              </Button>
            )}
            {/* Column selector */}
            <div className="flex items-center border rounded-md">
              {([1, 2, 3] as ColumnCount[]).map((col) => (
                <button
                  key={col}
                  onClick={() => setColumns(col)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${columns === col
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                    } ${col === 1 ? "rounded-l-md" : ""} ${col === 3 ? "rounded-r-md" : ""}`}
                  title={`${col} column${col > 1 ? "s" : ""}`}
                >
                  {col === 1 && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  )}
                  {col === 2 && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <rect x="3" y="3" width="7" height="18" rx="1" />
                      <rect x="14" y="3" width="7" height="18" rx="1" />
                    </svg>
                  )}
                  {col === 3 && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <rect x="3" y="3" width="4" height="18" rx="1" />
                      <rect x="10" y="3" width="4" height="18" rx="1" />
                      <rect x="17" y="3" width="4" height="18" rx="1" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allExpanded ? "Collapse All" : "Expand All"}
            </Button>
            {processId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddAfterStepNumber(steps.length);
                    setShowAddDialog(true);
                  }}
                  className="gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Step
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDetectAll}
                  disabled={isDetectingAll}
                  className="gap-1"
                >
                  {isDetectingAll ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Detecting...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 3v18" />
                      </svg>
                      Detect All
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
        {detectAllResult && (
          <p className="text-sm text-muted-foreground mt-2">
            Detected: {detectAllResult.processed} steps
            {detectAllResult.failed > 0 && `, Failed: ${detectAllResult.failed}`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className={`grid ${columnGridClasses[columns]}`}>
          {unifiedList.map((item, index) => {
            // Color palette for branches (no red)
            const branchColors = [
              { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", line: "bg-amber-200", stepBorder: "border-l-amber-400" },
              { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", line: "bg-purple-200", stepBorder: "border-l-purple-400" },
              { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", line: "bg-orange-200", stepBorder: "border-l-orange-400" },
              { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700", line: "bg-teal-200", stepBorder: "border-l-teal-400" },
              { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-700", line: "bg-pink-200", stepBorder: "border-l-pink-400" },
              { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700", line: "bg-indigo-200", stepBorder: "border-l-indigo-400" },
              { bg: "bg-lime-50", border: "border-lime-400", text: "text-lime-700", line: "bg-lime-200", stepBorder: "border-l-lime-500" },
              { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700", line: "bg-cyan-200", stepBorder: "border-l-cyan-400" },
            ];

            // Get color based on decision node ID
            const getColorForBranch = (decisionNodeId: string): typeof branchColors[0] => {
              let hash = 0;
              for (let i = 0; i < decisionNodeId.length; i++) {
                hash = ((hash << 5) - hash) + decisionNodeId.charCodeAt(i);
                hash = hash & hash;
              }
              return branchColors[Math.abs(hash) % branchColors.length];
            };

            if (item.type === "branch-header") {
              const color = getColorForBranch(item.decisionNodeId);
              return (
                <div
                  key={`branch-${item.decisionNodeId}-${item.branchLabel}-${index}`}
                  className="col-span-full mt-6 mb-2 first:mt-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-px flex-1 ${color.line}`}></div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 ${color.bg} border ${color.border} rounded-full`}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 ${color.text}`}>
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                        <line x1="4" y1="4" x2="9" y2="9" />
                      </svg>
                      <span className={`text-sm font-medium ${color.text}`}>
                        {item.decisionLabel}: <span className="font-bold">{item.branchLabel}</span>
                      </span>
                    </div>
                    <div className={`h-px flex-1 ${color.line}`}></div>
                  </div>
                </div>
              );
            }
            if (item.type === "decision") {
              return (
                <DecisionItem
                  key={`decision-${item.node.nodeId}`}
                  node={item.node}
                  edges={flowEdges}
                  flowNodes={flowNodes}
                  onStepSelect={onStepSelect}
                />
              );
            }
            const step = item.step;
            const branchLabel = 'branchLabel' in item ? item.branchLabel : undefined;
            // Find the branch header to get correct color
            const branchDecisionId = branchLabel
              ? unifiedList.slice(0, index).reverse().find(
                i => i.type === "branch-header" && 'branchLabel' in i && i.branchLabel === branchLabel
              )
              : null;
            const stepColor = branchDecisionId && 'decisionNodeId' in branchDecisionId
              ? getColorForBranch(branchDecisionId.decisionNodeId)
              : null;

            return (
              <div
                key={step._id || step.stepNumber}
                className={stepColor ? `border-l-4 ${stepColor.stepBorder} pl-1` : ""}
              >
                <StepItem
                  step={step}
                  isExpanded={expandedSteps.has(step.stepNumber)}
                  onToggle={() => toggleStep(step.stepNumber)}
                  onOpenLightbox={(stepNumber) => setLightboxStepNumber(stepNumber)}
                  onEdit={() => setEditingStep(step)}
                  onDelete={() => handleDeleteStep(step._id)}
                  isDeleting={deletingStepId === step._id}
                  onAddAfter={() => {
                    setAddAfterStepNumber(step.stepNumber);
                    setShowAddDialog(true);
                  }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Lightbox */}
      <ScreenshotLightbox
        step={currentLightboxStep as LightboxStep | null}
        open={lightboxStepNumber !== null}
        onOpenChange={(open) => !open && setLightboxStepNumber(null)}
        onPrev={prevLightboxStep ? () => setLightboxStepNumber(prevLightboxStep.stepNumber) : undefined}
        onNext={nextLightboxStep ? () => setLightboxStepNumber(nextLightboxStep.stepNumber) : undefined}
        hasPrev={!!prevLightboxStep}
        hasNext={!!nextLightboxStep}
        processId={processId}
      />

      {/* Edit Step Dialog */}
      {editingStep && processId && (
        <StepEditDialog
          step={editingStep}
          processId={processId}
          open={!!editingStep}
          onOpenChange={(open) => !open && setEditingStep(null)}
          onSave={() => setEditingStep(null)}
        />
      )}

      {/* Add Step Dialog */}
      {processId && (
        <AddStepDialog
          processId={processId}
          afterStepNumber={addAfterStepNumber}
          totalSteps={steps.length}
          defaultApplication={steps[0]?.application || ""}
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
        />
      )}
    </Card>
  );
}
