"use client";

import { useState, useEffect, useRef } from "react";
import { Rnd } from "react-rnd";

interface EditableBoxProps {
  box: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  label: string;
  type: "ui" | "sensitive";
  isEditing: boolean; // If true, enables resize/drag handles
  masked?: boolean; // For UI elements
  confidence?: number; // For sensitive elements
  containerRef: React.RefObject<HTMLDivElement>;
  
  // Actions
  onEditStart: () => void;
  onSave: (newBox: number[]) => void;
  onDelete?: () => void;
  onLabelClick?: () => void;
  onCancel?: () => void; // Called when clicking outside/saving
}

export function EditableBox({
  box,
  label,
  type,
  isEditing,
  masked,
  confidence,
  containerRef,
  onEditStart,
  onSave,
  onDelete,
  onLabelClick,
  onCancel
}: EditableBoxProps) {
  // Convert 0-1000 coordinates to percentages for display
  // box is [ymin, xmin, ymax, xmax]
  const [ymin, xmin, ymax, xmax] = box;
  
  // Rnd uses pixels primarily for internal logic, but we can initialize with %
  // However, for smooth "controlled" behavior without layout thrashing, 
  // we let Rnd manage its own state while dragging, and only sync on stop.
  
  // We need to calculate initial pixel values based on container size for Rnd to be happy
  // or use percentage strings. Rnd supports percentage strings in `default`.
  
  const initialX = xmin / 10;
  const initialY = ymin / 10;
  const initialWidth = (xmax - xmin) / 10;
  const initialHeight = (ymax - ymin) / 10;

  // Track the current box state internally to avoid parent re-renders during drag
  // This is the "Draft" state strategy
  const [currentBox, setCurrentBox] = useState(box);

  // Sync internal state if prop changes (and we aren't dragging)
  useEffect(() => {
    if (!isEditing) {
      setCurrentBox(box);
    }
  }, [box, isEditing]);

  const borderColor = type === "ui" 
    ? (masked ? "#dc2626" : (isEditing ? "#15803d" : "#22c55e"))
    : (isEditing ? "#991b1b" : "#dc2626");
    
  const bgColor = type === "ui"
    ? (masked ? "#dc2626" : "rgba(34, 197, 94, 0.1)")
    : "#dc2626";

  const labelBg = type === "ui"
    ? (masked ? "#dc2626" : "#22c55e")
    : "#dc2626";

  // Helper to convert Rnd result back to 0-1000 normalized coords
  const handleDragStop = (d: any) => {
    if (!containerRef.current) return;
    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();
    
    // d.x and d.y are relative to parent
    const newX = (d.x / containerW) * 1000;
    const newY = (d.y / containerH) * 1000;
    
    // Width/Height shouldn't change on drag, but let's be safe and recalc from currentBox
    const currentW = currentBox[3] - currentBox[1];
    const currentH = currentBox[2] - currentBox[0];
    
    const newBox = [
      newY, 
      newX, 
      newY + currentH, 
      newX + currentW
    ];
    
    setCurrentBox(newBox);
    onSave(newBox);
  };

  const handleResizeStop = (ref: HTMLElement, position: { x: number, y: number }) => {
    if (!containerRef.current) return;
    const { width: containerW, height: containerH } = containerRef.current.getBoundingClientRect();
    
    // ref.style.width/height might be in px or %
    const wPx = ref.offsetWidth;
    const hPx = ref.offsetHeight;
    
    const newW = (wPx / containerW) * 1000;
    const newH = (hPx / containerH) * 1000;
    
    const newX = (position.x / containerW) * 1000;
    const newY = (position.y / containerH) * 1000;
    
    const newBox = [
      newY,
      newX,
      newY + newH,
      newX + newW
    ];
    
    setCurrentBox(newBox);
    onSave(newBox);
  };

  return (
    <Rnd
      size={{ width: `${initialWidth}%`, height: `${initialHeight}%` }}
      position={{ x: initialX * (containerRef.current?.offsetWidth || 0) / 100, y: initialY * (containerRef.current?.offsetHeight || 0) / 100 }}
      // Note: We are using a trick here. Rnd works best with pixels for x/y.
      // But we can also use `default` and let it be uncontrolled. 
      // However, if we want to support external updates (like undo/redo or initial load), we need to control it.
      // A better approach for this hybrid % based layout is to pass `position` and `size` 
      // but calculated in pixels based on the containerRef which we have.
      // If containerRef is null (first render), it might jump. 
      // Actually, Rnd supports % in `default` but `position` expects pixels if strictly controlled.
      // Let's try fully controlled with Pixel calculation to ensure smoothness.
      
      bounds="parent"
      disableDragging={!isEditing}
      enableResizing={isEditing ? { 
        top:true, right:true, bottom:true, left:true, 
        topRight:true, bottomRight:true, bottomLeft:true, topLeft:true 
      } : false}
      
      onDragStart={(e) => {
        e.stopPropagation();
        onEditStart();
      }}
      onDragStop={(e, d) => handleDragStop(d)}
      onResizeStart={(e) => {
        e.stopPropagation();
        onEditStart();
      }}
      onResizeStop={(e, direction, ref, delta, position) => handleResizeStop(ref, position)}
      
      // We need to update position when box changes externally
      // But wait, if we control position, Rnd internal drag state fights with React state updates if we are not careful.
      // The `react-rnd` documentation suggests using `size` and `position` props for controlled components.
      // We need to calculate these in pixels.
    >
      <div
        className="w-full h-full group relative"
        style={{
          border: `3px solid ${borderColor}`,
          backgroundColor: bgColor,
          backdropFilter: masked ? "blur(8px)" : "none",
        }}
        onClick={(e) => {
            e.stopPropagation();
            onEditStart();
        }}
      >
        {/* Label Tag */}
        <div
          className="absolute left-0 px-2 py-1 text-xs font-medium text-white whitespace-nowrap flex items-center gap-1 shadow-sm"
          style={{
            backgroundColor: labelBg,
            top: "-1.7rem",
            zIndex: 50,
            cursor: "pointer"
          }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on label click
          onClick={(e) => {
            e.stopPropagation();
            onLabelClick?.();
          }}
        >
          <span className="hover:underline" title="Click to edit label">
            {label}
          </span>
          {confidence !== undefined && (
            <span className="opacity-75">({Math.round(confidence * 100)}%)</span>
          )}
          {isEditing && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="ml-1 opacity-70 hover:opacity-100 hover:bg-black/20 rounded px-1 transition-opacity"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </Rnd>
  );
}
