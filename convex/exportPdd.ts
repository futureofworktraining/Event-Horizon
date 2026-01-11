"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  ImageRun,
  PageBreak,
  AlignmentType,
  WidthType,
  BorderStyle,
  TableLayoutType,
  VerticalAlign,
  convertInchesToTwip,
  ShadingType,
  ITableCellOptions,
} from "docx";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { Jimp, loadFont, measureText, measureTextHeight } from "jimp";
import * as path from "path";

// ============================================
// TYPES
// ============================================

interface BoundingBox {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: boolean;
  masked?: boolean;
}

interface SensitiveInfoBox {
  label: string;
  box_2d: number[];
  found: boolean;
  confidence?: number;
}

interface StepImages {
  overview?: Buffer;      // Full screenshot with bounding boxes
  zoomIn?: Buffer;        // Cropped view of UI element
}

// ============================================
// IMAGE PROCESSING HELPERS
// ============================================

async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    console.log(`Fetching image from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
}

// Draw bounding box on image (border only)
async function drawBoundingBox(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  box: number[],
  color: number,
  strokeWidth: number = 3,
  _label?: string // Label rendering removed due to Jimp v1.x API changes
): Promise<void> {
  const [ymin, xmin, ymax, xmax] = box;
  const width = image.width;
  const height = image.height;

  // Convert normalized coordinates (0-1000) to pixels
  const boxX = Math.round((xmin / 1000) * width);
  const boxY = Math.round((ymin / 1000) * height);
  const boxWidth = Math.round(((xmax - xmin) / 1000) * width);
  const boxHeight = Math.round(((ymax - ymin) / 1000) * height);

  // Helper to safely scan region
  const safeScan = (x: number, y: number, w: number, h: number) => {
    // Clip to image bounds
    const startX = Math.max(0, x);
    const startY = Math.max(0, y);
    const endX = Math.min(width, x + w);
    const endY = Math.min(height, y + h);
    const scanW = endX - startX;
    const scanH = endY - startY;

    if (scanW <= 0 || scanH <= 0) return;

    image.scan(startX, startY, scanW, scanH, (px, py, idx) => {
      const r = (color >>> 24) & 0xff;
      const g = (color >>> 16) & 0xff;
      const b = (color >>> 8) & 0xff;
      const a = color & 0xff;
      image.bitmap.data[idx + 0] = r;
      image.bitmap.data[idx + 1] = g;
      image.bitmap.data[idx + 2] = b;
      image.bitmap.data[idx + 3] = a;
    });
  };

  // Top border
  safeScan(boxX, boxY, boxWidth, strokeWidth);
  // Bottom border
  safeScan(boxX, boxY + boxHeight - strokeWidth, boxWidth, strokeWidth);
  // Left border
  safeScan(boxX, boxY, strokeWidth, boxHeight);
  // Right border
  safeScan(boxX + boxWidth - strokeWidth, boxY, strokeWidth, boxHeight);

  // Note: Label text rendering removed due to Jimp v1.x API changes
  // The colored bounding box border provides sufficient visual indication
}

// Draw solid filled rectangle for sensitive info masking
async function drawSensitiveBox(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  box: number[],
  color: number,
  _label?: string // Label rendering removed due to Jimp v1.x API changes
): Promise<void> {
  const [ymin, xmin, ymax, xmax] = box;
  const imgWidth = image.width;
  const imgHeight = image.height;

  // Convert normalized coordinates (0-1000) to pixels
  const boxX = Math.max(0, Math.round((xmin / 1000) * imgWidth));
  const boxY = Math.max(0, Math.round((ymin / 1000) * imgHeight));
  const boxEndX = Math.min(imgWidth, Math.round((xmax / 1000) * imgWidth));
  const boxEndY = Math.min(imgHeight, Math.round((ymax / 1000) * imgHeight));
  const w = boxEndX - boxX;
  const h = boxEndY - boxY;

  if (w <= 0 || h <= 0) return;

  console.log(`Drawing sensitive box: x=${boxX}-${boxEndX}, y=${boxY}-${boxEndY}, label=${_label}`);

  // Use scan for faster and more reliable pixel manipulation
  image.scan(boxX, boxY, w, h, (x, y, idx) => {
    // Determine RGBA from the color integer
    // Jimp color is 0xRRGGBBAA
    const r = (color >>> 24) & 0xff;
    const g = (color >>> 16) & 0xff;
    const b = (color >>> 8) & 0xff;
    const a = color & 0xff;

    image.bitmap.data[idx + 0] = r;
    image.bitmap.data[idx + 1] = g;
    image.bitmap.data[idx + 2] = b;
    image.bitmap.data[idx + 3] = a;
  });

  // Note: Label text rendering removed due to Jimp v1.x API changes
  // The solid red fill clearly indicates masked sensitive data
}

// Helper to draw a text label badge on the image
async function drawLabelBadge(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  font: Awaited<ReturnType<typeof loadFont>>,
  text: string,
  x: number,
  y: number,
  bgColor: number, // RGBA color for background
  padding: number = 6
): Promise<{ width: number; height: number }> {
  const textWidth = measureText(font, text);
  const textHeight = measureTextHeight(font, text, 9999); // maxWidth doesn't matter for single-line text

  const badgeWidth = textWidth + padding * 2;
  const badgeHeight = textHeight + padding * 2;

  // Draw background rectangle
  const endX = Math.min(image.width, x + badgeWidth);
  const endY = Math.min(image.height, y + badgeHeight);

  image.scan(x, y, endX - x, endY - y, (px, py, idx) => {
    const r = (bgColor >>> 24) & 0xff;
    const g = (bgColor >>> 16) & 0xff;
    const b = (bgColor >>> 8) & 0xff;
    const a = bgColor & 0xff;
    image.bitmap.data[idx + 0] = r;
    image.bitmap.data[idx + 1] = g;
    image.bitmap.data[idx + 2] = b;
    image.bitmap.data[idx + 3] = a;
  });

  // Draw text
  image.print({ font, x: x + padding, y: y + padding, text });

  return { width: badgeWidth, height: badgeHeight };
}

// Create overview image with all bounding boxes and text labels
// Returns high quality PNG image for Word document (lossless)
async function createOverviewImage(
  screenshotBuffer: Buffer,
  boundingBox?: BoundingBox,
  sensitiveBoxes?: SensitiveInfoBox[],
  uiElementLabel?: string
): Promise<Buffer> {
  const image = await Jimp.read(screenshotBuffer);

  console.log(`Creating overview image: ${image.width}x${image.height}`);
  console.log(`Sensitive boxes count: ${sensitiveBoxes?.length || 0}`);

  // Draw sensitive info boxes FIRST (solid red fill to mask data)
  // NOTE: We don't check 'found' flag because frontend also renders without checking it
  // and manually added boxes always have found=true anyway
  if (sensitiveBoxes?.length) {
    const redColor = 0xdc2626ff; // Solid red with full alpha (RGBA)
    for (const box of sensitiveBoxes) {
      console.log(`Processing sensitive box: label=${box.label}, box_2d=${JSON.stringify(box.box_2d)}, found=${box.found}`);
      if (box.box_2d?.length === 4) {
        // Validate coordinates are within range
        const [ymin, xmin, ymax, xmax] = box.box_2d;
        if (ymin >= 0 && xmin >= 0 && ymax <= 1000 && xmax <= 1000 && ymin < ymax && xmin < xmax) {
          console.log(`Drawing sensitive box at: ymin=${ymin}, xmin=${xmin}, ymax=${ymax}, xmax=${xmax}`);
          await drawSensitiveBox(image, box.box_2d, redColor, box.label);
        } else {
          console.warn(`Invalid sensitive box coordinates: ${JSON.stringify(box.box_2d)}`);
        }
      }
    }
  }

  // Draw main bounding box (green) AFTER sensitive boxes so it's visible
  if (boundingBox?.found && boundingBox.box_2d?.length === 4) {
    const greenColor = 0x22c55eff; // Green with full alpha
    await drawBoundingBox(image, boundingBox.box_2d, greenColor, 4, boundingBox.label);
  }

  // Draw text label badges at top-left corner (like in web UI)
  const hasSensitiveData = (sensitiveBoxes && sensitiveBoxes.length > 0) || boundingBox?.masked;
  const showUiLabel = uiElementLabel && boundingBox?.found;

  if (showUiLabel || hasSensitiveData) {
    try {
      // Load font for labels - use 16pt white for visibility
      const fontPath = path.join(
        path.dirname(require.resolve("@jimp/plugin-print")),
        "..", "fonts", "open-sans", "open-sans-16-white", "open-sans-16-white.fnt"
      );
      const font = await loadFont(fontPath);

      let currentY = 10; // Start 10px from top
      const labelX = 10; // Start 10px from left
      const labelGap = 6; // Gap between labels

      // UI Element label (green badge)
      if (showUiLabel && uiElementLabel) {
        const greenBg = 0x22c55eff; // Green background
        const { height } = await drawLabelBadge(image, font, uiElementLabel, labelX, currentY, greenBg);
        currentY += height + labelGap;
      }

      // Sensitive data label (red badge)
      if (hasSensitiveData) {
        const redBg = 0xdc2626ff; // Red background
        // Collect sensitive labels or use generic text
        let sensitiveText = "Sensitive";
        if (sensitiveBoxes && sensitiveBoxes.length > 0) {
          const labels = sensitiveBoxes
            .filter(box => box.found && box.label)
            .map(box => box.label)
            .slice(0, 3); // Limit to 3 labels to avoid overflow
          if (labels.length > 0) {
            sensitiveText = labels.join(", ");
            if (sensitiveBoxes.length > 3) {
              sensitiveText += "...";
            }
          }
        }
        await drawLabelBadge(image, font, sensitiveText, labelX, currentY, redBg);
      }
    } catch (fontError) {
      console.warn("Could not load font for labels:", fontError);
      // Continue without labels if font loading fails
    }
  }

  // Return as PNG for lossless quality in Word document
  return await image.getBuffer("image/png");
}

// Create zoomed-in cropped image of the UI element
// Note: We don't resize to preserve quality - Word will handle display sizing
async function createZoomInImage(
  screenshotBuffer: Buffer,
  boundingBox: BoundingBox
): Promise<Buffer | null> {
  if (!boundingBox?.found || !boundingBox.box_2d || boundingBox.box_2d.length !== 4) {
    return null;
  }

  const image = await Jimp.read(screenshotBuffer);
  const [ymin, xmin, ymax, xmax] = boundingBox.box_2d;
  const width = image.width;
  const height = image.height;

  // Convert normalized coordinates to pixels with padding
  const padding = 50; // pixels of context around the element
  const boxX = Math.max(0, Math.round((xmin / 1000) * width) - padding);
  const boxY = Math.max(0, Math.round((ymin / 1000) * height) - padding);
  const boxW = Math.min(width - boxX, Math.round(((xmax - xmin) / 1000) * width) + padding * 2);
  const boxH = Math.min(height - boxY, Math.round(((ymax - ymin) / 1000) * height) + padding * 2);

  // Crop the image
  image.crop({ x: boxX, y: boxY, w: boxW, h: boxH });

  // Draw bounding box on the cropped image (adjust coordinates)
  const newXmin = padding;
  const newYmin = padding;
  const newXmax = boxW - padding;
  const newYmax = boxH - padding;

  // Draw green border around the element in the cropped view
  const greenColor = 0x22c55eff;
  for (let i = 0; i < 3; i++) {
    // Top
    for (let x = newXmin; x < newXmax && x < image.width; x++) {
      if (newYmin + i < image.height) image.setPixelColor(greenColor, x, newYmin + i);
    }
    // Bottom
    for (let x = newXmin; x < newXmax && x < image.width; x++) {
      if (newYmax - i > 0 && newYmax - i < image.height) image.setPixelColor(greenColor, x, newYmax - i);
    }
    // Left
    for (let y = newYmin; y < newYmax && y < image.height; y++) {
      if (newXmin + i < image.width) image.setPixelColor(greenColor, newXmin + i, y);
    }
    // Right
    for (let y = newYmin; y < newYmax && y < image.height; y++) {
      if (newXmax - i > 0 && newXmax - i < image.width) image.setPixelColor(greenColor, newXmax - i, y);
    }
  }

  // Return as PNG for lossless quality
  return await image.getBuffer("image/png");
}

// Process step screenshots - returns overview and zoom-in images
async function processStepImages(
  screenshotUrl: string | null,
  boundingBox?: BoundingBox,
  sensitiveBoxes?: SensitiveInfoBox[],
  uiElementLabel?: string
): Promise<StepImages> {
  const result: StepImages = {};

  if (!screenshotUrl) return result;

  const screenshotBuffer = await fetchImageAsBuffer(screenshotUrl);
  if (!screenshotBuffer) return result;

  // Create overview with bounding boxes and labels (full quality PNG)
  result.overview = await createOverviewImage(screenshotBuffer, boundingBox, sensitiveBoxes, uiElementLabel);

  // Create zoom-in of UI element if bounding box exists (full quality PNG)
  if (boundingBox?.found) {
    result.zoomIn = await createZoomInImage(screenshotBuffer, boundingBox) ?? undefined;
  }

  return result;
}

// Format duration
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec`;
}

