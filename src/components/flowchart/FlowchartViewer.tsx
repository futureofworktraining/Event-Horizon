"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Panel,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { getProcessColorHex, PROCESS_COLORS_HEX } from "@/lib/processColors";
import { ActionTypeBadge } from "@/components/pdd/ActionTypeBadge";
import { ScreenshotLightbox, LightboxStep } from "@/components/pdd/ScreenshotLightbox";

// Types from database
interface FlowNodeDB {
  nodeId: string;
  nodeType: string;
  stepNumber?: number;
  condition?: string;
  conditionDescription?: string;
  subprocessId?: string;
  endType?: string;
  label?: string;
  position?: { x: number; y: number };
}

interface FlowEdgeDB {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType?: string;
  label?: string;
  condition?: string;
  sourceHandle?: string;
  targetHandle?: string;
  isDefault?: boolean;
}

interface BoundingBox {
  label: string;
  box_2d: number[];
  found: boolean;
  masked: boolean;
}

interface StepData {
  _id: string;
  stepNumber: number;
  description?: string;
  application?: string;
  actionType?: string;
  specificAction?: string;
  screenshotUrl?: string | null;
  overlayImageUrl?: string | null;
  timestamp?: string;
  screenName?: string;
  uiElement?: {
    elementName?: string;
    elementType?: string;
    locationDescription?: string;
    screenRegion?: string;
  };
  dataInfo?: {
    value?: string;
    dataType?: string;
    isSensitive?: boolean;
  };
  boundingBox?: BoundingBox | null;
  boundingBoxDetected?: boolean;
}

interface SubprocessData {
  _id: string;
  processName: string;
  colorIndex?: number;
  totalSteps?: number;
}

interface ProcessFlowData {
  processId: string;
  nodes: FlowNodeDB[];
  edges: FlowEdgeDB[];
}

interface FlowchartViewerProps {
  flow: ProcessFlowData | null;
  steps: StepData[];
  subprocesses?: SubprocessData[];
  colorIndex?: number;
  onStepClick?: (stepNumber: number) => void;
  onSubprocessClick?: (subprocessId: string) => void;
  collapsedSubprocesses?: Set<string>;
  onToggleSubprocessCollapse?: (subprocessId: string) => void;
  selectedStepNumber?: number;
  className?: string;
}

// Node dimensions for layout (must match actual rendered sizes in pixels)
// These are used by dagre to calculate node positions without overlap
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  start: { width: 80, height: 100 },      // Circle 64px + label
  end: { width: 80, height: 100 },        // Circle 64px + label
  action: { width: 250, height: 120 },    // min-w-180 max-w-240 + padding + content
  decision: { width: 140, height: 160 },  // Diamond 112px + optional description
  switch: { width: 180, height: 120 },    // Similar to decision but wider
  merge: { width: 60, height: 60 },       // Small circle
  subprocess: { width: 280, height: 100 },// Wider for subprocess content
  loop_back: { width: 80, height: 80 },   // Small loop indicator
};

// Apply Dagre layout to nodes and edges
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const dagreGraph = new dagre.graphlib.Graph({ directed: true, compound: false, multigraph: false });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100,  // Horizontal spacing between nodes in same rank
    ranksep: 120,  // Vertical spacing between ranks/levels
    edgesep: 50,   // Spacing between edges
    marginx: 40,
    marginy: 40,
    align: "UL",   // Align nodes in rank (UL = upper-left)
  });

  // Add nodes to dagre with their dimensions
  nodes.forEach((node) => {
    const dimensions = NODE_DIMENSIONS[node.type || "action"] || {
      width: 200,
      height: 80,
    };
    dagreGraph.setNode(node.id, {
      width: dimensions.width,
      height: dimensions.height,
      label: node.id
    });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Calculate layout
  try {
    dagre.layout(dagreGraph);
  } catch (error) {
    console.error("Dagre layout error:", error);
    return { nodes, edges };
  }

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const dimensions = NODE_DIMENSIONS[node.type || "action"] || {
      width: 200,
      height: 80,
    };

    // Fallback if dagre didn't calculate position
    if (!nodeWithPosition || typeof nodeWithPosition.x !== 'number') {
      console.warn(`No position calculated for node ${node.id}`);
      return node;
    }

    const newPosition = {
      x: nodeWithPosition.x - dimensions.width / 2,
      y: nodeWithPosition.y - dimensions.height / 2,
    };

    return {
      ...node,
      position: newPosition,
    };
  });

  // Debug log
  console.log("Dagre layout calculated:", layoutedNodes.map(n => ({
    id: n.id,
    type: n.type,
    position: n.position
  })));

  return { nodes: layoutedNodes, edges };
}

