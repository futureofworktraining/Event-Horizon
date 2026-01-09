/**
 * Utility functions for handling crop coordinates and bounding box transformations.
 * All coordinates use normalized 0-1000 scale (same as bounding boxes).
 */

export interface CropCoordinates {
  x: number;      // Left edge (0-1000)
  y: number;      // Top edge (0-1000)
  width: number;  // Width (0-1000)
  height: number; // Height (0-1000)
}

export interface BoxCoords {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

/**
 * Transform bounding box from original image space to cropped image space.
 * Returns null if the box is entirely outside the crop region.
 * If the box partially overlaps, returns the visible portion within the crop.
 */
export function transformBoxToCroppedSpace(
  box: BoxCoords,
  crop: CropCoordinates
): BoxCoords | null {
  // Calculate intersection of bounding box with crop region
  const xmin = Math.max(box.xmin, crop.x);
  const ymin = Math.max(box.ymin, crop.y);
  const xmax = Math.min(box.xmax, crop.x + crop.width);
  const ymax = Math.min(box.ymax, crop.y + crop.height);

  // No intersection - box is entirely outside crop region
  if (xmin >= xmax || ymin >= ymax) {
    return null;
  }

  // Transform to cropped coordinate space (0-1000 within the crop)
  return {
    xmin: ((xmin - crop.x) / crop.width) * 1000,
    ymin: ((ymin - crop.y) / crop.height) * 1000,
    xmax: ((xmax - crop.x) / crop.width) * 1000,
    ymax: ((ymax - crop.y) / crop.height) * 1000,
  };
}

/**
 * Transform bounding box from cropped image space back to original image space.
 * Used when saving bounding box edits made while viewing a cropped image.
 */
export function transformBoxToOriginalSpace(
  box: BoxCoords,
  crop: CropCoordinates
): BoxCoords {
  return {
    xmin: crop.x + (box.xmin / 1000) * crop.width,
    ymin: crop.y + (box.ymin / 1000) * crop.height,
    xmax: crop.x + (box.xmax / 1000) * crop.width,
    ymax: crop.y + (box.ymax / 1000) * crop.height,
  };
}

/**
 * Transform a single point from cropped space back to original space.
 * Useful for mouse coordinates when drawing bounding boxes on cropped images.
 */
export function transformPointToOriginalSpace(
  point: { x: number; y: number },
  crop: CropCoordinates
): { x: number; y: number } {
  return {
    x: crop.x + (point.x / 1000) * crop.width,
    y: crop.y + (point.y / 1000) * crop.height,
  };
}

/**
 * Transform box_2d array format [ymin, xmin, ymax, xmax] to BoxCoords object.
 */
export function boxArrayToCoords(box: number[]): BoxCoords {
  return {
    ymin: box[0],
    xmin: box[1],
    ymax: box[2],
    xmax: box[3],
  };
}

/**
 * Transform BoxCoords object back to box_2d array format [ymin, xmin, ymax, xmax].
 */
export function coordsToBoxArray(coords: BoxCoords): number[] {
  return [coords.ymin, coords.xmin, coords.ymax, coords.xmax];
}

/**
 * Check if crop coordinates represent a no-op (full image, no actual crop).
 */
export function isNoCrop(crop: CropCoordinates | null | undefined): boolean {
  if (!crop) return true;
  return crop.x === 0 && crop.y === 0 && crop.width === 1000 && crop.height === 1000;
}

/**
 * Generate CSS style object for displaying a cropped image using CSS transforms.
 * The image is scaled and translated to show only the cropped region.
 */
export function getCropImageStyle(
  crop: CropCoordinates | null | undefined
): React.CSSProperties {
  if (isNoCrop(crop)) {
    return {};
  }

  const c = crop!;
  const scaleX = 1000 / c.width;
  const scaleY = 1000 / c.height;
  const translateX = -(c.x / 1000) * 100 * scaleX;
  const translateY = -(c.y / 1000) * 100 * scaleY;

  return {
    transform: `scale(${scaleX}, ${scaleY}) translate(${translateX}%, ${translateY}%)`,
    transformOrigin: 'top left',
  };
}

/**
 * Calculate the aspect ratio of a crop region.
 * Returns width/height ratio.
 */
export function getCropAspectRatio(crop: CropCoordinates): number {
  return crop.width / crop.height;
}

/**
 * Convert pixel coordinates to normalized 0-1000 coordinates.
 */
export function pixelsToNormalized(
  pixelX: number,
  pixelY: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: (pixelX / containerWidth) * 1000,
    y: (pixelY / containerHeight) * 1000,
  };
}

/**
 * Convert normalized 0-1000 coordinates to pixel coordinates.
 */
export function normalizedToPixels(
  normX: number,
  normY: number,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  return {
    x: (normX / 1000) * containerWidth,
    y: (normY / 1000) * containerHeight,
  };
}

/**
 * Convert crop coordinates from normalized to pixel values.
 */
export function cropToPixels(
  crop: CropCoordinates,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (crop.x / 1000) * containerWidth,
    y: (crop.y / 1000) * containerHeight,
    width: (crop.width / 1000) * containerWidth,
    height: (crop.height / 1000) * containerHeight,
  };
}

/**
 * Convert pixel crop values to normalized coordinates.
 */
export function pixelsToCrop(
  pixelCrop: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number
): CropCoordinates {
  return {
    x: (pixelCrop.x / containerWidth) * 1000,
    y: (pixelCrop.y / containerHeight) * 1000,
    width: (pixelCrop.width / containerWidth) * 1000,
    height: (pixelCrop.height / containerHeight) * 1000,
  };
}

/**
 * Clamp crop coordinates to valid range (0-1000).
 */
export function clampCrop(crop: CropCoordinates): CropCoordinates {
  const x = Math.max(0, Math.min(1000, crop.x));
  const y = Math.max(0, Math.min(1000, crop.y));
  const maxWidth = 1000 - x;
  const maxHeight = 1000 - y;

  return {
    x,
    y,
    width: Math.max(10, Math.min(maxWidth, crop.width)), // Min 1% width
    height: Math.max(10, Math.min(maxHeight, crop.height)), // Min 1% height
  };
}