// ============================================
// WORD DOCUMENT - MODERN STYLING
// ============================================

const COLORS = {
  primary: "2563eb",      // Blue
  primaryDark: "1d4ed8",
  secondary: "64748b",    // Gray
  text: "1e293b",
  textLight: "64748b",
  border: "e2e8f0",
  background: "f8fafc",
  success: "22c55e",      // Green
  danger: "ef4444",       // Red
  white: "ffffff",
};

function createModernCoverPage(processName: string, fileName?: string, totalSteps?: number): Paragraph[] {
  return [
    // Spacer
    new Paragraph({ children: [new TextRun({ text: "", size: 48 })], spacing: { after: 3000 } }),

    // Title
    new Paragraph({
      children: [
        new TextRun({
          text: processName,
          bold: true,
          size: 72,
          color: COLORS.primary,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),

    // Subtitle
    new Paragraph({
      children: [
        new TextRun({
          text: "Process Design Document",
          size: 32,
          color: COLORS.secondary,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),

    // Decorative line
    new Paragraph({
      children: [
        new TextRun({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          size: 24,
          color: COLORS.primary,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),

    // Metadata
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          size: 22,
          color: COLORS.textLight,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
    }),

    ...(fileName ? [
      new Paragraph({
        children: [
          new TextRun({
            text: `Source: ${fileName}`,
            size: 22,
            color: COLORS.textLight,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
      }),
    ] : []),

    ...(totalSteps ? [
      new Paragraph({
        children: [
          new TextRun({
            text: `Total Steps: ${totalSteps}`,
            size: 22,
            color: COLORS.textLight,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ] : []),
  ];
}

function createSectionHeader(text: string, sectionNumber: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${sectionNumber}  `,
        bold: true,
        size: 32,
        color: COLORS.primary,
      }),
      new TextRun({
        text: text,
        bold: true,
        size: 32,
        color: COLORS.text,
      }),
    ],
    spacing: { before: 400, after: 250 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.primary },
    },
  });
}

function createStepHeader(stepNumber: number, description: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `Step ${stepNumber}`,
        bold: true,
        size: 28,
        color: COLORS.white,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: COLORS.primary },
    spacing: { before: 350, after: 150 },
    indent: { left: 100, right: 100 },
  });
}

function createStepDescription(description: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: description,
        size: 24,
        color: COLORS.text,
      }),
    ],
    spacing: { after: 200 },
    shading: { type: ShadingType.SOLID, color: COLORS.background },
    indent: { left: 100, right: 100 },
  });
}

function createCompactDetailsTable(step: any): Table {
  const rows: TableRow[] = [];

  // Row 1: Timestamp | Action Type | Application
  rows.push(
    new TableRow({
      children: [
        createDetailCell("Timestamp", step.timestamp || "-", 2200),
        createDetailCell("Action", `${step.actionType?.replace(/_/g, " ")} → ${step.specificAction?.replace(/_/g, " ")}`, 3800),
        createDetailCell("Application", step.application || "-", 3000),
      ],
    })
  );

  // Row 2: Screen | UI Element (if exists)
  const screenCell = createDetailCell("Screen", step.screenName || "-", 2200);

  if (step.uiElement) {
    const elementInfo = `${step.uiElement.elementName || ""} (${step.uiElement.elementType?.replace(/_/g, " ") || ""})`;
    rows.push(
      new TableRow({
        children: [
          screenCell,
          createDetailCell("UI Element", elementInfo, 3800),
          createDetailCell("Region", step.uiElement.screenRegion?.replace(/_/g, " ") || "-", 3000),
        ],
      })
    );
  } else {
    rows.push(
      new TableRow({
        children: [
          screenCell,
          createDetailCell("", "", 6800),
        ],
      })
    );
  }

  // Row 3: Data info if exists
  if (step.dataInfo) {
    const dataValue = step.dataInfo.isSensitive ? "[SENSITIVE DATA]" : (step.dataInfo.value || "-");
    rows.push(
      new TableRow({
        children: [
          createDetailCell("Data Value", dataValue, 4500),
          createDetailCell("Data Type", step.dataInfo.dataType || "-", 2200),
          createDetailCell("Source", step.dataInfo.source?.replace(/_/g, " ") || "-", 2300),
        ],
      })
    );
  }

  // Row 4: Wait condition if exists
  if (step.waitCondition) {
    rows.push(
      new TableRow({
        children: [
          createDetailCell("Wait", step.waitCondition.waitType?.replace(/_/g, " ") || "-", 2200),
          createDetailCell("Description", step.waitCondition.description || "-", 4800),
          createDetailCell("Timeout", step.waitCondition.timeoutSeconds ? `${step.waitCondition.timeoutSeconds}s` : "-", 2000),
        ],
      })
    );
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
    },
  });
}

function createDetailCell(label: string, value: string, widthDxa: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          ...(label ? [
            new TextRun({ text: label + ": ", bold: true, size: 18, color: COLORS.secondary }),
          ] : []),
          new TextRun({ text: value, size: 18, color: COLORS.text }),
        ],
      }),
    ],
    width: { size: widthDxa, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
  });
}

function createApplicationsTable(applications: any[]): Table {
  // Column widths: Application (2500), Type (2000), URL/Version (4500) = 9000 total
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Application", bold: true, size: 20, color: COLORS.white })] })],
        shading: { type: ShadingType.SOLID, color: COLORS.primary },
        width: { size: 2500, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "Type", bold: true, size: 20, color: COLORS.white })] })],
        shading: { type: ShadingType.SOLID, color: COLORS.primary },
        width: { size: 2000, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "URL / Version", bold: true, size: 20, color: COLORS.white })] })],
        shading: { type: ShadingType.SOLID, color: COLORS.primary },
        width: { size: 4500, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
      }),
    ],
    tableHeader: true,
  });

  const dataRows = applications.map((app, i) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: app.name || "-", size: 20 })] })],
          shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: COLORS.background } : undefined,
          width: { size: 2500, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 150, right: 150 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: app.type?.replace(/_/g, " ") || "-", size: 20 })] })],
          shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: COLORS.background } : undefined,
          width: { size: 2000, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 150, right: 150 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: app.url || app.version || "-", size: 20 })] })],
          shading: i % 2 === 0 ? { type: ShadingType.SOLID, color: COLORS.background } : undefined,
          width: { size: 4500, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 150, right: 150 },
        }),
      ],
    })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
    },
  });
}

function createImageWithCaption(imageBuffer: Buffer, width: number, height: number, caption: string): (Paragraph)[] {
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: imageBuffer,
          transformation: { width, height },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: caption,
          italics: true,
          size: 16,
          color: COLORS.secondary,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
    }),
  ];
}

// Helper to create subprocess header
function createSubprocessHeader(processName: string, hierarchyLevel: number, stepCount: number): Paragraph {
  const indent = (hierarchyLevel - 1) * 200;
  return new Paragraph({
    children: [
      new TextRun({
        text: `📁 ${processName}`,
        bold: true,
        size: 26,
        color: COLORS.white,
      }),
      new TextRun({
        text: `  (${stepCount} steps)`,
        size: 20,
        color: "c7d2fe", // Light blue
      }),
    ],
    shading: { type: ShadingType.SOLID, color: "4f46e5" }, // Indigo background for subprocesses
    spacing: { before: 400, after: 200 },
    indent: { left: indent },
  });
}

// Main Word document creation
async function createWordDocument(processData: any): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Calculate total steps including subprocesses
  const totalSteps = processData.totalStepsAllProcesses || processData.steps?.length || processData.totalSteps || 0;
  const subprocessCount = processData.subprocessCount || 0;

  // Cover page
  children.push(...createModernCoverPage(
    processData.processName,
    processData.job?.fileName,
    totalSteps
  ));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Process Overview
  children.push(createSectionHeader("Process Overview", "1"));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: processData.processDescription || "No description provided.", size: 22, color: COLORS.text })],
      spacing: { after: 250 },
    })
  );

  // Quick stats with subprocess info
  const statsRuns = [
    new TextRun({ text: "Duration: ", bold: true, size: 20, color: COLORS.secondary }),
    new TextRun({ text: formatDuration(processData.recordingDurationSeconds || 0), size: 20, color: COLORS.text }),
    new TextRun({ text: "   •   ", size: 20, color: COLORS.border }),
    new TextRun({ text: "Total Steps: ", bold: true, size: 20, color: COLORS.secondary }),
    new TextRun({ text: String(totalSteps), size: 20, color: COLORS.text }),
  ];

  if (subprocessCount > 0) {
    statsRuns.push(
      new TextRun({ text: "   •   ", size: 20, color: COLORS.border }),
      new TextRun({ text: "Subprocesses: ", bold: true, size: 20, color: COLORS.secondary }),
      new TextRun({ text: String(subprocessCount), size: 20, color: COLORS.text })
    );
  }

  children.push(
    new Paragraph({
      children: statsRuns,
      spacing: { after: 400 },
    })
  );

  // Subprocess list if any
  if (processData.subprocesses?.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Included Subprocesses:", bold: true, size: 20, color: COLORS.text }),
        ],
        spacing: { before: 100, after: 100 },
      })
    );

    for (const subprocess of processData.subprocesses) {
      const levelIndicator = "  ".repeat((subprocess.hierarchyLevel || 1) - 1) + "└─";
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: levelIndicator, size: 18, color: COLORS.secondary }),
            new TextRun({ text: ` ${subprocess.processName}`, size: 18, color: COLORS.text }),
            new TextRun({ text: ` (${subprocess.totalSteps} steps)`, size: 16, color: COLORS.secondary }),
          ],
          spacing: { after: 50 },
          indent: { left: 200 },
        })
      );
    }
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  // Applications
  if (processData.applications?.length > 0) {
    children.push(createSectionHeader("Applications Used", "2"));
    children.push(createApplicationsTable(processData.applications));
    children.push(new Paragraph({ text: "", spacing: { after: 300 } }));
  }

  // Steps - grouped by process
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(createSectionHeader("Step-by-Step Documentation", "3"));

  // Group steps by process
  let currentProcessName: string | null = null;
  let globalStepNumber = 0;

  for (const step of processData.steps || []) {
    // Add subprocess header if process changes
    if (step.processName !== currentProcessName) {
      currentProcessName = step.processName;

      // Count steps for this process
      const processStepCount = (processData.steps || []).filter(
        (s: any) => s.processName === currentProcessName
      ).length;

      // Show subprocess header (skip for main process at level 1)
      if (step.isSubprocessStep || step.processHierarchyLevel > 1) {
        children.push(createSubprocessHeader(
          currentProcessName!,
          step.processHierarchyLevel || 1,
          processStepCount
        ));
      } else if (subprocessCount > 0) {
        // Show main process header if there are subprocesses
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `📁 ${currentProcessName!}`,
                bold: true,
                size: 26,
                color: COLORS.white,
              }),
              new TextRun({
                text: ` (Main Process - ${processStepCount} steps)`,
                size: 20,
                color: "bbf7d0", // Light green
              }),
            ],
            shading: { type: ShadingType.SOLID, color: COLORS.success }, // Green for main process
            spacing: { before: 300, after: 200 },
          })
        );
      }
    }

    globalStepNumber++;

    // Step header with global number and process context
    const stepLabel = subprocessCount > 0
      ? `Step ${globalStepNumber} (${step.processName} #${step.stepNumber})`
      : `Step ${step.stepNumber}`;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: stepLabel,
            bold: true,
            size: 28,
            color: COLORS.white,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: COLORS.primary },
        spacing: { before: 350, after: 150 },
        indent: { left: 100, right: 100 },
      })
    );

    // Step description
    children.push(createStepDescription(step.description || "No description"));

    // Compact details table
    children.push(createCompactDetailsTable(step));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // Screenshots section
    // Debug logging for sensitive boxes
    console.log(`Step ${step.stepNumber}: sensitiveInfoBoxes =`, JSON.stringify(step.sensitiveInfoBoxes));

    // Get UI element label for the image badge
    const uiElementLabel = step.uiElement?.elementName || (step.boundingBox as BoundingBox)?.label;

    const images = await processStepImages(
      step.screenshotUrl,
      step.boundingBox as BoundingBox,
      step.sensitiveInfoBoxes as SensitiveInfoBox[],
      uiElementLabel
    );

    if (images.overview) {
      try {
        const overviewImg = await Jimp.read(images.overview);
        const overviewRatio = overviewImg.height / overviewImg.width;
        // Use page width minus margins: 8.5" - 1" = 7.5" = ~540 points (Word uses different units for ImageRun)
        // Increasing to 700 to use full page width (Narrow margins) for better quality
        const overviewWidth = 700;
        const overviewHeight = Math.round(overviewWidth * overviewRatio);

        // Screenshots header
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Screenshots", bold: true, size: 22, color: COLORS.text }),
            ],
            spacing: { before: 150, after: 150 },
          })
        );

        // Overview image (labels are drawn directly on the image)
        children.push(...createImageWithCaption(
          images.overview,
          overviewWidth,
          overviewHeight,
          "Overview - Full screen with highlighted UI element"
        ));

        // Zoom-in image if available
        if (images.zoomIn) {
          const zoomImg = await Jimp.read(images.zoomIn);
          const zoomRatio = zoomImg.height / zoomImg.width;
          // Use larger zoom width for better detail visibility
          const zoomWidth = Math.min(400, zoomImg.width);
          const zoomHeight = Math.round(zoomWidth * zoomRatio);

          children.push(...createImageWithCaption(
            images.zoomIn,
            zoomWidth,
            zoomHeight,
            "Detail - Zoomed view of the UI element"
          ));
        }
      } catch (imgError) {
        console.error("Error loading image for Word document:", imgError);
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "[Screenshot could not be loaded]", italics: true, color: COLORS.secondary })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      }
    } else if (step.screenshotRequired) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "[Screenshot not available]", italics: true, color: COLORS.secondary })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }

    // Notes / Automation hints
    if (step.notes || step.automationHint) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Notes", bold: true, size: 20, color: COLORS.text }),
          ],
          spacing: { before: 100, after: 80 },
        })
      );

      if (step.notes) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Note: ", bold: true, size: 18, color: COLORS.secondary }),
              new TextRun({ text: step.notes, size: 18, color: COLORS.text }),
            ],
            shading: { type: ShadingType.SOLID, color: "fef3c7" }, // Amber background
            indent: { left: 150, right: 150 },
            spacing: { after: 50 },
          })
        );
      }
      if (step.automationHint) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Automation Hint: ", bold: true, size: 18, color: COLORS.secondary }),
              new TextRun({ text: step.automationHint, size: 18, color: COLORS.text }),
            ],
            shading: { type: ShadingType.SOLID, color: "dbeafe" }, // Blue background
            indent: { left: 150, right: 150 },
          })
        );
      }
    }

    children.push(new Paragraph({ text: "", spacing: { after: 350 } }));
  }

  // Business Rules
  if (processData.businessRulesObserved?.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(createSectionHeader("Business Rules Observed", "4"));
    for (const rule of processData.businessRulesObserved) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "•  ", size: 22, color: COLORS.primary }),
            new TextRun({ text: rule, size: 22, color: COLORS.text }),
          ],
          spacing: { after: 100 },
          indent: { left: 200 },
        })
      );
    }
  }

  // Exceptions
  if (processData.exceptionsNoted?.length > 0) {
    const sectionNum = processData.businessRulesObserved?.length > 0 ? "5" : "4";
    children.push(createSectionHeader("Exceptions Noted", sectionNum));
    for (const exception of processData.exceptionsNoted) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "⚠  ", size: 22, color: COLORS.danger }),
            new TextRun({ text: exception, size: 22, color: COLORS.text }),
          ],
          spacing: { after: 100 },
          indent: { left: 200 },
        })
      );
    }
  }

  // Create document with Aptos font
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ============================================
// PDF DOCUMENT GENERATION (using pdf-lib - serverless compatible)
// ============================================

