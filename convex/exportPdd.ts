"use node";

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
import PDFDocument from "pdfkit";
import { Jimp } from "jimp";

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
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

// Draw bounding box on image
async function drawBoundingBox(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  box: number[],
  color: number,
  strokeWidth: number = 3,
  label?: string
): Promise<void> {
  const [ymin, xmin, ymax, xmax] = box;
  const width = image.width;
  const height = image.height;

  // Convert normalized coordinates (0-1000) to pixels
  const boxX = Math.round((xmin / 1000) * width);
  const boxY = Math.round((ymin / 1000) * height);
  const boxWidth = Math.round(((xmax - xmin) / 1000) * width);
  const boxHeight = Math.round(((ymax - ymin) / 1000) * height);

  // Draw border
  for (let i = 0; i < strokeWidth; i++) {
    // Top border
    for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
      if (boxY + i >= 0 && boxY + i < height && x >= 0) {
        image.setPixelColor(color, x, boxY + i);
      }
    }
    // Bottom border
    for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
      if (boxY + boxHeight - 1 - i >= 0 && boxY + boxHeight - 1 - i < height && x >= 0) {
        image.setPixelColor(color, x, boxY + boxHeight - 1 - i);
      }
    }
    // Left border
    for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
      if (boxX + i >= 0 && boxX + i < width && y >= 0) {
        image.setPixelColor(color, boxX + i, y);
      }
    }
    // Right border
    for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
      if (boxX + boxWidth - 1 - i >= 0 && boxX + boxWidth - 1 - i < width && y >= 0) {
        image.setPixelColor(color, boxX + boxWidth - 1 - i, y);
      }
    }
  }

  // Draw label background if provided
  if (label) {
    const labelHeight = 20;
    const labelY = Math.max(0, boxY - labelHeight - 2);
    const labelWidth = Math.min(label.length * 8 + 10, boxWidth);

    // Draw label background
    for (let y = labelY; y < labelY + labelHeight && y < height; y++) {
      for (let x = boxX; x < boxX + labelWidth && x < width; x++) {
        if (x >= 0 && y >= 0) {
          image.setPixelColor(color, x, y);
        }
      }
    }
  }
}

// Create overview image with all bounding boxes
async function createOverviewImage(
  screenshotBuffer: Buffer,
  boundingBox?: BoundingBox,
  sensitiveBoxes?: SensitiveInfoBox[],
  maxWidth: number = 550
): Promise<Buffer> {
  const image = await Jimp.read(screenshotBuffer);

  // Draw main bounding box (green)
  if (boundingBox?.found && boundingBox.box_2d?.length === 4) {
    const greenColor = 0x22c55eff; // Green with full alpha
    await drawBoundingBox(image, boundingBox.box_2d, greenColor, 4, boundingBox.label);
  }

  // Draw sensitive info boxes (red)
  if (sensitiveBoxes?.length) {
    const redColor = 0xef4444ff; // Red with full alpha
    for (const box of sensitiveBoxes) {
      if (box.found && box.box_2d?.length === 4) {
        await drawBoundingBox(image, box.box_2d, redColor, 3, box.label);
      }
    }
  }

  // Resize if needed
  if (image.width > maxWidth) {
    const scale = maxWidth / image.width;
    image.resize({ w: maxWidth, h: Math.round(image.height * scale) });
  }

  return await image.getBuffer("image/jpeg", { quality: 90 });
}

// Create zoomed-in cropped image of the UI element
async function createZoomInImage(
  screenshotBuffer: Buffer,
  boundingBox: BoundingBox,
  maxWidth: number = 400
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

  // Resize if needed
  if (image.width > maxWidth) {
    const scale = maxWidth / image.width;
    image.resize({ w: maxWidth, h: Math.round(image.height * scale) });
  }

  return await image.getBuffer("image/jpeg", { quality: 90 });
}

