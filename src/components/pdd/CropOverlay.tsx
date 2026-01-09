"use client";

import { useState, useEffect, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import {
  CropCoordinates,
  cropToPixels,
  pixelsToCrop,
  clampCrop,
} from "@/lib/cropUtils";

interface CropOverlayProps {
  initialCrop?: CropCoordinates;
  containerWidth: number;
  containerHeight: number;
  onApply: (crop: CropCoordinates) => void;
  onCancel: () => void;
}

export function CropOverlay({
  initialCrop,
  containerWidth,
  containerHeight,
  onApply,
  onCancel,
}: CropOverlayProps) {
  // Default to full image if no initial crop
  const defaultCrop: CropCoordinates = {
    x: 50,
    y: 50,
    width: 900,
    height: 900,
  };

  const [crop, setCrop] = useState<CropCoordinates>(initialCrop || defaultCrop);

  // Convert crop to pixel coordinates for display
  const pixelCrop = cropToPixels(crop, containerWidth, containerHeight);

  // Handle drag/resize end
  const handleDragStop = useCallback(
    (_e: unknown, d: { x: number; y: number }) => {
      const newCrop = pixelsToCrop(
        {
          x: d.x,
          y: d.y,
          width: pixelCrop.width,
          height: pixelCrop.height,
        },
        containerWidth,
        containerHeight
      );
      setCrop(clampCrop(newCrop));
    },
    [containerWidth, containerHeight, pixelCrop.width, pixelCrop.height]
  );

  const handleResizeStop = useCallback(
    (
      _e: unknown,
      _direction: unknown,
      ref: HTMLElement,
      _delta: unknown,
      position: { x: number; y: number }
    ) => {
      const newCrop = pixelsToCrop(
        {
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        },
        containerWidth,
        containerHeight
      );
      setCrop(clampCrop(newCrop));
    },
    [containerWidth, containerHeight]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onApply(crop);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onApply, crop]);

  // Reset to full image
  const handleReset = () => {
    setCrop({ x: 0, y: 0, width: 1000, height: 1000 });
  };

  return (
    <div className="absolute inset-0 z-50">
      {/* Dark overlay with cutout for crop area */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="cropMask">
            {/* White background (visible) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black rectangle for crop area (transparent/cut out) */}
            <rect
              x={pixelCrop.x}
              y={pixelCrop.y}
              width={pixelCrop.width}
              height={pixelCrop.height}
              fill="black"
            />
          </mask>
        </defs>
        {/* Semi-transparent overlay outside crop area */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#cropMask)"
        />
      </svg>

      {/* Resizable/draggable crop rectangle */}
      <Rnd
        size={{ width: pixelCrop.width, height: pixelCrop.height }}
        position={{ x: pixelCrop.x, y: pixelCrop.y }}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        bounds="parent"
        minWidth={20}
        minHeight={20}
        enableResizing={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true,
        }}
        resizeHandleStyles={{
          topLeft: { cursor: "nwse-resize" },
          topRight: { cursor: "nesw-resize" },
          bottomLeft: { cursor: "nesw-resize" },
          bottomRight: { cursor: "nwse-resize" },
          top: { cursor: "ns-resize" },
          bottom: { cursor: "ns-resize" },
          left: { cursor: "ew-resize" },
          right: { cursor: "ew-resize" },
        }}
        resizeHandleClasses={{
          topLeft: "crop-handle crop-handle-corner",
          topRight: "crop-handle crop-handle-corner",
          bottomLeft: "crop-handle crop-handle-corner",
          bottomRight: "crop-handle crop-handle-corner",
          top: "crop-handle crop-handle-edge",
          bottom: "crop-handle crop-handle-edge",
          left: "crop-handle crop-handle-edge",
          right: "crop-handle crop-handle-edge",
        }}
        className="cursor-move"
      >
        <div className="w-full h-full border-2 border-white shadow-lg relative">
          {/* Corner handles */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-gray-400 rounded-sm" />

          {/* Edge handles */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-6 bg-white border border-gray-400 rounded-sm" />
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-white border border-gray-400 rounded-sm" />

          {/* Rule of thirds grid */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Vertical lines */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/40" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/40" />
            {/* Horizontal lines */}
            <div className="absolute left-0 right-0 top-1/3 h-px bg-white/40" />
            <div className="absolute left-0 right-0 top-2/3 h-px bg-white/40" />
          </div>

          {/* Dimensions display */}
          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
            {Math.round(crop.width / 10)}% × {Math.round(crop.height / 10)}%
          </div>
        </div>
      </Rnd>

      {/* Control buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        <Button
          onClick={() => onApply(crop)}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Apply Crop
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="bg-white hover:bg-gray-100"
        >
          Cancel
        </Button>
        <Button
          onClick={handleReset}
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
        >
          Reset
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded">
        Drag to move • Drag corners/edges to resize • Enter to apply • Escape to
        cancel
      </div>
    </div>
  );
}
