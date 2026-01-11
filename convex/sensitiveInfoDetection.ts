/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import { Jimp } from "jimp";
import { sensitiveInfoBoxValidator } from "./schema";

interface SensitiveInfoBox {
  label: string;
  box_2d: number[];
  found: boolean;
  confidence?: number;
}

// Build prompt for detecting sensitive information in screenshots
function buildSensitiveDetectionPrompt(
  userDefinition: string,
  stepDescription: string
): string {
  return `You are a sensitive information detector for RPA documentation.

USER'S SENSITIVE INFO DEFINITION:
${userDefinition}

STEP CONTEXT:
${stepDescription}

TASK: Find ALL instances of sensitive information matching the definition above in this screenshot.
For EACH instance found, return a bounding box with:
- The type of sensitive info detected (e.g., "SSN", "Credit Card Number", "Password", etc.)
- The exact location as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale (0=top/left, 1000=bottom/right)
- A confidence score 0-1 indicating how confident you are this is the sensitive info

Return a JSON object:
{
  "sensitive_boxes": [
    {
      "label": "SSN",
      "box_2d": [100, 200, 150, 400],
      "found": true,
      "confidence": 0.95
    },
    {
      "label": "Credit Card Number",
      "box_2d": [300, 100, 350, 600],
      "found": true,
      "confidence": 0.92
    }
  ]
}

If no sensitive information found, return:
{"sensitive_boxes": []}

Return ONLY the JSON object, no other text or markdown formatting.`;
}

