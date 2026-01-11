"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ActionTypeBadge } from "./ActionTypeBadge";
import { StepDetail } from "./StepDetail";
import { CropOverlay } from "./CropOverlay";
import { VideoCaptureModal } from "./VideoCaptureModal";
import { CloneScreenshotDialog } from "./CloneScreenshotDialog";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  CropCoordinates,
  transformBoxToCroppedSpace,
  transformBoxToOriginalSpace,
  boxArrayToCoords,
  coordsToBoxArray,
  isNoCrop,
  getCropImageStyle,
} from "@/lib/cropUtils";

interface BoundingBox {
  label: string;
  box_2d: number[];
  found: boolean;
  masked: boolean;
}

interface SensitiveInfoBox {
  id?: string;
  label: string;
  box_2d: number[];
  found: boolean;
  confidence?: number;
}

export interface LightboxStep {
  _id: string;
  stepNumber: number;
  timestamp?: string;
  timestampSeconds?: number;
  actionType?: string;
  specificAction?: string;
  description?: string;
  application?: string;
  screenName?: string;
  screenshotUrl?: string | null;
  boundingBox?: BoundingBox | null;
  sensitiveInfoBoxes?: SensitiveInfoBox[] | null;
  uiElement?: any;
  dataInfo?: any;
  waitCondition?: any;
  notes?: string;
  automationHint?: string;
  cropCoordinates?: CropCoordinates | null;
}

interface ScreenshotLightboxProps {
  step: LightboxStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional navigation
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  // For screenshot editing features
  processId?: string;
  onScreenshotUpdated?: () => void;
}

type DrawingMode = "none" | "ui-element" | "sensitive";