// Helper to convert hex color to rgb values (0-1 range)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

// Simple text wrapping helper
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

async function createPdfDocument(processData: any): Promise<Buffer> {
  console.log("Creating PDF document with pdf-lib (serverless compatible)...");

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed standard fonts (no filesystem access needed)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page dimensions (A4)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const colors = {
    primary: hexToRgb(COLORS.primary),
    secondary: hexToRgb(COLORS.secondary),
    text: hexToRgb(COLORS.text),
    border: hexToRgb(COLORS.border),
    background: hexToRgb(COLORS.background),
    success: hexToRgb(COLORS.success),
    danger: hexToRgb(COLORS.danger),
    white: { r: 1, g: 1, b: 1 },
    indigo: hexToRgb("4f46e5"),
  };

  // Current position tracking - initialize with first page
  let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y: number = pageHeight - margin;

  // Helper to add a new page
  const addPage = () => {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    return currentPage;
  };

  // Helper to check if we need a new page
  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < margin) {
      addPage();
      return true;
    }
    return false;
  };

  // Helper to draw text and return height used
  const drawText = (
    text: string,
    x: number,
    fontSize: number,
    font: PDFFont = helvetica,
    color = colors.text,
    maxWidth?: number
  ): number => {
    const effectiveMaxWidth = maxWidth || (contentWidth - (x - margin));
    const lines = wrapText(text, font, fontSize, effectiveMaxWidth);
    const lineHeight = fontSize * 1.2;

    for (const line of lines) {
      checkPageBreak(lineHeight);
      currentPage.drawText(line, {
        x,
        y: y - fontSize,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      y -= lineHeight;
    }

    return lines.length * lineHeight;
  };

  // Helper to draw a rectangle
  const drawRect = (
    x: number,
    rectY: number,
    width: number,
    height: number,
    fillColor?: { r: number; g: number; b: number },
    borderColor?: { r: number; g: number; b: number }
  ) => {
    if (fillColor) {
      currentPage.drawRectangle({
        x,
        y: rectY,
        width,
        height,
        color: rgb(fillColor.r, fillColor.g, fillColor.b),
      });
    }
    if (borderColor) {
      currentPage.drawRectangle({
        x,
        y: rectY,
        width,
        height,
        borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
        borderWidth: 1,
      });
    }
  };

  // Helper to draw a horizontal line
  const drawLine = (lineY: number, color = colors.primary, thickness = 2) => {
    currentPage.drawLine({
      start: { x: margin, y: lineY },
      end: { x: pageWidth - margin, y: lineY },
      thickness,
      color: rgb(color.r, color.g, color.b),
    });
  };

  // Helper to draw section header
  const drawSectionHeader = (number: string, title: string) => {
    checkPageBreak(50);
    y -= 20;

    // Section number and title
    const numberWidth = helveticaBold.widthOfTextAtSize(number + "  ", 24);
    currentPage.drawText(number + "  ", {
      x: margin,
      y: y - 24,
      size: 24,
      font: helveticaBold,
      color: rgb(colors.primary.r, colors.primary.g, colors.primary.b),
    });
    currentPage.drawText(title, {
      x: margin + numberWidth,
      y: y - 24,
      size: 24,
      font: helveticaBold,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });
    y -= 35;

    // Underline
    drawLine(y, colors.primary, 1);
    y -= 20;
  };

  // ===== 1. COVER PAGE ===== (first page already created during initialization)
  // Title (centered)
  y = pageHeight - 250;
  const titleText = processData.processName || "Process Design Document";
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 36);
  currentPage.drawText(titleText, {
    x: (pageWidth - titleWidth) / 2,
    y,
    size: 36,
    font: helveticaBold,
    color: rgb(colors.primary.r, colors.primary.g, colors.primary.b),
  });

  // Subtitle
  y -= 40;
  const subtitleText = "Process Design Document";
  const subtitleWidth = helvetica.widthOfTextAtSize(subtitleText, 18);
  currentPage.drawText(subtitleText, {
    x: (pageWidth - subtitleWidth) / 2,
    y,
    size: 18,
    font: helvetica,
    color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
  });

  // Decorative line
  y -= 50;
  currentPage.drawLine({
    start: { x: margin + 100, y },
    end: { x: pageWidth - margin - 100, y },
    thickness: 3,
    color: rgb(colors.primary.r, colors.primary.g, colors.primary.b),
  });

  // Metadata
  y -= 50;
  const dateText = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
  const dateWidth = helvetica.widthOfTextAtSize(dateText, 12);
  currentPage.drawText(dateText, {
    x: (pageWidth - dateWidth) / 2,
    y,
    size: 12,
    font: helvetica,
    color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
  });

  if (processData.job?.fileName) {
    y -= 20;
    const sourceText = `Source: ${processData.job.fileName}`;
    const sourceWidth = helvetica.widthOfTextAtSize(sourceText, 12);
    currentPage.drawText(sourceText, {
      x: (pageWidth - sourceWidth) / 2,
      y,
      size: 12,
      font: helvetica,
      color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
    });
  }

  const totalSteps = processData.totalStepsAllProcesses || processData.steps?.length || processData.totalSteps || 0;
  y -= 20;
  const stepsText = `Total Steps: ${totalSteps}`;
  const stepsWidth = helvetica.widthOfTextAtSize(stepsText, 12);
  currentPage.drawText(stepsText, {
    x: (pageWidth - stepsWidth) / 2,
    y,
    size: 12,
    font: helvetica,
    color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
  });

  // ===== 2. PROCESS OVERVIEW =====
  addPage();
  drawSectionHeader("1", "Process Overview");

  // Description
  const description = processData.processDescription || "No description provided.";
  drawText(description, margin, 11, helvetica, colors.text);
  y -= 20;

  // Quick stats
  const durationText = `Duration: ${formatDuration(processData.recordingDurationSeconds || 0)}  |  Total Steps: ${totalSteps}`;
  drawText(durationText, margin, 10, helvetica, colors.secondary);
  y -= 20;

  // Subprocesses list
  const subprocessCount = processData.subprocessCount || 0;
  if (processData.subprocesses?.length > 0) {
    drawText("Included Subprocesses:", margin, 10, helveticaBold, colors.text);
    y -= 5;
    for (const subprocess of processData.subprocesses) {
      const indentLvl = (subprocess.hierarchyLevel || 1) - 1;
      const indentStr = "  ".repeat(indentLvl) + "- ";
      drawText(`${indentStr}${subprocess.processName} (${subprocess.totalSteps} steps)`, margin + 20, 10, helvetica, colors.secondary);
    }
    y -= 15;
  }

  // ===== 3. APPLICATIONS USED =====
  if (processData.applications?.length > 0) {
    drawSectionHeader("2", "Applications Used");

    const rowHeight = 25;
    const col1Width = contentWidth * 0.3;
    const col2Width = contentWidth * 0.25;
    const col3Width = contentWidth * 0.45;

    // Header row
    checkPageBreak(rowHeight + 10);
    const headerY = y - rowHeight;
    drawRect(margin, headerY, contentWidth, rowHeight, colors.primary);

    currentPage.drawText("Application", {
      x: margin + 5,
      y: headerY + 8,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    currentPage.drawText("Type", {
      x: margin + col1Width + 5,
      y: headerY + 8,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    currentPage.drawText("URL / Version", {
      x: margin + col1Width + col2Width + 5,
      y: headerY + 8,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    y = headerY;

    // Data rows
    for (let i = 0; i < processData.applications.length; i++) {
      const app = processData.applications[i];
      checkPageBreak(rowHeight);
      const rowY = y - rowHeight;

      if (i % 2 === 0) {
        drawRect(margin, rowY, contentWidth, rowHeight, colors.background);
      }
      drawRect(margin, rowY, contentWidth, rowHeight, undefined, colors.border);

      currentPage.drawText((app.name || "-").substring(0, 25), {
        x: margin + 5,
        y: rowY + 8,
        size: 10,
        font: helvetica,
        color: rgb(colors.text.r, colors.text.g, colors.text.b),
      });
      currentPage.drawText((app.type?.replace(/_/g, " ") || "-").substring(0, 20), {
        x: margin + col1Width + 5,
        y: rowY + 8,
        size: 10,
        font: helvetica,
        color: rgb(colors.text.r, colors.text.g, colors.text.b),
      });
      currentPage.drawText((app.url || app.version || "-").substring(0, 40), {
        x: margin + col1Width + col2Width + 5,
        y: rowY + 8,
        size: 10,
        font: helvetica,
        color: rgb(colors.text.r, colors.text.g, colors.text.b),
      });
      y = rowY;
    }
    y -= 20;
  }

  // ===== 4. STEP-BY-STEP DOCUMENTATION =====
  addPage();
  drawSectionHeader("3", "Step-by-Step Documentation");

  let currentProcessName: string | null = null;
  let globalStepNumber = 0;

  for (const step of processData.steps || []) {
    // Process header for subprocesses
    if (step.processName !== currentProcessName) {
      currentProcessName = step.processName;
      const processStepCount = (processData.steps || []).filter(
        (s: any) => s.processName === currentProcessName
      ).length;

      if (subprocessCount > 0) {
        checkPageBreak(40);
        const isMain = !step.isSubprocessStep && step.processHierarchyLevel <= 1;
        const headerHeight = 30;
        const headerY = y - headerHeight;
        const bgColor = isMain ? colors.success : colors.indigo;

        drawRect(margin, headerY, contentWidth, headerHeight, bgColor);

        const processLabel = isMain ? `${currentProcessName} (Main Process)` : currentProcessName!;
        currentPage.drawText(processLabel.substring(0, 60), {
          x: margin + 10,
          y: headerY + 10,
          size: 14,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        const countText = `${processStepCount} steps`;
        const countWidth = helvetica.widthOfTextAtSize(countText, 10);
        currentPage.drawText(countText, {
          x: pageWidth - margin - countWidth - 10,
          y: headerY + 12,
          size: 10,
          font: helvetica,
          color: rgb(1, 1, 1),
        });

        y = headerY - 10;
      }
    }

    globalStepNumber++;

    // Step header
    checkPageBreak(150); // Reserve space for step content
    const stepLabel = subprocessCount > 0
      ? `Step ${globalStepNumber} (${step.processName} #${step.stepNumber})`
      : `Step ${step.stepNumber}`;

    const stepHeaderHeight = 25;
    const stepHeaderY = y - stepHeaderHeight;
    drawRect(margin, stepHeaderY, contentWidth, stepHeaderHeight, colors.primary);

    currentPage.drawText(stepLabel, {
      x: margin + 10,
      y: stepHeaderY + 8,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    y = stepHeaderY;

    // Description
    const descHeight = 25;
    const descY = y - descHeight;
    drawRect(margin, descY, contentWidth, descHeight, colors.background);

    const descText = step.description || "No description";
    const truncatedDesc = descText.length > 100 ? descText.substring(0, 100) + "..." : descText;
    currentPage.drawText(truncatedDesc, {
      x: margin + 10,
      y: descY + 8,
      size: 10,
      font: helvetica,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });
    y = descY;

    // Details rows
    const rowHeight = 22;

    // Row 1: Timestamp | Action | Application
    const row1Y = y - rowHeight;
    drawRect(margin, row1Y, contentWidth, rowHeight, undefined, colors.border);

    const timeLabel = "Time: ";
    const timeValue = step.timestamp || "-";
    const actionLabel = "Action: ";
    const actionValue = `${step.actionType?.replace(/_/g, " ") || ""} > ${step.specificAction?.replace(/_/g, " ") || ""}`;
    const appLabel = "App: ";
    const appValue = step.application || "-";

    currentPage.drawText(timeLabel, { x: margin + 5, y: row1Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
    currentPage.drawText(timeValue, { x: margin + 5 + helveticaBold.widthOfTextAtSize(timeLabel, 9), y: row1Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });

    currentPage.drawText(actionLabel, { x: margin + 100, y: row1Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
    currentPage.drawText(actionValue.substring(0, 40), { x: margin + 100 + helveticaBold.widthOfTextAtSize(actionLabel, 9), y: row1Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });

    currentPage.drawText(appLabel, { x: margin + 350, y: row1Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
    currentPage.drawText(appValue.substring(0, 25), { x: margin + 350 + helveticaBold.widthOfTextAtSize(appLabel, 9), y: row1Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });
    y = row1Y;

    // Row 2: Screen | UI Element
    const row2Y = y - rowHeight;
    drawRect(margin, row2Y, contentWidth, rowHeight, undefined, colors.border);

    const screenLabel = "Screen: ";
    const screenValue = step.screenName || "-";
    const elementLabel = "Element: ";
    const elementValue = step.uiElement
      ? `${step.uiElement.elementName || ""} (${step.uiElement.elementType || ""})`
      : "-";

    currentPage.drawText(screenLabel, { x: margin + 5, y: row2Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
    currentPage.drawText(screenValue.substring(0, 30), { x: margin + 5 + helveticaBold.widthOfTextAtSize(screenLabel, 9), y: row2Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });

    currentPage.drawText(elementLabel, { x: margin + 180, y: row2Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
    currentPage.drawText(elementValue.substring(0, 50), { x: margin + 180 + helveticaBold.widthOfTextAtSize(elementLabel, 9), y: row2Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });
    y = row2Y;

    // Row 3: Data info (if exists)
    if (step.dataInfo) {
      const row3Y = y - rowHeight;
      drawRect(margin, row3Y, contentWidth, rowHeight, undefined, colors.border);

      const dataLabel = "Data: ";
      const dataValue = step.dataInfo.isSensitive ? "[SENSITIVE]" : (step.dataInfo.value || "-");
      const typeLabel = "Type: ";
      const typeValue = step.dataInfo.dataType || "-";

      currentPage.drawText(dataLabel, { x: margin + 5, y: row3Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
      currentPage.drawText(dataValue.substring(0, 50), { x: margin + 5 + helveticaBold.widthOfTextAtSize(dataLabel, 9), y: row3Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });

      currentPage.drawText(typeLabel, { x: margin + 350, y: row3Y + 6, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
      currentPage.drawText(typeValue, { x: margin + 350 + helveticaBold.widthOfTextAtSize(typeLabel, 9), y: row3Y + 6, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });
      y = row3Y;
    }

    // Notes (if exists)
    if (step.notes) {
      const noteY = y - 20;
      drawRect(margin, noteY, contentWidth, 18, { r: 0.996, g: 0.953, b: 0.78 }, colors.border); // amber background

      currentPage.drawText("Note: ", { x: margin + 5, y: noteY + 4, size: 9, font: helveticaBold, color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b) });
      currentPage.drawText(step.notes.substring(0, 80), { x: margin + 5 + helveticaBold.widthOfTextAtSize("Note: ", 9), y: noteY + 4, size: 9, font: helvetica, color: rgb(colors.text.r, colors.text.g, colors.text.b) });
      y = noteY;
    }

    // Screenshots section - get UI element label for image badge
    const pdfUiElementLabel = step.uiElement?.elementName || (step.boundingBox as BoundingBox)?.label;

    const images = await processStepImages(
      step.screenshotUrl,
      step.boundingBox as BoundingBox,
      step.sensitiveInfoBoxes as SensitiveInfoBox[],
      pdfUiElementLabel
    );

    if (images.overview) {
      try {
        y -= 15;
        currentPage.drawText("Screenshots", {
          x: margin,
          y: y - 10,
          size: 10,
          font: helveticaBold,
          color: rgb(colors.text.r, colors.text.g, colors.text.b),
        });
        y -= 20;

        // Embed the PNG image
        const overviewImg = await Jimp.read(images.overview);
        const overviewRatio = overviewImg.height / overviewImg.width;

        // Calculate dimensions to fit page
        const maxImgWidth = Math.min(contentWidth, 450);
        const imgWidth = maxImgWidth;
        const imgHeight = imgWidth * overviewRatio;

        // Check if we need a new page for the image
        if (y - imgHeight - 30 < margin) {
          addPage();
        }

        const pngImage = await pdfDoc.embedPng(images.overview);
        const imgY = y - imgHeight;

        currentPage.drawImage(pngImage, {
          x: margin + (contentWidth - imgWidth) / 2,
          y: imgY,
          width: imgWidth,
          height: imgHeight,
        });

        y = imgY - 5;

        // Caption
        const captionText = "Overview - Full screen with highlighted UI element";
        const captionWidth = helvetica.widthOfTextAtSize(captionText, 8);
        currentPage.drawText(captionText, {
          x: (pageWidth - captionWidth) / 2,
          y: y - 8,
          size: 8,
          font: helvetica,
          color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
        });
        y -= 20;

        // Zoom-in image if available
        if (images.zoomIn) {
          const zoomImg = await Jimp.read(images.zoomIn);
          const zoomRatio = zoomImg.height / zoomImg.width;
          const zoomWidth = Math.min(250, contentWidth * 0.5);
          const zoomHeight = zoomWidth * zoomRatio;

          if (y - zoomHeight - 30 < margin) {
            addPage();
          }

          const zoomPngImage = await pdfDoc.embedPng(images.zoomIn);
          const zoomImgY = y - zoomHeight;

          currentPage.drawImage(zoomPngImage, {
            x: margin + (contentWidth - zoomWidth) / 2,
            y: zoomImgY,
            width: zoomWidth,
            height: zoomHeight,
          });

          y = zoomImgY - 5;

          const zoomCaptionText = "Detail - Zoomed view of the UI element";
          const zoomCaptionWidth = helvetica.widthOfTextAtSize(zoomCaptionText, 8);
          currentPage.drawText(zoomCaptionText, {
            x: (pageWidth - zoomCaptionWidth) / 2,
            y: y - 8,
            size: 8,
            font: helvetica,
            color: rgb(colors.secondary.r, colors.secondary.g, colors.secondary.b),
          });
          y -= 15;
        }
      } catch (imgError) {
        console.error("PDF Image Error:", imgError);
        currentPage.drawText("[Image processing failed]", {
          x: margin,
          y: y - 10,
          size: 9,
          font: helvetica,
          color: rgb(colors.danger.r, colors.danger.g, colors.danger.b),
        });
        y -= 15;
      }
    }

    // Separator line
    y -= 10;
    drawLine(y, colors.border, 1);
    y -= 20;
  }

  // ===== 5. BUSINESS RULES =====
  if (processData.businessRulesObserved?.length > 0) {
    addPage();
    drawSectionHeader("4", "Business Rules Observed");

    for (const rule of processData.businessRulesObserved) {
      checkPageBreak(20);
      currentPage.drawText("*  ", {
        x: margin + 10,
        y: y - 11,
        size: 11,
        font: helvetica,
        color: rgb(colors.primary.r, colors.primary.g, colors.primary.b),
      });
      drawText(rule, margin + 25, 11, helvetica, colors.text);
      y -= 5;
    }
  }

  // ===== 6. EXCEPTIONS =====
  if (processData.exceptionsNoted?.length > 0) {
    if (y < pageHeight * 0.3) {
      addPage();
    }
    y -= 30;

    const secNum = processData.businessRulesObserved?.length > 0 ? "5" : "4";
    drawSectionHeader(secNum, "Exceptions Noted");

    for (const exception of processData.exceptionsNoted) {
      checkPageBreak(20);
      currentPage.drawText("! ", {
        x: margin + 10,
        y: y - 11,
        size: 11,
        font: helveticaBold,
        color: rgb(colors.danger.r, colors.danger.g, colors.danger.b),
      });
      drawText(exception, margin + 25, 11, helvetica, colors.text);
      y -= 5;
    }
  }

  // Save the document
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ============================================
// EXPORT ACTIONS
// ============================================

export const generateWordPDD = action({
  args: {
    processId: v.id("processes"),
    customFileName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    storageId?: string;
    downloadUrl?: string;
    fileName?: string;
    error?: string;
  }> => {
    try {
      const processData = await ctx.runQuery(internal.boundingBoxQueries.getProcessExportData, {
        processId: args.processId,
      });

      if (!processData) {
        return { success: false, error: "Process not found" };
      }

      const docBuffer = await createWordDocument(processData);

      const uploadUrl = await ctx.runMutation(internal.internal.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        body: new Uint8Array(docBuffer),
      });

      if (!uploadResponse.ok) {
        return { success: false, error: "Failed to upload document" };
      }

      const { storageId } = await uploadResponse.json();
      const downloadUrl = await ctx.storage.getUrl(storageId);
      const fileName = args.customFileName
        ? `${args.customFileName}.docx`
        : `${processData.processName.replace(/\s+/g, "_").toLowerCase()}_pdd.docx`;

      // Store document reference
      await ctx.runMutation(internal.documents.storeDocument, {
        processId: args.processId,
        storageId: storageId,
        name: fileName,
        format: "docx",
        size: docBuffer.length,
      });

      return { success: true, storageId, downloadUrl: downloadUrl || undefined, fileName };
    } catch (error) {
      console.error("Error generating Word PDD:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

export const generatePdfPDD = action({
  args: {
    processId: v.id("processes"),
    customFileName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    storageId?: string;
    downloadUrl?: string;
    fileName?: string;
    error?: string;
  }> => {
    try {
      const processData = await ctx.runQuery(internal.boundingBoxQueries.getProcessExportData, {
        processId: args.processId,
      });

      if (!processData) {
        return { success: false, error: "Process not found" };
      }

      const pdfBuffer = await createPdfDocument(processData);

      const uploadUrl = await ctx.runMutation(internal.internal.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(pdfBuffer),
      });

      if (!uploadResponse.ok) {
        return { success: false, error: "Failed to upload document" };
      }

      const { storageId } = await uploadResponse.json();
      const downloadUrl = await ctx.storage.getUrl(storageId);
      const fileName = args.customFileName
        ? `${args.customFileName}.pdf`
        : `${processData.processName.replace(/\s+/g, "_").toLowerCase()}_pdd.pdf`;

      // Store document reference
      await ctx.runMutation(internal.documents.storeDocument, {
        processId: args.processId,
        storageId: storageId,
        name: fileName,
        format: "pdf",
        size: pdfBuffer.length,
      });

      return { success: true, storageId, downloadUrl: downloadUrl || undefined, fileName };
    } catch (error) {
      console.error("Error generating PDF PDD:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});
