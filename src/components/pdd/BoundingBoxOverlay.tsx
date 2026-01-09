"use client";

interface BoundingBox {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: boolean;
  masked: boolean; // If true, apply blur/mask effect
}

interface SensitiveInfoBox {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: boolean;
  confidence?: number;
}

interface BoundingBoxOverlayProps {
  imageUrl: string;
  boundingBox?: BoundingBox | null;
  sensitiveBoxes?: SensitiveInfoBox[] | null;
  alt: string;
  className?: string;
}

export function BoundingBoxOverlay({
  imageUrl,
  boundingBox,
  sensitiveBoxes,
  alt,
  className = "",
}: BoundingBoxOverlayProps) {
  const hasBoundingBox = boundingBox?.found && boundingBox?.box_2d?.length === 4;
  const isMasked = boundingBox?.masked;

  // Convert normalized coordinates (0-1000) to percentages
  const boxStyle = hasBoundingBox && boundingBox ? {
    left: `${(boundingBox.box_2d[1] / 1000) * 100}%`,
    top: `${(boundingBox.box_2d[0] / 1000) * 100}%`,
    width: `${((boundingBox.box_2d[3] - boundingBox.box_2d[1]) / 1000) * 100}%`,
    height: `${((boundingBox.box_2d[2] - boundingBox.box_2d[0]) / 1000) * 100}%`,
  } : null;

  return (
    <div
      className={`relative ${className}`}
      style={{ position: "relative" }}
    >
      {/* Image */}
      <img
        src={imageUrl}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover object-top"
      />

      {/* Sensitive information boxes (z-index 10, rendered in back) */}
      {sensitiveBoxes && sensitiveBoxes.length > 0 && (
        <>
          {sensitiveBoxes.map((box, idx) => {
            if (!box.box_2d || box.box_2d.length !== 4 || !box.found) {
              return null;
            }

            const [ymin, xmin, ymax, xmax] = box.box_2d;
            const left = (xmin / 1000) * 100;
            const top = (ymin / 1000) * 100;
            const width = ((xmax - xmin) / 1000) * 100;
            const height = ((ymax - ymin) / 1000) * 100;

            return (
              <div
                key={`sensitive-${idx}`}
                className="absolute pointer-events-none z-10"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  border: "3px solid #dc2626",
                  backgroundColor: "#dc2626",
                }}
              />
            );
          })}

          {/* Sensitive info labels */}
          {sensitiveBoxes.map((box, idx) => {
            if (!box.box_2d || box.box_2d.length !== 4 || !box.found) {
              return null;
            }

            const [ymin, xmin] = box.box_2d;
            const left = (xmin / 1000) * 100;
            const top = (ymin / 1000) * 100;

            return (
              <div
                key={`sensitive-label-${idx}`}
                className="absolute z-15 text-white text-[9px] px-1 py-0.5 rounded font-medium bg-red-600 pointer-events-none"
                style={{
                  left: `${left}%`,
                  top: `${top - 1}%`,
                  transform: "translateY(-100%)",
                  whiteSpace: "nowrap",
                  zIndex: 15,
                }}
              >
                {box.label}
                {box.confidence !== undefined && (
                  <span className="ml-1 opacity-75">
                    ({Math.round(box.confidence * 100)}%)
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* UI Element bounding box rectangle (z-index 20, rendered in front) */}
      {hasBoundingBox && boxStyle && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            ...boxStyle,
            border: isMasked ? "3px solid #dc2626" : "2px solid #22c55e",
            backgroundColor: isMasked ? "#dc2626" : "rgba(34, 197, 94, 0.15)",
          }}
        />
      )}

      {/* UI Element label badge */}
      {hasBoundingBox && (
        <div
          className={`absolute bottom-1 left-1 z-30 text-white text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
            isMasked ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {isMasked ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Sensitive
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {boundingBox?.label}
            </>
          )}
        </div>
      )}
    </div>
  );
}