// Process step screenshots - returns overview and zoom-in images
async function processStepImages(
  screenshotUrl: string | null,
  boundingBox?: BoundingBox,
  sensitiveBoxes?: SensitiveInfoBox[]
): Promise<StepImages> {
  const result: StepImages = {};

  if (!screenshotUrl) return result;

  const screenshotBuffer = await fetchImageAsBuffer(screenshotUrl);
  if (!screenshotBuffer) return result;

  // Create overview with bounding boxes
  result.overview = await createOverviewImage(screenshotBuffer, boundingBox, sensitiveBoxes, 550);

  // Create zoom-in of UI element if bounding box exists
  if (boundingBox?.found) {
    result.zoomIn = await createZoomInImage(screenshotBuffer, boundingBox, 350) ?? undefined;
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
          type: "jpg",
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
    const images = await processStepImages(
      step.screenshotUrl,
      step.boundingBox as BoundingBox,
      step.sensitiveInfoBoxes as SensitiveInfoBox[]
    );

    if (images.overview) {
      try {
        const overviewImg = await Jimp.read(images.overview);
        const overviewRatio = overviewImg.height / overviewImg.width;
        const overviewWidth = 550;
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

        // Overview image
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
          const zoomWidth = Math.min(350, zoomImg.width);
          const zoomHeight = Math.round(zoomWidth * zoomRatio);

          children.push(...createImageWithCaption(
            images.zoomIn,
            zoomWidth,
            zoomHeight,
            "Detail - Zoomed view of the UI element"
          ));
        }
      } catch {
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
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
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
// PDF DOCUMENT GENERATION (Simplified)
// ============================================

async function createPdfDocument(processData: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        bufferPages: true,
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100;

      // Calculate totals
      const totalSteps = processData.totalStepsAllProcesses || processData.steps?.length || processData.totalSteps || 0;
      const subprocessCount = processData.subprocessCount || 0;

      // Cover page
      doc.moveDown(6);
      doc.fontSize(32).fillColor("#2563eb").text(processData.processName, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(18).fillColor("#64748b").text("Process Design Document", { align: "center" });
      doc.moveDown(2);
      doc.fontSize(12).fillColor("#94a3b8").text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
      if (processData.job?.fileName) {
        doc.moveDown(0.3);
        doc.text(`Source: ${processData.job.fileName}`, { align: "center" });
      }
      doc.moveDown(0.3);
      doc.text(`Total Steps: ${totalSteps}${subprocessCount > 0 ? ` (including ${subprocessCount} subprocesses)` : ""}`, { align: "center" });

      // Process Overview
      doc.addPage();
      doc.fontSize(20).fillColor("#1e293b").text("1. Process Overview");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#334155").text(processData.processDescription || "No description provided.");
      doc.moveDown(0.5);

      // Subprocess list if any
      if (processData.subprocesses?.length > 0) {
        doc.fontSize(12).fillColor("#1e293b").text("Included Subprocesses:");
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#64748b");
        for (const subprocess of processData.subprocesses) {
          const indent = "  ".repeat((subprocess.hierarchyLevel || 1) - 1);
          doc.text(`${indent}• ${subprocess.processName} (${subprocess.totalSteps} steps)`);
        }
        doc.moveDown(0.5);
      }
      doc.moveDown(0.5);

      // Steps
      doc.fontSize(20).fillColor("#1e293b").text("2. Step-by-Step Documentation");
      doc.moveDown(0.5);

      // Track process changes for headers
      let currentProcessName: string | null = null;
      let globalStepNumber = 0;

      for (const step of processData.steps || []) {
        if (doc.y > doc.page.height - 300) {
          doc.addPage();
        }

        // Add subprocess header if process changes
        if (step.processName !== currentProcessName) {
          currentProcessName = step.processName;
          const processStepCount = (processData.steps || []).filter(
            (s: any) => s.processName === currentProcessName
          ).length;

          if (subprocessCount > 0) {
            doc.moveDown(0.5);
            if (step.isSubprocessStep || step.processHierarchyLevel > 1) {
              // Subprocess header (indigo)
              doc.fillColor("#4f46e5").fontSize(14)
                .text(`${currentProcessName} (${processStepCount} steps)`, { underline: true });
            } else {
              // Main process header (green)
              doc.fillColor("#22c55e").fontSize(14)
                .text(`${currentProcessName} - Main Process (${processStepCount} steps)`, { underline: true });
            }
            doc.moveDown(0.3);
          }
        }

        globalStepNumber++;

        // Step header with global number
        const stepLabel = subprocessCount > 0
          ? `Step ${globalStepNumber} (${step.processName} #${step.stepNumber})`
          : `Step ${step.stepNumber}`;

        doc.fontSize(14).fillColor("#2563eb").text(`${stepLabel}: `, { continued: true })
           .fillColor("#1e293b").text(step.description || "No description");
        doc.moveDown(0.3);

        // Step details
        doc.fontSize(9).fillColor("#64748b");
        doc.text(`Action: ${step.actionType} - ${step.specificAction}  |  Application: ${step.application}`);
        if (step.uiElement) {
          doc.text(`UI Element: ${step.uiElement.elementName} (${step.uiElement.elementType})`);
        }
        doc.moveDown(0.5);

        // Screenshots
        const images = await processStepImages(
          step.screenshotUrl,
          step.boundingBox as BoundingBox,
          step.sensitiveInfoBoxes as SensitiveInfoBox[]
        );

        if (images.overview) {
          try {
            const img = await Jimp.read(images.overview);
            const imgWidth = Math.min(pageWidth, 450);
            const imgHeight = imgWidth * (img.height / img.width);

            if (doc.y + imgHeight > doc.page.height - 80) {
              doc.addPage();
            }

            doc.image(images.overview, { fit: [imgWidth, imgHeight], align: "center" });
            doc.moveDown(0.3);
            doc.fontSize(8).fillColor("#94a3b8").text("Overview screenshot with highlighted UI element", { align: "center" });

            // Zoom-in
            if (images.zoomIn) {
              doc.moveDown(0.3);
              const zoomImg = await Jimp.read(images.zoomIn);
              const zoomWidth = Math.min(300, pageWidth * 0.6);
              const zoomHeight = zoomWidth * (zoomImg.height / zoomImg.width);

              if (doc.y + zoomHeight > doc.page.height - 80) {
                doc.addPage();
              }

              doc.image(images.zoomIn, { fit: [zoomWidth, zoomHeight], align: "center" });
              doc.moveDown(0.2);
              doc.text("Detail view of UI element", { align: "center" });
            }
          } catch {
            doc.text("[Screenshot could not be loaded]", { align: "center" });
          }
        }

        doc.moveDown(1);
      }

      // Business Rules
      if (processData.businessRulesObserved?.length > 0) {
        doc.addPage();
        doc.fontSize(20).fillColor("#1e293b").text("3. Business Rules Observed");
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor("#334155");
        for (const rule of processData.businessRulesObserved) {
          doc.text(`• ${rule}`);
          doc.moveDown(0.3);
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
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

      return { success: true, storageId, downloadUrl: downloadUrl || undefined, fileName };
    } catch (error) {
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

      return { success: true, storageId, downloadUrl: downloadUrl || undefined, fileName };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});
