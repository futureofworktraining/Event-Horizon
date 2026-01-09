"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import { Jimp } from "jimp";

// Function to build a targeted prompt for finding a specific UI element
function buildTargetedPrompt(
  elementName: string,
  elementType: string,
  locationDescription: string,
  screenRegion: string,
  description: string,
  customInstructions?: string
): string {
  let prompt = `You are a UI element detector. Find the EXACT bounding box of ONE specific UI element in this screenshot.

TARGET ELEMENT TO FIND:
- Element name/label: "${elementName}"
- Element type: ${elementType}
- Location description: ${locationDescription}
- Screen region: ${screenRegion}
- User action context: ${description}

IMPORTANT INSTRUCTIONS:
1. Look for a visible label or text that says "${elementName}" or similar
2. The bounding box should cover the INTERACTIVE element itself (input field, button, etc.), NOT the label
3. If there are multiple similar elements (e.g., multiple text fields), use the label text to identify the correct one
4. For input fields: look for the label text ABOVE or BESIDE the input, then select that specific input field
5. The element type "${elementType}" helps identify - for "text_field" look for an input box, for "button" look for a clickable button, etc.`;

  if (customInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions}`;
  }

  prompt += `\n\nReturn a JSON object:
{
  "label": "${elementName}",
  "box_2d": [ymin, xmin, ymax, xmax],
  "found": true
}

Where box_2d coordinates are normalized to 0-1000 scale (0=top/left, 1000=bottom/right).

If the element cannot be found, return:
{"label": "${elementName}", "box_2d": [0, 0, 0, 0], "found": false}

Return ONLY the JSON object, no other text.`;

  return prompt;
}

interface BoundingBoxResult {
  label: string;
  box_2d: number[];
  found: boolean;
  masked: boolean;
}

// Public action to detect bounding boxes for all steps in a process
export const detectBoundingBoxes = action({
  args: {
    processId: v.id("processes"),
    forceRedetect: v.optional(v.boolean()), // If true, re-detect even if already detected
    customPrompt: v.optional(v.string()), // Optional custom instructions
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    skipped: number;
    failed: number;
    total: number;
    errors: string[];
  }> => {
    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      return { success: false, processed: 0, skipped: 0, failed: 0, total: 0, errors: [error instanceof Error ? error.message : "Failed to retrieve API key"] };
    }
    if (!apiKey) {
      return { success: false, processed: 0, skipped: 0, failed: 0, total: 0, errors: ["Gemini API key not configured. Please set it in Settings."] };
    }

    const steps = await ctx.runQuery(internal.boundingBoxQueries.getStepsWithScreenshots, {
      processId: args.processId,
    });

    const forceRedetect = args.forceRedetect ?? false;
    const customPrompt = args.customPrompt;

    // Filter to only steps that:
    // 1. Have a screenshot
    // 2. Haven't been processed yet (unless forceRedetect is true)
    // 3. Have a uiElement defined (we need to know what to look for)
    const stepsToProcess = steps.filter(s =>
      s.screenshotUrl &&
      (forceRedetect || !s.boundingBoxDetected) &&
      s.uiElement
    );


    const stepsWithoutUiElement = steps.filter(s =>
      s.screenshotUrl &&
      (forceRedetect || !s.boundingBoxDetected) &&
      !s.uiElement
    );

    const total = stepsToProcess.length;
    const skipped = stepsWithoutUiElement.length;

    if (total === 0) {
      return {
        success: true,
        processed: 0,
        skipped,
        failed: 0,
        total: 0,
        errors: skipped > 0 ? [`${skipped} step(s) skipped - no UI element defined`] : []
      };
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    const ai = new GoogleGenAI({ apiKey });

    for (const step of stepsToProcess) {
      try {
        const uiElement = step.uiElement as {
          elementName: string;
          elementType: string;
          locationDescription: string;
          screenRegion: string;
        };

        // Check if data is sensitive
        const isSensitive = step.dataInfo?.isSensitive === true;

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
        const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight, 1);

        if (scale < 1) {
          image.resize({ w: Math.round(originalWidth * scale), h: Math.round(originalHeight * scale) });
        }

        const resizedBuffer = await image.getBuffer("image/png");
        const base64Image = resizedBuffer.toString("base64");

        // Build targeted prompt
        const prompt = buildTargetedPrompt(
          uiElement.elementName,
          uiElement.elementType,
          uiElement.locationDescription,
          uiElement.screenRegion,
          step.description,
          customPrompt
        );

        // Generate bounding box using Gemini 2.5 Flash with thinking disabled
        // as recommended for spatial understanding tasks
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
          category: "bounding_boxes",
          source: "boundingBoxes.ts",
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
          responseText = responseText.split("```json")[1].split("```")[0].trim();
        } else if (responseText.includes("```")) {
          responseText = responseText.split("```")[1].split("```")[0].trim();
        }

        // Parse the response
        let boundingBox: BoundingBoxResult;
        try {
          const parsed = JSON.parse(responseText);
          boundingBox = {
            label: String(parsed.label || uiElement.elementName),
            box_2d: Array.isArray(parsed.box_2d) ? parsed.box_2d.map(Number) : [0, 0, 0, 0],
            found: parsed.found !== false,
            masked: isSensitive, // Mark as masked if data is sensitive
          };
        } catch (parseError) {
          failed++;
          errors.push(`Step ${step.stepNumber}: Failed to parse response`);
          continue;
        }

        // Validate bounding box coordinates
        if (boundingBox.box_2d.length !== 4 || boundingBox.box_2d.some(isNaN)) {
          boundingBox.box_2d = [0, 0, 0, 0];
          boundingBox.found = false;
        }

        // Save bounding box to the step
        await ctx.runMutation(internal.boundingBoxQueries.updateStepBoundingBox, {
          stepId: step._id,
          boundingBox,
        });

        processed++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        failed++;
        errors.push(`Step ${step.stepNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (skipped > 0) {
      errors.push(`${skipped} step(s) skipped - no UI element defined`);
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

// Detect bounding box for a single step with custom prompt
export const detectSingleBoundingBox = action({
  args: {
    stepId: v.id("steps"),
    customPrompt: v.optional(v.string()), // Optional custom prompt to override default
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    boundingBox?: BoundingBoxResult;
  }> => {
    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to retrieve API key" };
    }
    if (!apiKey) {
      return { success: false, error: "Gemini API key not configured. Please set it in Settings." };
    }

    // Get the step
    const step = await ctx.runQuery(internal.boundingBoxQueries.getStepById, {
      stepId: args.stepId,
    });

    if (!step) {
      return { success: false, error: "Step not found" };
    }

    if (!step.screenshotUrl) {
      return { success: false, error: "Step has no screenshot" };
    }

    if (!step.uiElement) {
      return { success: false, error: "Step has no UI element defined" };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const uiElement = step.uiElement as {
        elementName: string;
        elementType: string;
        locationDescription: string;
        screenRegion: string;
      };

      // Check if data is sensitive
      const isSensitive = step.dataInfo?.isSensitive === true;

      // Fetch the screenshot image
      const imageResponse = await fetch(step.screenshotUrl);
      if (!imageResponse.ok) {
        return { success: false, error: "Failed to fetch screenshot" };
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Resize image to max 640px as recommended by Google for bounding box detection
      const maxSize = 640;
      const image = await Jimp.read(imageBuffer);
      const originalWidth = image.width;
      const originalHeight = image.height;
      const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight, 1);

      if (scale < 1) {
        image.resize({ w: Math.round(originalWidth * scale), h: Math.round(originalHeight * scale) });
      }

      const resizedBuffer = await image.getBuffer("image/png");
      const base64Image = resizedBuffer.toString("base64");

      // Build targeted prompt
      const prompt = buildTargetedPrompt(
        uiElement.elementName,
        uiElement.elementType,
        uiElement.locationDescription,
        uiElement.screenRegion,
        step.description
      );

      // Call Gemini 
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
        category: "bounding_boxes",
        source: "boundingBoxes.ts",
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        completionTokens: result.usageMetadata?.candidatesTokenCount || 0,
        durationMs: Date.now() - startTime,
        status: "success",
        processId: step.processId,
      });

      let responseText: string = result.text || "";
      if (!responseText) {
        return { success: false, error: "Empty response from AI" };
      }

      // Handle markdown code blocks in response
      if (responseText.includes("```json")) {
        responseText = responseText.split("```json")[1].split("```")[0].trim();
      } else if (responseText.includes("```")) {
        responseText = responseText.split("```")[1].split("```")[0].trim();
      }

      // Parse the response
      let boundingBox: BoundingBoxResult;
      try {
        const parsed = JSON.parse(responseText);
        boundingBox = {
          label: String(parsed.label || uiElement.elementName),
          box_2d: Array.isArray(parsed.box_2d) ? parsed.box_2d.map(Number) : [0, 0, 0, 0],
          found: parsed.found !== false,
          masked: isSensitive,
        };
      } catch (parseError) {
        return { success: false, error: "Failed to parse AI response" };
      }

      // Validate bounding box coordinates
      if (boundingBox.box_2d.length !== 4 || boundingBox.box_2d.some(isNaN)) {
        boundingBox.box_2d = [0, 0, 0, 0];
        boundingBox.found = false;
      }

      // Save bounding box to the step
      await ctx.runMutation(internal.boundingBoxQueries.updateStepBoundingBox, {
        stepId: args.stepId,
        boundingBox,
      });

      return { success: true, boundingBox };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