// Convert database flow to React Flow format
function convertFlowToReactFlow(
  flow: ProcessFlowData,
  steps: StepData[],
  subprocesses: SubprocessData[],
  colorIndex: number,
  layoutDirection: "TB" | "LR",
  selectedStepNumber?: number,
  onStepClick?: (stepNumber: number) => void,
  onSubprocessClick?: (subprocessId: string) => void,
  collapsedSubprocesses?: Set<string>,
  onToggleSubprocessCollapse?: (subprocessId: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const stepsMap = new Map(steps.map((s) => [s.stepNumber, s]));
  const subprocessMap = new Map(subprocesses.map((s) => [s._id, s]));

  // Convert nodes
  const nodes: Node[] = flow.nodes.map((node) => {
    const baseNode: Node = {
      id: node.nodeId,
      type: node.nodeType,
      position: node.position || { x: 0, y: 0 },
      data: {},
    };

    switch (node.nodeType) {
      case "start":
        baseNode.data = { label: node.label || "Start" };
        break;

      case "end":
        baseNode.data = {
          label: node.label,
          endType: node.endType || "success",
        };
        break;

      case "action":
        const step = node.stepNumber ? stepsMap.get(node.stepNumber) : null;
        baseNode.data = {
          label: step?.specificAction || step?.description || node.label,
          stepNumber: node.stepNumber,
          description: step?.description,
          application: step?.application,
          colorIndex,
          isSelected: selectedStepNumber === node.stepNumber,
          onClick: step && onStepClick ? () => onStepClick(step.stepNumber) : undefined,
        };
        break;

      case "decision":
        baseNode.data = {
          label: node.label,
          condition: node.condition,
          conditionDescription: node.conditionDescription,
          colorIndex,
        };
        break;

      case "switch":
        baseNode.data = {
          label: node.label,
          condition: node.condition,
          conditionDescription: node.conditionDescription,
        };
        break;

      case "merge":
        baseNode.data = { label: node.label };
        break;

      case "subprocess":
        const subprocess = node.subprocessId
          ? subprocessMap.get(node.subprocessId)
          : null;
        baseNode.data = {
          label: node.label,
          subprocessId: node.subprocessId,
          subprocessName: subprocess?.processName,
          colorIndex: subprocess?.colorIndex ?? colorIndex + 1,
          stepCount: subprocess?.totalSteps,
          isCollapsed: node.subprocessId
            ? collapsedSubprocesses?.has(node.subprocessId)
            : false,
          onToggleCollapse: node.subprocessId && onToggleSubprocessCollapse
            ? () => onToggleSubprocessCollapse(node.subprocessId!)
            : undefined,
          onNavigate: node.subprocessId && onSubprocessClick
            ? () => onSubprocessClick(node.subprocessId!)
            : undefined,
        };
        break;

      case "loop_back":
        baseNode.data = {
          label: node.label || "Loop",
          targetNodeId: node.subprocessId, // Using subprocessId field for target
        };
        break;

      default:
        baseNode.data = { label: node.label || node.nodeId };
    }

    return baseNode;
  });

  // Build node type map for handle selection
  const nodeTypeMap = new Map(flow.nodes.map((n) => [n.nodeId, n.nodeType]));

  // Helper to determine if edge is a "yes" or "no" branch
  const isYesBranch = (edge: FlowEdgeDB): boolean => {
    const label = (edge.label || "").toLowerCase();
    const condition = (edge.condition || "").toLowerCase();
    return label === "tak" || label === "yes" || label === "true" ||
           condition === "yes" || condition === "tak" || condition === "true" ||
           edge.isDefault === true;
  };

  const isNoBranch = (edge: FlowEdgeDB): boolean => {
    const label = (edge.label || "").toLowerCase();
    const condition = (edge.condition || "").toLowerCase();
    return label === "nie" || label === "no" || label === "false" ||
           condition === "no" || condition === "nie" || condition === "false";
  };

  // Convert edges with direction-aware handles
  const edges: Edge[] = flow.edges.map((edge) => {
    const sourceNodeType = nodeTypeMap.get(edge.fromNodeId);
    const targetNodeType = nodeTypeMap.get(edge.toNodeId);

    // Determine source handle based on layout direction and node type
    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    if (!sourceHandle) {
      // Default handles based on layout direction
      if (layoutDirection === "LR") {
        sourceHandle = "right";
        // Special case for decision branches in LR
        if (sourceNodeType === "decision") {
          if (isNoBranch(edge)) {
            sourceHandle = "no-bottom";
          } else if (isYesBranch(edge)) {
            sourceHandle = "yes-right";
          } else {
            // Default: first edge is yes (right), second is no (bottom)
            sourceHandle = "yes-right";
          }
        }
      } else {
        sourceHandle = "bottom";
        // Special case for decision branches in TB
        if (sourceNodeType === "decision") {
          if (isNoBranch(edge)) {
            sourceHandle = "no";
          } else if (isYesBranch(edge)) {
            sourceHandle = "yes";
          } else {
            // Default: first edge is yes (bottom), second is no (right)
            sourceHandle = "yes";
          }
        }
      }
    }

    if (!targetHandle) {
      // Default handles based on layout direction
      targetHandle = layoutDirection === "LR" ? "left" : "top";
    }

    return {
      id: edge.edgeId,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      sourceHandle,
      targetHandle,
      type: "custom",
      data: {
        edgeType: edge.edgeType || "normal",
        label: edge.label,
        condition: edge.condition,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      animated: edge.edgeType === "loop",
    };
  });

  return { nodes, edges };
}

// Step Detail Popup Component
interface StepDetailPopupProps {
  step: StepData;
  position: { x: number; y: number };
  onClose: () => void;
  onDrag: (position: { x: number; y: number }) => void;
  onOpenLightbox: () => void;
}

function StepDetailPopup({ step, position, onClose, onDrag, onOpenLightbox }: StepDetailPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCroppedElement, setShowCroppedElement] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  const detectAndOverlay = useAction(api.boundingBoxOverlay.detectAndOverlay);

  const canDetect = step.screenshotUrl && step.uiElement;

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.popup-content')) return;
    e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      onDrag({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag]);

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white rounded-lg shadow-2xl border-2 border-gray-200 w-[460px] max-h-[550px] overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header - draggable */}
      <div
        className="bg-gray-100 px-4 py-2 flex items-center justify-between cursor-grab border-b"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {step.stepNumber}
          </span>
          {step.timestamp && (
            <span className="text-xs text-muted-foreground font-mono">
              {step.timestamp}
            </span>
          )}
          {step.actionType && (
            <ActionTypeBadge
              actionType={step.actionType}
              specificAction={step.specificAction || ""}
            />
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="popup-content overflow-y-auto max-h-[450px]">
        {/* Screenshot */}
        {step.screenshotUrl && (
          <div className="relative bg-gray-900 group">
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
                  className="relative cursor-pointer group aspect-[16/10] bg-muted flex items-center justify-center overflow-hidden"
                  onClick={onOpenLightbox}
                >
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
                </div>
              );
            })() : (
              <div
                onClick={onOpenLightbox}
                className="relative cursor-pointer group aspect-[16/10] bg-muted flex items-center justify-center overflow-hidden"
              >
                {/* Container that preserves aspect ratio */}
                <div className="relative w-full h-full flex items-center justify-center">
                  {step.overlayImageUrl ? (
                    <img
                      src={step.overlayImageUrl}
                      alt={`Screenshot for step ${step.stepNumber}`}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="relative max-w-full max-h-full">
                      <img
                        src={step.screenshotUrl}
                        alt={`Screenshot for step ${step.stepNumber}`}
                        className="max-w-full max-h-full object-contain"
                      />
                      {/* Bounding box overlay - positioned relative to the image */}
                      {step.boundingBox?.found && step.boundingBox.box_2d?.length === 4 && (
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            left: `${(step.boundingBox.box_2d[1] / 1000) * 100}%`,
                            top: `${(step.boundingBox.box_2d[0] / 1000) * 100}%`,
                            width: `${((step.boundingBox.box_2d[3] - step.boundingBox.box_2d[1]) / 1000) * 100}%`,
                            height: `${((step.boundingBox.box_2d[2] - step.boundingBox.box_2d[0]) / 1000) * 100}%`,
                            border: step.boundingBox.masked ? "3px solid #dc2626" : "2px solid #22c55e",
                            backgroundColor: step.boundingBox.masked ? "rgba(220, 38, 38, 0.85)" : "rgba(34, 197, 94, 0.15)",
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to enlarge
                  </span>
                </div>
              </div>
            )}

            {/* Label badges */}
            {step.boundingBox?.found && (
              <div className="absolute bottom-2 left-2 z-20 flex gap-1">
                <div className="text-white text-xs px-2 py-1 rounded font-medium shadow-md bg-green-600">
                  {step.uiElement?.elementName || step.boundingBox.label}
                </div>
                {step.boundingBox.masked && (
                  <div className="text-white text-xs px-2 py-1 rounded font-medium shadow-md bg-red-600">
                    Sensitive
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {canDetect && (
              <div className="absolute bottom-2 right-2 z-40 flex gap-2">
                {/* Show element button */}
                {step.boundingBox?.found && step.screenshotUrl && !step.boundingBox.masked && (
                  <button
                    onClick={() => setShowCroppedElement(!showCroppedElement)}
                    className={`text-white text-sm px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-lg ${
                      showCroppedElement
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
                {/* Re-detect button */}
                <button
                  onClick={handleQuickDetect}
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
              </div>
            )}
          </div>
        )}

        {/* Status badges */}
        {(detectError || step.boundingBox?.found || (step.boundingBoxDetected && !step.boundingBox?.found)) && (
          <div className="px-4 pt-2 flex flex-wrap gap-1">
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
        )}

        {/* Details */}
        <div className="p-4 space-y-3">
          {/* Description */}
          <div>
            <p className="text-sm font-medium text-gray-800">{step.description}</p>
            {(step.application || step.screenName) && (
              <p className="text-xs text-muted-foreground mt-1">
                {step.application}
                {step.application && step.screenName && " • "}
                {step.screenName}
              </p>
            )}
          </div>

          {/* UI Element */}
          {step.uiElement && (
            <div className="bg-gray-50 rounded-md p-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">UI Element</h4>
              <div className="space-y-1">
                {step.uiElement.elementName && (
                  <p className="text-sm"><span className="text-muted-foreground">Name:</span> {step.uiElement.elementName}</p>
                )}
                {step.uiElement.elementType && (
                  <p className="text-sm"><span className="text-muted-foreground">Type:</span> {step.uiElement.elementType}</p>
                )}
                {step.uiElement.locationDescription && (
                  <p className="text-sm"><span className="text-muted-foreground">Location:</span> {step.uiElement.locationDescription}</p>
                )}
              </div>
            </div>
          )}

          {/* Data Info */}
          {step.dataInfo && (
            <div className="bg-blue-50 rounded-md p-3">
              <h4 className="text-xs font-semibold text-blue-600 mb-2">Data</h4>
              <div className="space-y-1">
                {step.dataInfo.value && (
                  <p className="text-sm font-mono bg-white px-2 py-1 rounded border">
                    {step.dataInfo.isSensitive ? '••••••' : step.dataInfo.value}
                  </p>
                )}
                {step.dataInfo.dataType && (
                  <p className="text-xs text-muted-foreground">Type: {step.dataInfo.dataType}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Minimap node color function
function getMinimapNodeColor(node: Node): string {
  const colorIndex = (node.data as { colorIndex?: number })?.colorIndex ?? 0;
  const color = PROCESS_COLORS_HEX[colorIndex % PROCESS_COLORS_HEX.length];

  switch (node.type) {
    case "start":
      return "#22C55E";
    case "end":
      return "#EF4444";
    case "decision":
    case "switch":
      return "#F59E0B";
    case "subprocess":
      return color.main;
    default:
      return color.light;
  }
}

type LayoutDirection = "TB" | "LR";

export default function FlowchartViewer({
  flow,
  steps,
  subprocesses = [],
  colorIndex = 0,
  onStepClick,
  onSubprocessClick,
  collapsedSubprocesses,
  onToggleSubprocessCollapse,
  selectedStepNumber,
  className = "",
}: FlowchartViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLayouted, setIsLayouted] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("TB");

  // Popup state
  const [popupStep, setPopupStep] = useState<StepData | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 100, y: 100 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Lightbox state
  const [lightboxStep, setLightboxStep] = useState<StepData | null>(null);

  // Handle step click - show popup
  const handleStepClick = useCallback((stepNumber: number) => {
    const step = steps.find(s => s.stepNumber === stepNumber);
    if (step) {
      setPopupStep(step);
      // Position popup near center of container
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPopupPosition({
          x: Math.max(20, rect.width / 2 - 210),
          y: Math.max(20, 50),
        });
      }
    }
    // Also call external handler if provided
    if (onStepClick) {
      onStepClick(stepNumber);
    }
  }, [steps, onStepClick]);

  // Convert and layout the flow
  useEffect(() => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      setIsLayouted(false);
      return;
    }

    const { nodes: convertedNodes, edges: convertedEdges } = convertFlowToReactFlow(
      flow,
      steps,
      subprocesses,
      colorIndex,
      layoutDirection,
      selectedStepNumber,
      handleStepClick,  // Use internal handler for popup
      onSubprocessClick,
      collapsedSubprocesses,
      onToggleSubprocessCollapse
    );

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      convertedNodes,
      convertedEdges,
      layoutDirection
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setIsLayouted(true);
  }, [
    flow,
    steps,
    subprocesses,
    colorIndex,
    selectedStepNumber,
    collapsedSubprocesses,
    layoutDirection,
    handleStepClick,
  ]);

  // Fit view when layout changes
  const onInit = useCallback((reactFlowInstance: any) => {
    if (isLayouted) {
      reactFlowInstance.fitView({ padding: 0.1 });
    }
  }, [isLayouted]);

  // Process color for theming
  const processColor = getProcessColorHex(colorIndex);

  if (!flow || !flow.nodes || flow.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No flowchart available</p>
          <p className="text-sm">Process flow data will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative h-[600px] bg-gray-50 rounded-lg border ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#E5E7EB" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={getMinimapNodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-white !border !border-gray-200 !rounded-lg"
        />
        <Panel position="top-right" className="bg-white px-3 py-2 rounded-lg shadow-sm border">
          <div className="flex items-center gap-4">
            {/* Layout direction toggle */}
            <div className="flex items-center gap-1 border rounded-md overflow-hidden">
              <button
                onClick={() => setLayoutDirection("TB")}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  layoutDirection === "TB"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Vertical layout (top to bottom)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M12 3v18M12 3l-4 4M12 3l4 4" />
                </svg>
              </button>
              <button
                onClick={() => setLayoutDirection("LR")}
                className={`px-2 py-1 text-xs font-medium transition-colors ${
                  layoutDirection === "LR"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-100 text-gray-600"
                }`}
                title="Horizontal layout (left to right)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M3 12h18M21 12l-4-4M21 12l-4 4" />
                </svg>
              </button>
            </div>
            {/* Process color indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: processColor.main }}
              />
              <span className="text-xs">Color</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Step Detail Popup */}
      {popupStep && (
        <StepDetailPopup
          step={popupStep}
          position={popupPosition}
          onClose={() => setPopupStep(null)}
          onDrag={setPopupPosition}
          onOpenLightbox={() => setLightboxStep(popupStep)}
        />
      )}

      {/* Lightbox */}
      <ScreenshotLightbox
        step={lightboxStep as LightboxStep | null}
        open={lightboxStep !== null}
        onOpenChange={(open) => !open && setLightboxStep(null)}
        processId={flow?.processId}
      />
    </div>
  );
}