export function ScreenshotLightbox({
  step,
  open,
  onOpenChange,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  processId,
  onScreenshotUpdated,
}: ScreenshotLightboxProps) {
  const [showElement, setShowElement] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [elementPosition, setElementPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("none");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [pendingBox, setPendingBox] = useState<{ box_2d: number[] } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Box editing state
  type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
  type SelectedBox = { type: "ui" } | { type: "sensitive"; index: number; id?: string };
  const [selectedBox, setSelectedBox] = useState<SelectedBox | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [editStart, setEditStart] = useState<{ x: number; y: number; box: number[] } | null>(null);
  const [editedBox, setEditedBox] = useState<number[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic update state - keeps showing edited position until server confirms
  const [optimisticUiBox, setOptimisticUiBox] = useState<number[] | null>(null);
  const [optimisticSensitiveBoxes, setOptimisticSensitiveBoxes] = useState<Map<number, number[]>>(new Map());

  // Label editing state
  const [editingLabel, setEditingLabel] = useState<SelectedBox | null>(null);
  const [newLabel, setNewLabel] = useState("");

  // Mutations
  const updateBoundingBox = useMutation(api.steps.updateBoundingBox);
  const addSensitiveBox = useMutation(api.steps.addSensitiveBox);
  const removeSensitiveBox = useMutation(api.steps.removeSensitiveBox);
  const clearBoundingBox = useMutation(api.steps.clearBoundingBox);
  const clearSensitiveBoxes = useMutation(api.steps.clearSensitiveBoxes);
  const updateSensitiveBox = useMutation(api.steps.updateSensitiveBox);
  const updateSensitiveBoxLabel = useMutation(api.steps.updateSensitiveBoxLabel);
  const updateUiElementMutation = useMutation(api.steps.updateUiElement);

  // Detection actions
  const detectAndOverlay = useAction(api.boundingBoxOverlay.detectAndOverlay);
  const detectSensitive = useAction(api.sensitiveInfoDetection.detectSensitiveBoxesSingleStep);

  // Detection state
  const [showDetectUiDialog, setShowDetectUiDialog] = useState(false);
  const [showDetectSensitiveDialog, setShowDetectSensitiveDialog] = useState(false);
  const [detectUiPrompt, setDetectUiPrompt] = useState("");
  const [detectSensitivePrompt, setDetectSensitivePrompt] = useState("SSN, credit card numbers, passwords, email addresses, phone numbers, employee IDs, personal data, Client ID, Client Name, Client Country");
  const [isDetectingUi, setIsDetectingUi] = useState(false);
  const [isDetectingSensitive, setIsDetectingSensitive] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Screenshot replacement state
  const [showScreenshotMenu, setShowScreenshotMenu] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showVideoCaptureModal, setShowVideoCaptureModal] = useState(false);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revertVideoRef = useRef<HTMLVideoElement>(null);
  const revertCanvasRef = useRef<HTMLCanvasElement>(null);

  // Cropping state
  const [isCropping, setIsCropping] = useState(false);

  // Screenshot replacement mutations
  const updateStepScreenshot = useMutation(api.steps.updateStepScreenshot);
  const generateUploadUrl = useMutation(api.steps.generateUploadUrl);
  const updateStepCrop = useMutation(api.steps.updateStepCrop);

  // Query for video info (for capture from video feature)
  const videoInfo = useQuery(
    api.steps.getVideoForProcess,
    processId ? { processId: processId as Id<"processes"> } : "skip"
  );

  // Reset state when step changes
  useEffect(() => {
    setElementPosition(null);
    setShowDetails(false);
    setShowElement(false);
    setDrawingMode("none");
    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setShowLabelDialog(false);
    setPendingBox(null);
    setLabelInput("");
    setSelectedBox(null);
    setIsResizing(false);
    setIsMoving(false);
    setResizeHandle(null);
    setEditStart(null);
    setEditedBox(null);
    setIsSaving(false);
    setEditingLabel(null);
    setNewLabel("");
    setShowDetectUiDialog(false);
    setShowDetectSensitiveDialog(false);
    setDetectError(null);
    // Clear optimistic state on step change
    setOptimisticUiBox(null);
    setOptimisticSensitiveBoxes(new Map());
    // Reset screenshot editing state
    setShowScreenshotMenu(false);
    setShowCloneDialog(false);
    setShowVideoCaptureModal(false);
    setIsCropping(false);
    setIsReverting(false);
  }, [step?.stepNumber]);

  // Clear optimistic UI box when server data matches
  useEffect(() => {
    if (optimisticUiBox && step?.boundingBox?.box_2d) {
      const serverBox = step.boundingBox.box_2d;
      const matches = optimisticUiBox.every((val, idx) => Math.abs(val - serverBox[idx]) < 1);
      if (matches) {
        setOptimisticUiBox(null);
      }
    }
  }, [step?.boundingBox?.box_2d, optimisticUiBox]);

  // Clear optimistic sensitive boxes when server data matches
  useEffect(() => {
    if (optimisticSensitiveBoxes.size > 0 && step?.sensitiveInfoBoxes) {
      const newOptimistic = new Map(optimisticSensitiveBoxes);
      let changed = false;

      optimisticSensitiveBoxes.forEach((optimisticBox, index) => {
        const serverBox = step.sensitiveInfoBoxes?.[index]?.box_2d;
        if (serverBox) {
          const matches = optimisticBox.every((val, idx) => Math.abs(val - serverBox[idx]) < 1);
          if (matches) {
            newOptimistic.delete(index);
            changed = true;
          }
        }
      });

      if (changed) {
        setOptimisticSensitiveBoxes(newOptimistic);
      }
    }
  }, [step?.sensitiveInfoBoxes, optimisticSensitiveBoxes]);

  // Keyboard navigation (disabled when video capture modal is open)
  useEffect(() => {
    if (!open || showVideoCaptureModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && onPrev && hasPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && onNext && hasNext) {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onPrev, onNext, hasPrev, hasNext, showVideoCaptureModal]);

  // Calculate opposite corner for initial element position
  const getOppositeCorner = useCallback((boundingBox: BoundingBox | null | undefined): { x: number; y: number } => {
    if (!boundingBox?.found || !boundingBox.box_2d || boundingBox.box_2d.length !== 4) {
      return { x: 20, y: 20 };
    }

    const [ymin, xmin, ymax, xmax] = boundingBox.box_2d;
    const centerX = (xmin + xmax) / 2;
    const centerY = (ymin + ymax) / 2;

    const isLeft = centerX < 500;
    const isTop = centerY < 500;

    if (isLeft && isTop) return { x: 70, y: 70 };
    if (!isLeft && isTop) return { x: 5, y: 70 };
    if (isLeft && !isTop) return { x: 70, y: 5 };
    return { x: 5, y: 5 };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();
    const parentRect = elementRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const currentX = ((rect.left - parentRect.left) / parentRect.width) * 100;
    const currentY = ((rect.top - parentRect.top) / parentRect.height) * 100;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: currentX,
      startPosY: currentY,
    };
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current || !elementRef.current) return;

    const parentRect = elementRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const deltaX = ((e.clientX - dragRef.current.startX) / parentRect.width) * 100;
    const deltaY = ((e.clientY - dragRef.current.startY) / parentRect.height) * 100;

    let newX = dragRef.current.startPosX + deltaX;
    let newY = dragRef.current.startPosY + deltaY;

    newX = Math.max(0, Math.min(90, newX));
    newY = Math.max(0, Math.min(85, newY));

    setElementPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Drawing handlers
  const getRelativeCoordinates = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(1000, y)) };
  }, []);

  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode === "none") return;
    const coords = getRelativeCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    setDrawStart(coords);
    setDrawCurrent(coords);
  }, [drawingMode, getRelativeCoordinates]);

  const handleDrawMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;
    const coords = getRelativeCoordinates(e);
    if (!coords) return;
    setDrawCurrent(coords);
  }, [isDrawing, drawStart, getRelativeCoordinates]);

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    // Calculate box_2d: [ymin, xmin, ymax, xmax]
    const ymin = Math.min(drawStart.y, drawCurrent.y);
    const xmin = Math.min(drawStart.x, drawCurrent.x);
    const ymax = Math.max(drawStart.y, drawCurrent.y);
    const xmax = Math.max(drawStart.x, drawCurrent.x);

    // Minimum size check
    if (Math.abs(xmax - xmin) < 10 || Math.abs(ymax - ymin) < 10) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    setPendingBox({ box_2d: [ymin, xmin, ymax, xmax] });
    setShowLabelDialog(true);
    setIsDrawing(false);
  }, [isDrawing, drawStart, drawCurrent]);

  const handleSaveBox = useCallback(async () => {
    if (!step || !pendingBox || !labelInput.trim()) return;

    try {
      if (drawingMode === "ui-element") {
        await updateBoundingBox({
          stepId: step._id as Id<"steps">,
          boundingBox: {
            label: labelInput.trim(),
            box_2d: pendingBox.box_2d,
            found: true,
            masked: false,
          },
        });
      } else if (drawingMode === "sensitive") {
        await addSensitiveBox({
          stepId: step._id as Id<"steps">,
          sensitiveBox: {
            label: labelInput.trim(),
            box_2d: pendingBox.box_2d,
            found: true,
          },
        });
      }
    } catch (error) {
      console.error("Failed to save box:", error);
    }

    setShowLabelDialog(false);
    setPendingBox(null);
    setDrawStart(null);
    setDrawCurrent(null);
    setLabelInput("");
    setDrawingMode("none");
  }, [step, pendingBox, labelInput, drawingMode, updateBoundingBox, addSensitiveBox]);

  const handleCancelDraw = useCallback(() => {
    setShowLabelDialog(false);
    setPendingBox(null);
    setDrawStart(null);
    setDrawCurrent(null);
    setLabelInput("");
  }, []);

  const handleDeleteSensitiveBox = useCallback(async (index: number, boxId?: string) => {
    if (!step) return;
    try {
      await removeSensitiveBox({
        stepId: step._id as Id<"steps">,
        boxIndex: index,
        boxId: boxId,
      });
    } catch (error) {
      console.error("Failed to delete sensitive box:", error);
      // Even if server fails, we might want to optimistically update UI 
      // but Mutation handles it usually.
    }
  }, [step, removeSensitiveBox]);

  const handleClearUiBox = useCallback(async () => {
    if (!step) return;
    try {
      await clearBoundingBox({
        stepId: step._id as Id<"steps">,
      });
    } catch (error) {
      console.error("Failed to clear bounding box:", error);
    }
  }, [step, clearBoundingBox]);

  // Resize handlers
  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    handle: ResizeHandle,
    boxType: SelectedBox,
    currentBox: number[]
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const coords = getRelativeCoordinates(e as any);
    if (!coords) return;

    setSelectedBox(boxType);
    setIsResizing(true);
    setResizeHandle(handle);
    setEditStart({ x: coords.x, y: coords.y, box: [...currentBox] });
    setEditedBox([...currentBox]);
  }, [getRelativeCoordinates]);

  // Move handlers
  const handleMoveStart = useCallback((
    e: React.MouseEvent,
    boxType: SelectedBox,
    currentBox: number[]
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const coords = getRelativeCoordinates(e as any);
    if (!coords) return;

    setSelectedBox(boxType);
    setIsMoving(true);
    setEditStart({ x: coords.x, y: coords.y, box: [...currentBox] });
    setEditedBox([...currentBox]);
  }, [getRelativeCoordinates]);

  const handleEditMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((!isResizing && !isMoving) || !editStart || !editedBox) return;

    const coords = getRelativeCoordinates(e);
    if (!coords) return;

    const [origYmin, origXmin, origYmax, origXmax] = editStart.box;
    let [ymin, xmin, ymax, xmax] = [...editedBox];

    if (isMoving) {
      // Moving the entire box
      const deltaX = coords.x - editStart.x;
      const deltaY = coords.y - editStart.y;
      const width = origXmax - origXmin;
      const height = origYmax - origYmin;

      xmin = origXmin + deltaX;
      ymin = origYmin + deltaY;
      xmax = xmin + width;
      ymax = ymin + height;

      // Clamp to image bounds while preserving size
      if (xmin < 0) { xmin = 0; xmax = width; }
      if (ymin < 0) { ymin = 0; ymax = height; }
      if (xmax > 1000) { xmax = 1000; xmin = 1000 - width; }
      if (ymax > 1000) { ymax = 1000; ymin = 1000 - height; }
    } else if (isResizing && resizeHandle) {
      // Calculate new box based on which handle is being dragged
      switch (resizeHandle) {
        case "nw":
          ymin = Math.min(coords.y, origYmax - 20);
          xmin = Math.min(coords.x, origXmax - 20);
          break;
        case "ne":
          ymin = Math.min(coords.y, origYmax - 20);
          xmax = Math.max(coords.x, origXmin + 20);
          break;
        case "sw":
          ymax = Math.max(coords.y, origYmin + 20);
          xmin = Math.min(coords.x, origXmax - 20);
          break;
        case "se":
          ymax = Math.max(coords.y, origYmin + 20);
          xmax = Math.max(coords.x, origXmin + 20);
          break;
        case "n":
          ymin = Math.min(coords.y, origYmax - 20);
          break;
        case "s":
          ymax = Math.max(coords.y, origYmin + 20);
          break;
        case "w":
          xmin = Math.min(coords.x, origXmax - 20);
          break;
        case "e":
          xmax = Math.max(coords.x, origXmin + 20);
          break;
      }

      // Clamp to image bounds
      ymin = Math.max(0, ymin);
      xmin = Math.max(0, xmin);
      ymax = Math.min(1000, ymax);
      xmax = Math.min(1000, xmax);
    }

    setEditedBox([ymin, xmin, ymax, xmax]);
  }, [isResizing, isMoving, editStart, editedBox, resizeHandle, getRelativeCoordinates]);

  const handleEditEnd = useCallback(async () => {
    if ((!isResizing && !isMoving) || !selectedBox || !editedBox || !step) {
      setIsResizing(false);
      setIsMoving(false);
      setResizeHandle(null);
      setEditStart(null);
      return;
    }

    // Transform coordinates from crop space back to original space if crop is active
    // editedBox is in display (crop) space, but we need to save in original space
    let savedBox = [...editedBox];
    if (step.cropCoordinates && !isNoCrop(step.cropCoordinates)) {
      const boxCoords = boxArrayToCoords(editedBox);
      const originalCoords = transformBoxToOriginalSpace(boxCoords, step.cropCoordinates);
      savedBox = coordsToBoxArray(originalCoords);
    }
    const savedSelectedBox = selectedBox;

    // Set optimistic state BEFORE clearing editing state
    // This keeps the box visible at the new position while we wait for server
    // Note: optimistic state should be in ORIGINAL space (will be transformed for display by getBoxCoords)
    if (savedSelectedBox.type === "ui") {
      setOptimisticUiBox(savedBox);
    } else if (savedSelectedBox.type === "sensitive") {
      setOptimisticSensitiveBoxes(prev => {
        const newMap = new Map(prev);
        newMap.set(savedSelectedBox.index, savedBox);
        return newMap;
      });
    }

    // Clear editing state immediately - box will now render from optimistic state
    setIsResizing(false);
    setIsMoving(false);
    setResizeHandle(null);
    setEditStart(null);
    setEditedBox(null);

    // Fire mutation in background (don't block UI)
    try {
      if (savedSelectedBox.type === "ui" && step.boundingBox) {
        updateBoundingBox({
          stepId: step._id as Id<"steps">,
          boundingBox: {
            label: step.boundingBox.label,
            box_2d: savedBox,
            found: true,
            masked: step.boundingBox.masked,
          },
        });
      } else if (savedSelectedBox.type === "sensitive") {
        updateSensitiveBox({
          stepId: step._id as Id<"steps">,
          boxIndex: savedSelectedBox.index,
          box_2d: savedBox,
        });
      }
    } catch (error) {
      console.error("Failed to update box:", error);
      // On error, clear optimistic state to revert to server state
      if (savedSelectedBox.type === "ui") {
        setOptimisticUiBox(null);
      } else if (savedSelectedBox.type === "sensitive") {
        setOptimisticSensitiveBoxes(prev => {
          const newMap = new Map(prev);
          newMap.delete(savedSelectedBox.index);
          return newMap;
        });
      }
    }
  }, [isResizing, isMoving, selectedBox, editedBox, step, updateBoundingBox, updateSensitiveBox]);

  // Save label
  const handleSaveLabel = useCallback(async () => {
    if (!editingLabel || !newLabel.trim() || !step) return;

    setIsSaving(true);
    try {
      if (editingLabel.type === "ui" && step.boundingBox) {
        await updateBoundingBox({
          stepId: step._id as Id<"steps">,
          boundingBox: {
            ...step.boundingBox,
            label: newLabel.trim(),
          },
        });
      } else if (editingLabel.type === "sensitive" && step.sensitiveInfoBoxes) {
        await updateSensitiveBoxLabel({
          stepId: step._id as Id<"steps">,
          boxIndex: editingLabel.index,
          label: newLabel.trim(),
        });
      }
    } catch (error) {
      console.error("Failed to update label:", error);
    }

    setEditingLabel(null);
    setNewLabel("");
    setIsSaving(false);
  }, [editingLabel, newLabel, step, updateBoundingBox, updateSensitiveBoxLabel]);

  // Update UI element handler for StepDetail
  const handleUpdateUiElement = useCallback(async (uiElement: {
    elementName: string;
    elementType: string;
    locationDescription: string;
    screenRegion: string;
    parentElement?: string;
    identifiers?: {
      id?: string;
      className?: string;
      xpath?: string;
      accessibilityId?: string;
    };
  }) => {
    if (!step) return;
    await updateUiElementMutation({
      stepId: step._id as Id<"steps">,
      uiElement,
    });
  }, [step, updateUiElementMutation]);

  // Get current box coordinates (considering edit in progress or optimistic update)
  // Returns coordinates in DISPLAY space (crop space if crop is active, original space otherwise)
  const getBoxCoords = useCallback((boxType: SelectedBox, originalBox: number[]): number[] | null => {
    // Priority 1: Active editing (drag/resize in progress)
    // editedBox is already in display/crop space, so return directly without transformation
    if ((isResizing || isMoving) && selectedBox && editedBox) {
      const isMatchingBox = boxType.type === selectedBox.type &&
        (boxType.type === "ui" || (boxType.type === "sensitive" && selectedBox.type === "sensitive" && boxType.index === selectedBox.index));
      if (isMatchingBox) {
        return editedBox; // Already in crop/display space, no transformation needed
      }
    }

    // For non-editing cases, start with original box coordinates
    let coords = originalBox;

    // Priority 2: Optimistic update (saved but waiting for server confirmation)
    // Optimistic state is in ORIGINAL space
    if (boxType.type === "ui" && optimisticUiBox) {
      coords = optimisticUiBox;
    } else if (boxType.type === "sensitive") {
      const optimisticBox = optimisticSensitiveBoxes.get(boxType.index);
      if (optimisticBox) {
        coords = optimisticBox;
      }
    }

    // Priority 3: Apply crop transformation if crop is active
    // Transform from original space to crop/display space
    if (step?.cropCoordinates && !isNoCrop(step.cropCoordinates)) {
      const boxCoords = boxArrayToCoords(coords);
      const transformed = transformBoxToCroppedSpace(boxCoords, step.cropCoordinates);
      if (!transformed) {
        return null; // Box is outside crop region
      }
      return coordsToBoxArray(transformed);
    }

    return coords;
  }, [isResizing, isMoving, selectedBox, editedBox, optimisticUiBox, optimisticSensitiveBoxes, step?.cropCoordinates]);

  // Render resize handles for a box
  // Note: displayCoords should already be in display space (from getBoxCoords call in parent)
  const renderResizeHandles = useCallback((boxType: SelectedBox, displayCoords: number[]) => {
    if (!displayCoords) return null;
    const [ymin, xmin, ymax, xmax] = displayCoords;
    const isUi = boxType.type === "ui";
    const handleColor = isUi ? "#22c55e" : "#dc2626";

    const handles: { pos: ResizeHandle; style: React.CSSProperties }[] = [
      { pos: "nw", style: { left: "0%", top: "0%", cursor: "nw-resize", transform: "translate(-50%, -50%)" } },
      { pos: "ne", style: { left: "100%", top: "0%", cursor: "ne-resize", transform: "translate(-50%, -50%)" } },
      { pos: "sw", style: { left: "0%", top: "100%", cursor: "sw-resize", transform: "translate(-50%, -50%)" } },
      { pos: "se", style: { left: "100%", top: "100%", cursor: "se-resize", transform: "translate(-50%, -50%)" } },
      { pos: "n", style: { left: "50%", top: "0%", cursor: "n-resize", transform: "translate(-50%, -50%)" } },
      { pos: "s", style: { left: "50%", top: "100%", cursor: "s-resize", transform: "translate(-50%, -50%)" } },
      { pos: "w", style: { left: "0%", top: "50%", cursor: "w-resize", transform: "translate(-50%, -50%)" } },
      { pos: "e", style: { left: "100%", top: "50%", cursor: "e-resize", transform: "translate(-50%, -50%)" } },
    ];

    return handles.map(({ pos, style }) => (
      <div
        key={pos}
        className="absolute w-3 h-3 rounded-full border-2 bg-white z-50 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          ...style,
          borderColor: handleColor,
        }}
        onMouseDown={(e) => handleResizeStart(e, pos, boxType, displayCoords)}
      />
    ));
  }, [handleResizeStart]);

  // Detection handlers
  const handleDetectUi = useCallback(async () => {
    if (!step?.screenshotUrl || !step?.uiElement) return;

    setIsDetectingUi(true);
    setDetectError(null);
    try {
      const result = await detectAndOverlay({
        stepId: step._id as Id<"steps">,
        customPrompt: detectUiPrompt.trim() || undefined,
      });
      if (!result.success) {
        setDetectError(result.error || "Detection failed");
      } else {
        setShowDetectUiDialog(false);
      }
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : "Detection failed");
    } finally {
      setIsDetectingUi(false);
    }
  }, [step, detectAndOverlay, detectUiPrompt]);

  const handleDetectSensitive = useCallback(async () => {
    if (!step?.screenshotUrl || !detectSensitivePrompt.trim()) return;

    setIsDetectingSensitive(true);
    setDetectError(null);
    try {
      const result = await detectSensitive({
        stepId: step._id as Id<"steps">,
        customPrompt: detectSensitivePrompt.trim(),
      });
      if (!result.success) {
        setDetectError(result.error || "Detection failed");
      } else {
        setShowDetectSensitiveDialog(false);
      }
    } catch (error) {
      setDetectError(error instanceof Error ? error.message : "Detection failed");
    } finally {
      setIsDetectingSensitive(false);
    }
  }, [step, detectSensitive, detectSensitivePrompt]);

  // Screenshot file upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !step) return;

    setIsUploadingScreenshot(true);
    setShowScreenshotMenu(false);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await updateStepScreenshot({
        stepId: step._id as Id<"steps">,
        screenshotStorageId: storageId,
      });
      // Clear crop when screenshot is replaced
      await updateStepCrop({
        stepId: step._id as Id<"steps">,
        cropCoordinates: null,
      });
      onScreenshotUpdated?.();
    } catch (error) {
      console.error("Failed to upload screenshot:", error);
    } finally {
      setIsUploadingScreenshot(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [step, generateUploadUrl, updateStepScreenshot, updateStepCrop, onScreenshotUpdated]);

  // Video capture handler
  const handleVideoCapture = useCallback(async (storageId: string) => {
    if (!step) return;
    try {
      await updateStepScreenshot({
        stepId: step._id as Id<"steps">,
        screenshotStorageId: storageId as Id<"_storage">,
      });
      // Clear crop when screenshot is replaced
      await updateStepCrop({
        stepId: step._id as Id<"steps">,
        cropCoordinates: null,
      });
      onScreenshotUpdated?.();
    } catch (error) {
      console.error("Failed to update screenshot from video:", error);
    }
  }, [step, updateStepScreenshot, updateStepCrop, onScreenshotUpdated]);

  // Crop apply handler
  const handleCropApply = useCallback(async (crop: CropCoordinates) => {
    if (!step) return;
    try {
      await updateStepCrop({
        stepId: step._id as Id<"steps">,
        cropCoordinates: crop,
      });
      setIsCropping(false);
      onScreenshotUpdated?.();
    } catch (error) {
      console.error("Failed to apply crop:", error);
    }
  }, [step, updateStepCrop, onScreenshotUpdated]);

  // Reset crop handler
  const handleResetCrop = useCallback(async () => {
    if (!step) return;
    try {
      await updateStepCrop({
        stepId: step._id as Id<"steps">,
        cropCoordinates: null,
      });
      onScreenshotUpdated?.();
    } catch (error) {
      console.error("Failed to reset crop:", error);
    }
  }, [step, updateStepCrop, onScreenshotUpdated]);

  // Revert to original screenshot from video
  const handleRevertToOriginal = useCallback(async () => {
    if (!step || !videoInfo?.videoUrl || step.timestampSeconds === undefined) return;

    setIsReverting(true);
    setShowScreenshotMenu(false);

    try {
      // Create a temporary video element to capture the frame
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoInfo.videoUrl;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.currentTime = step.timestampSeconds!;
        };
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Failed to load video"));
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      // Wait a bit for the frame to render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create canvas and capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.9
        );
      });

      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) throw new Error("Failed to upload screenshot");

      const { storageId } = await response.json();

      // Update the step
      await updateStepScreenshot({
        stepId: step._id as Id<"steps">,
        screenshotStorageId: storageId,
      });

      // Clear crop
      await updateStepCrop({
        stepId: step._id as Id<"steps">,
        cropCoordinates: null,
      });

      // Cleanup
      video.remove();
      canvas.remove();

      onScreenshotUpdated?.();
    } catch (error) {
      console.error("Failed to revert screenshot:", error);
    } finally {
      setIsReverting(false);
    }
  }, [step, videoInfo, generateUploadUrl, updateStepScreenshot, updateStepCrop, onScreenshotUpdated]);

  // Calculate drawing preview box
  const drawingPreviewStyle = isDrawing && drawStart && drawCurrent ? {
    left: `${Math.min(drawStart.x, drawCurrent.x) / 10}%`,
    top: `${Math.min(drawStart.y, drawCurrent.y) / 10}%`,
    width: `${Math.abs(drawCurrent.x - drawStart.x) / 10}%`,
    height: `${Math.abs(drawCurrent.y - drawStart.y) / 10}%`,
  } : null;

  const hasDetails = step?.uiElement || step?.dataInfo || step?.waitCondition || step?.notes || step?.automationHint;
  const canShowElement = step?.boundingBox?.found && step?.screenshotUrl && !step?.boundingBox?.masked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col"
        style={{
          maxWidth: "95vw",
          width: "auto",
          maxHeight: "95vh",
        }}
      >
        <VisuallyHidden>
          <DialogTitle>Screenshot for step {step?.stepNumber}</DialogTitle>
        </VisuallyHidden>
        {step && step.screenshotUrl && (
          <>
            {/* Main content area */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-0">
              <div
                ref={imageContainerRef}
                className={`relative ${drawingMode !== "none" ? "cursor-crosshair" : ""} ${isResizing || isMoving ? "cursor-grabbing" : ""}`}
                style={{ display: "inline-block" }}
                onMouseDown={(e) => {
                  // Deselect box if clicking on the container (not on a box)
                  if (drawingMode === "none" && !isResizing && !isMoving && e.target === e.currentTarget) {
                    setSelectedBox(null);
                  }
                  handleDrawStart(e);
                }}
                onMouseMove={(e) => {
                  handleDrawMove(e);
                  handleEditMove(e);
                }}
                onMouseUp={() => {
                  if (isDrawing) handleDrawEnd();
                  if (isResizing || isMoving) handleEditEnd();
                }}
                onMouseLeave={() => {
                  if (isDrawing) handleDrawEnd();
                  if (isResizing || isMoving) handleEditEnd();
                }}
              >
                {/* Image with optional crop styling */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    maxHeight: "70vh",
                    maxWidth: "85vw",
                  }}
                >
                  <img
                    src={step.screenshotUrl}
                    alt={`Screenshot for step ${step.stepNumber}`}
                    style={{
                      display: "block",
                      maxHeight: step.cropCoordinates && !isNoCrop(step.cropCoordinates) ? undefined : "70vh",
                      maxWidth: step.cropCoordinates && !isNoCrop(step.cropCoordinates) ? undefined : "85vw",
                      height: "auto",
                      width: "auto",
                      pointerEvents: drawingMode !== "none" ? "none" : "auto",
                      ...getCropImageStyle(step.cropCoordinates),
                    }}
                  />
                </div>
                {/* Crop indicator badge */}
                {step.cropCoordinates && !isNoCrop(step.cropCoordinates) && (
                  <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full z-30 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                    </svg>
                    Cropped
                  </div>
                )}
                {/* Loading overlay for upload/revert operations */}
                {(isUploadingScreenshot || isReverting) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-white text-sm font-medium">
                        {isReverting ? "Reverting to original..." : "Uploading screenshot..."}
                      </span>
                    </div>
                  </div>
                )}
                {/* Sensitive information boxes (z-index 10, rendered in back) */}
                {step.sensitiveInfoBoxes && step.sensitiveInfoBoxes.length > 0 && (
                  <>
                    {step.sensitiveInfoBoxes.map((box, idx) => {
                      if (!box.box_2d || box.box_2d.length !== 4 || !box.found) {
                        return null;
                      }
                      const boxType: SelectedBox = { type: "sensitive", index: idx, id: box.id };
                      const coords = getBoxCoords(boxType, box.box_2d);
                      if (!coords) return null; // Box is outside crop region
                      const [ymin, xmin, ymax, xmax] = coords;
                      const isBeingEdited = (isMoving || isResizing) && selectedBox?.type === "sensitive" && selectedBox.index === idx;
                      return (
                        <div
                          key={`sensitive-${idx}`}
                          className={`absolute group ${drawingMode === "none" ? "cursor-move" : ""}`}
                          style={{
                            left: `${(xmin / 1000) * 100}%`,
                            top: `${(ymin / 1000) * 100}%`,
                            width: `${((xmax - xmin) / 1000) * 100}%`,
                            height: `${((ymax - ymin) / 1000) * 100}%`,
                            border: isBeingEdited ? "3px solid #991b1b" : "3px solid #dc2626",
                            backgroundColor: "#dc2626",
                            zIndex: isBeingEdited ? 25 : 10,
                            pointerEvents: drawingMode === "none" ? "auto" : "none",
                          }}
                          onMouseDown={(e) => {
                            if (drawingMode === "none" && !isResizing && !isMoving) {
                              handleMoveStart(e, boxType, coords);
                            }
                          }}
                        >
                          <div
                            className="absolute left-0 px-2 py-1 text-xs font-medium text-white whitespace-nowrap bg-red-600 flex items-center gap-1"
                            style={{
                              top: "-1.5rem",
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {editingLabel?.type === "sensitive" && editingLabel.index === idx ? (
                              <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onBlur={() => {
                                  if (newLabel.trim()) handleSaveLabel();
                                  else { setEditingLabel(null); setNewLabel(""); }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && newLabel.trim()) handleSaveLabel();
                                  else if (e.key === "Escape") { setEditingLabel(null); setNewLabel(""); }
                                }}
                                className="bg-red-700 text-white text-xs px-1 py-0 border-none outline-none w-24 rounded"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLabel(boxType);
                                  setNewLabel(box.label);
                                }}
                                title="Click to edit label"
                              >
                                {box.label}
                              </span>
                            )}
                            {box.confidence !== undefined && (
                              <span className="opacity-75">
                                ({Math.round(box.confidence * 100)}%)
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSensitiveBox(idx, box.id);
                              }}
                              className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-red-700 rounded px-1 transition-opacity"
                              title="Delete this sensitive box"
                            >
                              ×
                            </button>
                          </div>
                          {/* Resize handles - show on hover */}
                          {drawingMode === "none" && renderResizeHandles(boxType, coords)}
                        </div>
                      );
                    })}
                  </>
                )}
                {/* UI Element bounding box (z-index 20, rendered in front) */}
                {step.boundingBox?.found && (() => {
                  const uiBoxType: SelectedBox = { type: "ui" };
                  const uiCoords = getBoxCoords(uiBoxType, step.boundingBox!.box_2d);
                  if (!uiCoords) return null; // Box is outside crop region
                  const [uiYmin, uiXmin, uiYmax, uiXmax] = uiCoords;
                  const isBeingEdited = (isMoving || isResizing) && selectedBox?.type === "ui";
                  const canDrag = drawingMode === "none" && !step.boundingBox!.masked;
                  return (
                    <div
                      className={`absolute group ${canDrag ? "cursor-move" : ""}`}
                      style={{
                        left: `${(uiXmin / 1000) * 100}%`,
                        top: `${(uiYmin / 1000) * 100}%`,
                        width: `${((uiXmax - uiXmin) / 1000) * 100}%`,
                        height: `${((uiYmax - uiYmin) / 1000) * 100}%`,
                        border: step.boundingBox!.masked
                          ? "3px solid #dc2626"
                          : isBeingEdited
                            ? "3px solid #15803d"
                            : "3px solid #22c55e",
                        backgroundColor: step.boundingBox!.masked ? "#dc2626" : "rgba(34, 197, 94, 0.1)",
                        backdropFilter: step.boundingBox!.masked ? "blur(8px)" : "none",
                        zIndex: isBeingEdited ? 30 : 20,
                        pointerEvents: drawingMode === "none" ? "auto" : "none",
                      }}
                      onMouseDown={(e) => {
                        if (canDrag && !isResizing && !isMoving) {
                          handleMoveStart(e, uiBoxType, uiCoords);
                        }
                      }}
                    >
                      <div
                        className="absolute left-0 px-2 py-1 text-xs font-medium text-white whitespace-nowrap flex items-center gap-1"
                        style={{
                          backgroundColor: step.boundingBox!.masked ? "#dc2626" : "#22c55e",
                          top: "-1.5rem",
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {editingLabel?.type === "ui" ? (
                          <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            onBlur={() => {
                              if (newLabel.trim()) handleSaveLabel();
                              else { setEditingLabel(null); setNewLabel(""); }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newLabel.trim()) handleSaveLabel();
                              else if (e.key === "Escape") { setEditingLabel(null); setNewLabel(""); }
                            }}
                            className="bg-green-700 text-white text-xs px-1 py-0 border-none outline-none w-24 rounded"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel(uiBoxType);
                              setNewLabel(step.boundingBox!.label);
                            }}
                            title="Click to edit label"
                          >
                            {step.uiElement?.elementName || step.boundingBox!.label}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearUiBox();
                          }}
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-green-700 rounded px-1 transition-opacity"
                          title="Delete this bounding box"
                        >
                          ×
                        </button>
                      </div>
                      {/* Resize handles - show on hover when editable */}
                      {canDrag && renderResizeHandles(uiBoxType, uiCoords)}
                    </div>
                  );
                })()}
                {/* Drawing preview */}
                {drawingPreviewStyle && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      ...drawingPreviewStyle,
                      border: drawingMode === "ui-element" ? "3px dashed #22c55e" : "3px dashed #dc2626",
                      backgroundColor: drawingMode === "ui-element" ? "rgba(34, 197, 94, 0.2)" : "rgba(220, 38, 38, 0.2)",
                      zIndex: 50,
                    }}
                  />
                )}
                {/* Draggable cropped element preview */}
                {showElement && canShowElement && (() => {
                  const pos = elementPosition || getOppositeCorner(step.boundingBox);
                  const bb = step.boundingBox!;
                  const centerX = (bb.box_2d[1] + bb.box_2d[3]) / 2 / 10;
                  const centerY = (bb.box_2d[0] + bb.box_2d[2]) / 2 / 10;
                  const boxWidth = (bb.box_2d[3] - bb.box_2d[1]) / 10;
                  const boxHeight = (bb.box_2d[2] - bb.box_2d[0]) / 10;
                  const zoomFactor = Math.min(120 / boxWidth, 120 / boxHeight, 12);
                  const elementName = step.uiElement?.elementName || bb.label;
                  return (
                    <div
                      ref={elementRef}
                      onMouseDown={handleDragStart}
                      className={`absolute z-20 bg-white rounded-lg shadow-2xl border-2 border-blue-500 overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        userSelect: "none",
                      }}
                    >
                      <div className="bg-blue-500 text-white text-xs px-2 py-1 flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                          <circle cx="9" cy="5" r="1" fill="currentColor" />
                          <circle cx="9" cy="12" r="1" fill="currentColor" />
                          <circle cx="9" cy="19" r="1" fill="currentColor" />
                          <circle cx="15" cy="5" r="1" fill="currentColor" />
                          <circle cx="15" cy="12" r="1" fill="currentColor" />
                          <circle cx="15" cy="19" r="1" fill="currentColor" />
                        </svg>
                        <span className="truncate">{elementName}</span>
                      </div>
                      <div
                        className="overflow-hidden relative"
                        style={{ width: "250px", height: "120px" }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: "100%",
                            transform: `translate(-${centerX}%, -${centerY}%) scale(${zoomFactor})`,
                            transformOrigin: `${centerX}% ${centerY}%`,
                            pointerEvents: "none",
                          }}
                        >
                          <img
                            src={step.screenshotUrl!}
                            alt={`Cropped element: ${elementName}`}
                            draggable={false}
                            style={{ display: "block", width: "100%" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Bottom bar */}
            <div className="flex-shrink-0 border-t bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-4">
                {/* Prev button */}
                {onPrev && (
                  <button
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-background border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="text-sm">Prev</span>
                  </button>
                )}
                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                      {step.stepNumber}
                    </span>
                    {step.timestamp && (
                      <span className="text-xs text-muted-foreground font-mono">{step.timestamp}</span>
                    )}
                    {step.actionType && (
                      <ActionTypeBadge actionType={step.actionType} specificAction={step.specificAction || ""} />
                    )}
                    {/* Show element button */}
                    {canShowElement && (
                      <button
                        onClick={() => setShowElement(!showElement)}
                        className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${showElement
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {showElement ? "Hide element" : "Show element"}
                      </button>
                    )}
                    {/* Detect UI button with popover */}
                    {step.uiElement && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (showDetectUiDialog) {
                              // Second click - close popover and trigger detection
                              setShowDetectUiDialog(false);
                              handleDetectUi();
                            } else if (!isDetectingUi) {
                              // First click - open popover, close other
                              setShowDetectSensitiveDialog(false);
                              setShowDetectUiDialog(true);
                              setDetectError(null);
                            }
                          }}
                          disabled={isDetectingUi}
                          className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${isDetectingUi
                            ? "bg-green-400 text-white cursor-wait"
                            : showDetectUiDialog
                              ? "bg-green-600 text-white"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          title={step.boundingBox?.found ? "Re-detect UI element bounding box" : "Detect UI element bounding box"}
                        >
                          {isDetectingUi ? (
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.35-4.35" />
                            </svg>
                          )}
                          {isDetectingUi ? "Detecting..." : showDetectUiDialog ? "Detect" : step.boundingBox?.found ? "Re-detect" : "Detect"}
                        </button>
                        {/* Inline popover */}
                        {showDetectUiDialog && !isDetectingUi && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border p-3 z-50">
                            <div className="text-xs text-gray-600 mb-2">
                              Looking for: <strong>{step.uiElement?.elementName || "UI Element"}</strong>
                            </div>
                            <textarea
                              value={detectUiPrompt}
                              onChange={(e) => setDetectUiPrompt(e.target.value)}
                              placeholder="Custom description (optional)..."
                              className="w-full px-2 py-1.5 border rounded text-xs min-h-12 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
                            />
                            {detectError && (
                              <div className="mt-1 text-xs text-red-600">{detectError}</div>
                            )}
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => { setShowDetectUiDialog(false); setDetectError(null); }}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Detect Sensitive button with popover */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (showDetectSensitiveDialog) {
                            // Second click - close popover and trigger detection
                            if (detectSensitivePrompt.trim()) {
                              setShowDetectSensitiveDialog(false);
                              handleDetectSensitive();
                            }
                          } else if (!isDetectingSensitive) {
                            // First click - open popover, close other
                            setShowDetectUiDialog(false);
                            setShowDetectSensitiveDialog(true);
                            setDetectError(null);
                          }
                        }}
                        disabled={isDetectingSensitive || (showDetectSensitiveDialog && !detectSensitivePrompt.trim())}
                        className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${isDetectingSensitive
                          ? "bg-red-400 text-white cursor-wait"
                          : showDetectSensitiveDialog
                            ? "bg-red-600 text-white disabled:bg-red-400"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        title={step.sensitiveInfoBoxes?.length ? "Re-detect sensitive information" : "Detect sensitive information"}
                      >
                        {isDetectingSensitive ? (
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <circle cx="11" cy="11" r="4" />
                            <path d="m15 15-2-2" />
                          </svg>
                        )}
                        {isDetectingSensitive ? "Detecting..." : showDetectSensitiveDialog ? "Detect" : step.sensitiveInfoBoxes?.length ? "Re-detect Sensitive" : "Detect Sensitive"}
                      </button>
                      {/* Inline popover */}
                      {showDetectSensitiveDialog && !isDetectingSensitive && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border p-3 z-50">
                          <div className="text-xs text-gray-600 mb-2">
                            Define what sensitive info to detect:
                          </div>
                          <textarea
                            value={detectSensitivePrompt}
                            onChange={(e) => setDetectSensitivePrompt(e.target.value)}
                            placeholder="SSN, credit cards, passwords..."
                            className="w-full px-2 py-1.5 border rounded text-xs min-h-14 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                          />
                          {detectError && (
                            <div className="mt-1 text-xs text-red-600">{detectError}</div>
                          )}
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => { setShowDetectSensitiveDialog(false); setDetectError(null); }}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Draw UI Element button */}
                    <button
                      onClick={() => setDrawingMode(drawingMode === "ui-element" ? "none" : "ui-element")}
                      className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${drawingMode === "ui-element"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      title="Draw UI element bounding box"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {drawingMode === "ui-element" ? "Cancel" : "Draw UI Box"}
                    </button>
                    {/* Draw Sensitive button */}
                    <button
                      onClick={() => setDrawingMode(drawingMode === "sensitive" ? "none" : "sensitive")}
                      className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${drawingMode === "sensitive"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      title="Draw sensitive information bounding box"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      {drawingMode === "sensitive" ? "Cancel" : "Draw Sensitive"}
                    </button>
                    {/* Edit Screenshot dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowScreenshotMenu(!showScreenshotMenu)}
                        disabled={isUploadingScreenshot || isReverting}
                        className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${showScreenshotMenu
                          ? "bg-gray-600 text-white"
                          : (isUploadingScreenshot || isReverting)
                            ? "bg-gray-300 text-gray-500 cursor-wait"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        {(isUploadingScreenshot || isReverting) ? (
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        )}
                        {isUploadingScreenshot ? "Uploading..." : isReverting ? "Reverting..." : "Edit Screenshot"}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {/* Screenshot menu dropdown */}
                      {showScreenshotMenu && (
                        <div className="absolute bottom-full left-0 mb-1 bg-white border rounded-lg shadow-xl py-1 min-w-[180px] z-50">
                          <button
                            onClick={() => {
                              fileInputRef.current?.click();
                              setShowScreenshotMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload new image
                          </button>
                          {processId && (
                            <button
                              onClick={() => {
                                setShowCloneDialog(true);
                                setShowScreenshotMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              Clone from step
                            </button>
                          )}
                          {videoInfo?.videoUrl && (
                            <button
                              onClick={() => {
                                setShowVideoCaptureModal(true);
                                setShowScreenshotMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                              </svg>
                              Capture from video
                            </button>
                          )}
                          <div className="border-t my-1" />
                          <button
                            onClick={() => {
                              setIsCropping(true);
                              setShowScreenshotMenu(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                            </svg>
                            Crop image
                          </button>
                          {step.cropCoordinates && !isNoCrop(step.cropCoordinates) && (
                            <button
                              onClick={() => {
                                handleResetCrop();
                                setShowScreenshotMenu(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-orange-600"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                              Reset crop
                            </button>
                          )}
                          {videoInfo?.videoUrl && step.timestampSeconds !== undefined && (
                            <>
                              <div className="border-t my-1" />
                              <button
                                onClick={handleRevertToOriginal}
                                disabled={isReverting}
                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-blue-600 disabled:text-gray-400 disabled:cursor-wait"
                              >
                                {isReverting ? (
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                  </svg>
                                )}
                                {isReverting ? "Reverting..." : "Revert to original"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <p className="text-sm font-medium truncate">{step.description}</p>
                </div>
                {/* UI details toggle */}
                {hasDetails && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors ${showDetails
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                      }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    <span className="text-sm">{showDetails ? "Hide UI details" : "Show UI details"}</span>
                  </button>
                )}
                {/* Next button */}
                {onNext && (
                  <button
                    onClick={onNext}
                    disabled={!hasNext}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-background border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="text-sm">Next</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Expandable details */}
              {showDetails && hasDetails && (
                <div className="mt-3 pt-3 border-t">
                  <StepDetail
                    uiElement={step.uiElement}
                    dataInfo={step.dataInfo}
                    waitCondition={step.waitCondition}
                    notes={step.notes}
                    automationHint={step.automationHint}
                    onUpdateUiElement={handleUpdateUiElement}
                  />
                </div>
              )}
            </div>
            {/* Label input dialog */}
            {showLabelDialog && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 w-80">
                  <h3 className="text-lg font-semibold mb-4">
                    {drawingMode === "ui-element" ? "Name UI Element" : "Name Sensitive Area"}
                  </h3>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder={drawingMode === "ui-element" ? "e.g., Login Button" : "e.g., Email Address"}
                    className="w-full px-3 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && labelInput.trim()) {
                        handleSaveBox();
                      } else if (e.key === "Escape") {
                        handleCancelDraw();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelDraw}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBox}
                      disabled={!labelInput.trim()}
                      className={`px-4 py-2 text-sm text-white rounded-md transition-colors ${drawingMode === "ui-element"
                        ? "bg-green-600 hover:bg-green-700 disabled:bg-green-300"
                        : "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                        }`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Crop overlay */}
            {isCropping && imageContainerRef.current && (
              <div className="absolute inset-0 z-50">
                <CropOverlay
                  initialCrop={step.cropCoordinates || undefined}
                  containerWidth={imageContainerRef.current.clientWidth}
                  containerHeight={imageContainerRef.current.clientHeight}
                  onApply={handleCropApply}
                  onCancel={() => setIsCropping(false)}
                />
              </div>
            )}
            {/* Clone Screenshot Dialog */}
            {processId && (
              <CloneScreenshotDialog
                open={showCloneDialog}
                onOpenChange={setShowCloneDialog}
                processId={processId}
                targetStepId={step._id}
                currentStepNumber={step.stepNumber}
                onCloned={() => {
                  onScreenshotUpdated?.();
                }}
              />
            )}
            {/* Video Capture Modal */}
            {videoInfo?.videoUrl && (
              <VideoCaptureModal
                open={showVideoCaptureModal}
                onOpenChange={setShowVideoCaptureModal}
                videoUrl={videoInfo.videoUrl}
                duration={videoInfo.recordingDurationSeconds || 0}
                initialTime={step.timestampSeconds}
                onCapture={handleVideoCapture}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
