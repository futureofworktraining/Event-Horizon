"use client";

import React from "react";

export interface SensitiveInfoBox {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: boolean;
  confidence?: number;
}

interface SensitiveInfoRendererProps {
  children: React.ReactNode; // The screenshot image
  sensitiveBoxes?: SensitiveInfoBox[] | null;
  className?: string;
}

/**
 * Renders sensitive information bounding boxes on top of a screenshot.
 * Sensitive boxes are rendered with red fill and red border.
 * Each box has a label badge showing the type of sensitive info.
 */
export function SensitiveInfoRenderer({
  children,
  sensitiveBoxes,
  className = "",
}: SensitiveInfoRendererProps) {
  if (!sensitiveBoxes || sensitiveBoxes.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className={`relative inline-block w-full ${className}`}>
      {children}

      {/* Render each sensitive box */}
      {sensitiveBoxes.map((box, idx) => {
        if (!box.box_2d || box.box_2d.length !== 4) {
          return null;
        }

        const [ymin, xmin, ymax, xmax] = box.box_2d;

        // Convert normalized 0-1000 coordinates to percentages
        const left = (xmin / 1000) * 100;
        const top = (ymin / 1000) * 100;
        const width = ((xmax - xmin) / 1000) * 100;
        const height = ((ymax - ymin) / 1000) * 100;

        return (
          <div
            key={`sensitive-${idx}`}
            className="absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              zIndex: 20,
              pointerEvents: "none",
            }}
          >
            {/* Red filled rectangle for sensitive data */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.85)",
                border: "3px solid #dc2626",
              }}
            />

            {/* Label badge showing type of sensitive info */}
            <div
              className="absolute -bottom-6 left-0 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              style={{
                pointerEvents: "auto",
              }}
            >
              {box.label}
              {box.confidence !== undefined && (
                <span className="ml-1 opacity-75">
                  ({Math.round(box.confidence * 100)}%)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
