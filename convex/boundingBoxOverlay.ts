"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import { Jimp } from "jimp";

interface BoundingBoxResult {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  found: boolean;
}

// Build prompt for Gemini
function buildPrompt(
  elementName: string,
  elementType: string,
  locationDescription: string,
  screenRegion: string,
  description: string,
  customPrompt?: string
): string {
  if (customPrompt) {
    return customPrompt;
  }

  return `You are a UI element detector. Find the EXACT bounding box of ONE specific UI element in this screenshot.

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
5. The element type "${elementType}" helps identify - for "text_field" look for an input box, for "button" look for a clickable button, etc.

Return a JSON object:
{
  "label": "${elementName}",
  "box_2d": [ymin, xmin, ymax, xmax],
  "found": true
}

Where box_2d coordinates are normalized to 0-1000 scale (0=top/left, 1000=bottom/right).

If the element cannot be found, return:
{"label": "${elementName}", "box_2d": [0, 0, 0, 0], "found": false}

Return ONLY the JSON object, no other text.`;
}

// Detect bounding box and overlay it on the screenshot
export const detectAndOverlay = action({
  args: {
    stepId: v.id("steps"),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    boundingBox?: BoundingBoxResult;
    overlayImageStorageId?: string;
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

    // Get the step with screenshot
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

      // Clone for resizing (keep original for later)
      const resizedImage = image.clone();
      if (scale < 1) {
        resizedImage.resize({ w: Math.round(originalWidth * scale), h: Math.round(originalHeight * scale) });
      }

      const resizedBuffer = await resizedImage.getBuffer("image/png");
      const base64Image = resizedBuffer.toString("base64");

      // Build prompt
      const prompt = buildPrompt(
        uiElement.elementName,
        uiElement.elementType,
        uiElement.locationDescription,
        uiElement.screenRegion,
        step.description,
        args.customPrompt
      );

      // Call Gemini 2.5 Flash with thinking disabled for spatial tasks
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

      // Parse response
      let boundingBox: BoundingBoxResult;
      try {
        const parsed = JSON.parse(responseText);
        boundingBox = {
          label: String(parsed.label || uiElement.elementName),
          box_2d: Array.isArray(parsed.box_2d) ? parsed.box_2d.map(Number) : [0, 0, 0, 0],
          found: parsed.found !== false,
        };
      } catch (parseError) {
        return { success: false, error: "Failed to parse AI response: " + responseText.substring(0, 200) };
      }

      // Validate coordinates
      if (boundingBox.box_2d.length !== 4 || boundingBox.box_2d.some(isNaN)) {
        boundingBox.box_2d = [0, 0, 0, 0];
        boundingBox.found = false;
      }

      if (!boundingBox.found) {
        return { success: true, boundingBox, error: "Element not found in screenshot" };
      }

      // Use original image dimensions for overlay
      const width = originalWidth;
      const height = originalHeight;

      // Convert normalized coordinates (0-1000) to pixels
      const [ymin, xmin, ymax, xmax] = boundingBox.box_2d;
      const boxX = Math.round((xmin / 1000) * width);
      const boxY = Math.round((ymin / 1000) * height);
      const boxWidth = Math.round(((xmax - xmin) / 1000) * width);
      const boxHeight = Math.round(((ymax - ymin) / 1000) * height);

      // Choose color based on sensitivity (Jimp uses hex number format)
      const strokeColor = isSensitive ? 0xdc2626ff : 0x22c55eff;
      const fillColor = isSensitive ? 0xdc2626d9 : 0x22c55e26; // with alpha
      const strokeWidth = 3;

      // Draw bounding box overlay using Jimp
      const overlayImage = image.clone();

      // Draw filled rectangle (semi-transparent)
      for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
        for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
          if (x >= 0 && y >= 0) {
            const currentColor = overlayImage.getPixelColor(x, y);
            // Blend colors - simple alpha blending
            overlayImage.setPixelColor(fillColor, x, y);
          }
        }
      }

      // Draw border (stroke)
      for (let i = 0; i < strokeWidth; i++) {
        // Top border
        for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
          if (boxY + i >= 0 && boxY + i < height && x >= 0) {
            overlayImage.setPixelColor(strokeColor, x, boxY + i);
          }
        }
        // Bottom border
        for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
          if (boxY + boxHeight - 1 - i >= 0 && boxY + boxHeight - 1 - i < height && x >= 0) {
            overlayImage.setPixelColor(strokeColor, x, boxY + boxHeight - 1 - i);
          }
        }
        // Left border
        for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
          if (boxX + i >= 0 && boxX + i < width && y >= 0) {
            overlayImage.setPixelColor(strokeColor, boxX + i, y);
          }
        }
        // Right border
        for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
          if (boxX + boxWidth - 1 - i >= 0 && boxX + boxWidth - 1 - i < width && y >= 0) {
            overlayImage.setPixelColor(strokeColor, boxX + boxWidth - 1 - i, y);
          }
        }
      }

      const overlayBuffer = await overlayImage.getBuffer("image/jpeg", { quality: 90 });

      // Upload the overlay image to storage
      const uploadUrl = await ctx.runMutation(internal.internal.generateUploadUrl, {});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: new Uint8Array(overlayBuffer),
      });

      if (!uploadResponse.ok) {
        return { success: false, error: "Failed to upload overlay image" };
      }

      const { storageId } = await uploadResponse.json();

      // Update the step with bounding box data and overlay image
      await ctx.runMutation(internal.boundingBoxQueries.updateStepBoundingBox, {
        stepId: args.stepId,
        boundingBox: {
          ...boundingBox,
          masked: isSensitive,
        },
        overlayImageStorageId: storageId,
      });

      return {
        success: true,
        boundingBox,
        overlayImageStorageId: storageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Get the default prompt for a step (for editing in UI)
export const getDefaultPrompt = action({
  args: {
    stepId: v.id("steps"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    prompt?: string;
    error?: string;
  }> => {
    const step = await ctx.runQuery(internal.boundingBoxQueries.getStepById, {
      stepId: args.stepId,
    });

    if (!step) {
      return { success: false, error: "Step not found" };
    }

    if (!step.uiElement) {
      return { success: false, error: "Step has no UI element" };
    }

    const uiElement = step.uiElement as {
      elementName: string;
      elementType: string;
      locationDescription: string;
      screenRegion: string;
    };

    const prompt = buildPrompt(
      uiElement.elementName,
      uiElement.elementType,
      uiElement.locationDescription,
      uiElement.screenRegion,
      step.description
    );

    return { success: true, prompt };
  },
});