// Public action to detect sensitive information for all steps in a process
export const detectSensitiveInformation = action({
  args: {
    processId: v.id("processes"),
    customPrompt: v.optional(v.string()), // Override saved prompt if provided
    forceRedetect: v.optional(v.boolean()), // If true, re-detect even if already detected
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    processed: number;
    skipped: number;
    failed: number;
    total: number;
    errors: string[];
  }> => {
    // Get process to retrieve sensitiveInfoPrompt
    const processData = await ctx.runQuery(api.processes.getProcess, {
      processId: args.processId,
    });

    if (!processData) {
      return {
        success: false,
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        errors: ["Process not found"],
      };
    }

    // Use provided prompt or saved prompt from process
    const userPrompt = args.customPrompt || processData.sensitiveInfoPrompt;

    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      return {
        success: false,
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        errors: [error instanceof Error ? error.message : "Failed to retrieve API key"],
      };
    }
    if (!apiKey) {
      return {
        success: false,
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        errors: ["Gemini API key not configured. Please set it in Settings."],
      };
    }

    if (!userPrompt) {
      return {
        success: false,
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        errors: ["No sensitive information prompt defined for this process"],
      };
    }

    // Get all steps with screenshots
    const steps = await ctx.runQuery(
      internal.boundingBoxQueries.getStepsWithScreenshots,
      {
        processId: args.processId,
      }
    );

    const forceRedetect = args.forceRedetect ?? false;

    // Filter to only steps that:
    // 1. Have a screenshot
    // 2. Haven't been processed yet (unless forceRedetect is true)
    const stepsToProcess = steps.filter(
      (s) => s.screenshotUrl && (forceRedetect || !s.sensitiveInfoDetected)
    );

    const total = stepsToProcess.length;
    const skipped = steps.length - total;

    if (total === 0) {
      return {
        success: true,
        processed: 0,
        skipped,
        failed: 0,
        total: 0,
        errors:
          skipped > 0
            ? [`${skipped} step(s) skipped - already detected or no screenshot`]
            : [],
      };
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    const ai = new GoogleGenAI({ apiKey });

    for (const step of stepsToProcess) {
      try {
        // Fetch the screenshot image
        const imageResponse = await fetch(step.screenshotUrl!);
        if (!imageResponse.ok) {
          failed++;
          errors.push(`Step ${step.stepNumber}: Failed to fetch screenshot`);
          continue;
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Resize image to max 640px as recommended by Google for bounding box detection
        const maxSize = 640;
        const image = await Jimp.read(imageBuffer);
        const originalWidth = image.width;
        const originalHeight = image.height;
        const scale = Math.min(
          maxSize / originalWidth,
          maxSize / originalHeight,
          1
        );

        if (scale < 1) {
          image.resize({
            w: Math.round(originalWidth * scale),
            h: Math.round(originalHeight * scale),
          });
        }

        const resizedBuffer = await image.getBuffer("image/png");
        const base64Image = resizedBuffer.toString("base64");

        // Build sensitive detection prompt
        const prompt = buildSensitiveDetectionPrompt(
          userPrompt,
          step.description
        );

        // Generate sensitive information detection using Gemini 2.5 Flash
        const startTime = Date.now();
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: base64Image,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for spatial tasks
          },
        });

        // Log call
        await ctx.runMutation(internal.apiLogs.logApiCall, {
          model: "gemini-2.5-flash",
          category: "sensitive_info",
          source: "sensitiveInfoDetection.ts",
          promptTokens: result.usageMetadata?.promptTokenCount || 0,
          completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
          durationMs: Date.now() - startTime,
          status: "success",
          processId: args.processId,
        });

        let responseText: string = result.text || "";
        if (!responseText) {
          failed++;
          errors.push(`Step ${step.stepNumber}: Empty response from AI`);
          continue;
        }

        // Handle markdown code blocks in response
        if (responseText.includes("```json")) {
          responseText = responseText
            .split("```json")[1]
            .split("```")[0]
            .trim();
        } else if (responseText.includes("```")) {
          responseText = responseText.split("```")[1].split("```")[0].trim();
        }

        // Parse the response
        let sensitiveBoxes: SensitiveInfoBox[] = [];
        try {
          const parsed = JSON.parse(responseText);
          if (
            Array.isArray(parsed.sensitive_boxes) &&
            parsed.sensitive_boxes.length > 0
          ) {
            sensitiveBoxes = parsed.sensitive_boxes.map(
              (box: any) => ({
                label: String(box.label || "Sensitive Info"),
                box_2d: Array.isArray(box.box_2d)
                  ? box.box_2d.map(Number)
                  : [0, 0, 0, 0],
                found: box.found !== false,
                confidence:
                  typeof box.confidence === "number"
                    ? Math.max(0, Math.min(1, box.confidence))
                    : undefined,
              })
            );
          }
        } catch (parseError) {
          failed++;
          errors.push(`Step ${step.stepNumber}: Failed to parse response`);
          continue;
        }

        // Validate bounding box coordinates
        sensitiveBoxes = sensitiveBoxes.filter((box) => {
          if (box.box_2d.length !== 4 || box.box_2d.some(isNaN)) {
            return false;
          }
          return true;
        });

        // Save sensitive boxes to the step (empty array if none found)
        await ctx.runMutation(
          internal.boundingBoxQueries.updateStepSensitiveBoxes,
          {
            stepId: step._id,
            sensitiveBoxes,
          }
        );

        processed++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        failed++;
        errors.push(
          `Step ${step.stepNumber}: ${error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (skipped > 0) {
      errors.push(
        `${skipped} step(s) skipped - already detected or no screenshot`
      );
    }

    return {
      success: failed === 0,
      processed,
      skipped,
      failed,
      total,
      errors,
    };
  },
});

// Public action to detect sensitive boxes for a single step with custom prompt
export const detectSensitiveBoxesSingleStep = action({
  args: {
    stepId: v.id("steps"),
    customPrompt: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; boxes: SensitiveInfoBox[]; error?: string }> => {
    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      return {
        success: false,
        boxes: [],
        error: error instanceof Error ? error.message : "Failed to retrieve API key",
      };
    }
    if (!apiKey) {
      return {
        success: false,
        boxes: [],
        error: "Gemini API key not configured. Please set it in Settings.",
      };
    }

    // Get step with screenshot
    const step = await ctx.runQuery(
      internal.boundingBoxQueries.getStepWithScreenshot,
      { stepId: args.stepId }
    );

    if (!step || !step.screenshotUrl) {
      return { success: false, boxes: [], error: "Step or screenshot not found" };
    }

    try {
      // Fetch the screenshot image
      const imageResponse = await fetch(step.screenshotUrl);
      if (!imageResponse.ok) {
        return { success: false, boxes: [], error: "Failed to fetch screenshot" };
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Resize image to max 640px
      const maxSize = 640;
      const image = await Jimp.read(imageBuffer);
      const originalWidth = image.width;
      const originalHeight = image.height;
      const scale = Math.min(
        maxSize / originalWidth,
        maxSize / originalHeight,
        1
      );

      if (scale < 1) {
        image.resize({
          w: Math.round(originalWidth * scale),
          h: Math.round(originalHeight * scale),
        });
      }

      const resizedBuffer = await image.getBuffer("image/png");
      const base64Image = resizedBuffer.toString("base64");

      // Build prompt
      const prompt = buildSensitiveDetectionPrompt(
        args.customPrompt,
        step.description
      );

      // Call Gemini
      const ai = new GoogleGenAI({ apiKey });
      const startTime = Date.now();
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      // Log call
      await ctx.runMutation(internal.apiLogs.logApiCall, {
        model: "gemini-2.5-flash",
        category: "sensitive_info",
        source: "sensitiveInfoDetection.ts",
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
        durationMs: Date.now() - startTime,
        status: "success",
        processId: step.processId,
      });

      let responseText: string = result.text || "";

      // Handle markdown code blocks
      if (responseText.includes("```json")) {
        responseText = responseText
          .split("```json")[1]
          .split("```")[0]
          .trim();
      } else if (responseText.includes("```")) {
        responseText = responseText.split("```")[1].split("```")[0].trim();
      }

      // Parse response
      let sensitiveBoxes: SensitiveInfoBox[] = [];
      try {
        const parsed = JSON.parse(responseText);
        if (
          Array.isArray(parsed.sensitive_boxes) &&
          parsed.sensitive_boxes.length > 0
        ) {
          sensitiveBoxes = parsed.sensitive_boxes
            .map((box: any): SensitiveInfoBox => ({
              label: String(box.label || "Sensitive Info"),
              box_2d: Array.isArray(box.box_2d)
                ? box.box_2d.map(Number)
                : [0, 0, 0, 0],
              found: box.found !== false,
              confidence:
                typeof box.confidence === "number"
                  ? Math.max(0, Math.min(1, box.confidence))
                  : undefined,
            }))
            .filter(
              (box: SensitiveInfoBox) =>
                box.box_2d.length === 4 && !box.box_2d.some(isNaN)
            );
        }
      } catch (parseError) {
        return {
          success: false,
          boxes: [],
          error: "Failed to parse AI response",
        };
      }

      // Save boxes to step
      await ctx.runMutation(
        internal.boundingBoxQueries.updateStepSensitiveBoxes,
        {
          stepId: args.stepId,
          sensitiveBoxes,
        }
      );

      return { success: true, boxes: sensitiveBoxes };
    } catch (error) {
      return {
        success: false,
        boxes: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
