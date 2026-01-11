/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  actionTypeValidator,
  specificActionValidator,
  uiElementValidator,
  dataInfoValidator,
  waitConditionValidator,
  sensitiveInfoBoxValidator,
} from "./schema";

// Get a single step with screenshot URL
export const getStep = query({
  args: { stepId: v.id("steps") },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) return null;

    let screenshotUrl: string | null = null;
    if (step.screenshotStorageId) {
      screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
    }

    let overlayImageUrl: string | null = null;
    if (step.overlayImageStorageId) {
      overlayImageUrl = await ctx.storage.getUrl(step.overlayImageStorageId);
    }

    return {
      ...step,
      screenshotUrl,
      overlayImageUrl,
    };
  },
});

// Update a step's basic fields
export const updateStep = mutation({
  args: {
    stepId: v.id("steps"),
    // Basic fields
    description: v.optional(v.string()),
    application: v.optional(v.string()),
    screenName: v.optional(v.string()),
    timestamp: v.optional(v.string()),
    timestampSeconds: v.optional(v.number()),
    actionType: v.optional(actionTypeValidator),
    specificAction: v.optional(specificActionValidator),
    screenshotRequired: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    automationHint: v.optional(v.string()),
    // Complex fields - passed as any and validated
    uiElement: v.optional(v.any()),
    dataInfo: v.optional(v.any()),
    waitCondition: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { stepId, ...updates } = args;

    const step = await ctx.db.get(stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    // Filter out undefined values
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        // Handle null values for optional fields (to clear them)
        if (value === null) {
          filteredUpdates[key] = undefined;
        } else {
          filteredUpdates[key] = value;
        }
      }
    }

    // Reset bounding box detection if UI element changed
    if (filteredUpdates.uiElement !== undefined) {
      filteredUpdates.boundingBoxDetected = false;
      filteredUpdates.boundingBox = undefined;
      filteredUpdates.overlayImageStorageId = undefined;
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(stepId, filteredUpdates);
    }

    return { success: true };
  },
});

// Update step's screenshot
export const updateStepScreenshot = mutation({
  args: {
    stepId: v.id("steps"),
    screenshotStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    // Delete old screenshot if exists
    if (step.screenshotStorageId) {
      await ctx.storage.delete(step.screenshotStorageId);
    }

    // Delete old overlay if exists
    if (step.overlayImageStorageId) {
      await ctx.storage.delete(step.overlayImageStorageId);
    }

    await ctx.db.patch(args.stepId, {
      screenshotStorageId: args.screenshotStorageId,
      // Reset bounding box since screenshot changed
      boundingBoxDetected: false,
      boundingBox: undefined,
      overlayImageStorageId: undefined,
    });

    return { success: true };
  },
});

// Internal mutation for updating step screenshot with cleanup
export const updateStepScreenshotInternal = internalMutation({
  args: {
    stepId: v.id("steps"),
    screenshotStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    // Delete old screenshot if exists
    if (step.screenshotStorageId) {
      await ctx.storage.delete(step.screenshotStorageId);
    }

    // Delete old overlay if exists
    if (step.overlayImageStorageId) {
      await ctx.storage.delete(step.overlayImageStorageId);
    }

    await ctx.db.patch(args.stepId, {
      screenshotStorageId: args.screenshotStorageId,
      boundingBoxDetected: false,
      boundingBox: undefined,
      overlayImageStorageId: undefined,
    });

    return { success: true };
  },
});

// Update step's crop coordinates (for non-destructive cropping)
export const updateStepCrop = mutation({
  args: {
    stepId: v.id("steps"),
    cropCoordinates: v.union(
      v.object({
        x: v.number(),      // Left edge (0-1000 normalized)
        y: v.number(),      // Top edge (0-1000 normalized)
        width: v.number(),  // Width (0-1000 normalized)
        height: v.number(), // Height (0-1000 normalized)
      }),
      v.null() // Allow clearing crop
    ),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    await ctx.db.patch(args.stepId, {
      cropCoordinates: args.cropCoordinates ?? undefined,
    });

    return { success: true };
  },
});

// Add a new step at a specific position
export const addStep = mutation({
  args: {
    processId: v.id("processes"),
    afterStepNumber: v.optional(v.number()), // Insert after this step number, or at beginning if not provided
    // Required fields
    timestamp: v.string(),
    timestampSeconds: v.number(),
    actionType: actionTypeValidator,
    specificAction: specificActionValidator,
    description: v.string(),
    application: v.string(),
    screenName: v.string(),
    screenshotRequired: v.boolean(),
    // Optional fields
    screenshotStorageId: v.optional(v.id("_storage")),
    uiElement: v.optional(v.any()),
    dataInfo: v.optional(v.any()),
    waitCondition: v.optional(v.any()),
    notes: v.optional(v.string()),
    automationHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { processId, afterStepNumber, ...stepData } = args;

    const process = await ctx.db.get(processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Get all existing steps
    const existingSteps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", processId))
      .collect();

    // Sort by step number
    existingSteps.sort((a, b) => a.stepNumber - b.stepNumber);

    // Calculate new step number
    let newStepNumber: number;
    if (afterStepNumber === undefined || afterStepNumber === 0) {
      // Insert at beginning
      newStepNumber = 1;
    } else {
      // Insert after the specified step
      newStepNumber = afterStepNumber + 1;
    }

    // Increment step numbers for all steps at or after the new position
    for (const step of existingSteps) {
      if (step.stepNumber >= newStepNumber) {
        await ctx.db.patch(step._id, {
          stepNumber: step.stepNumber + 1,
        });
      }
    }

    // Create the new step
    const stepId = await ctx.db.insert("steps", {
      processId,
      stepNumber: newStepNumber,
      timestamp: stepData.timestamp,
      timestampSeconds: stepData.timestampSeconds,
      actionType: stepData.actionType,
      specificAction: stepData.specificAction,
      description: stepData.description,
      application: stepData.application,
      screenName: stepData.screenName,
      screenshotRequired: stepData.screenshotRequired,
      screenshotStorageId: stepData.screenshotStorageId,
      uiElement: stepData.uiElement,
      dataInfo: stepData.dataInfo,
      waitCondition: stepData.waitCondition,
      notes: stepData.notes,
      automationHint: stepData.automationHint,
    });

    // Update process total steps count
    await ctx.db.patch(processId, {
      totalSteps: existingSteps.length + 1,
    });

    return { success: true, stepId, stepNumber: newStepNumber };
  },
});

// Delete a step and reorder remaining steps
export const deleteStep = mutation({
  args: {
    stepId: v.id("steps"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const processId = step.processId;
    const deletedStepNumber = step.stepNumber;

    // Delete screenshot if exists
    if (step.screenshotStorageId) {
      await ctx.storage.delete(step.screenshotStorageId);
    }

    // Delete overlay image if exists
    if (step.overlayImageStorageId) {
      await ctx.storage.delete(step.overlayImageStorageId);
    }

    // Delete the step
    await ctx.db.delete(args.stepId);

    // Get remaining steps and reorder
    const remainingSteps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", processId))
      .collect();

    // Decrement step numbers for all steps after the deleted one
    for (const s of remainingSteps) {
      if (s.stepNumber > deletedStepNumber) {
        await ctx.db.patch(s._id, {
          stepNumber: s.stepNumber - 1,
        });
      }
    }

    // Update process total steps count
    const process = await ctx.db.get(processId);
    if (process) {
      await ctx.db.patch(processId, {
        totalSteps: remainingSteps.length,
      });
    }

    return { success: true };
  },
});

// Move step to new position
export const moveStep = mutation({
  args: {
    stepId: v.id("steps"),
    newStepNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const oldStepNumber = step.stepNumber;
    const newStepNumber = args.newStepNumber;

    if (oldStepNumber === newStepNumber) {
      return { success: true };
    }

    // Get all steps for this process
    const allSteps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", step.processId))
      .collect();

    // Validate new position
    if (newStepNumber < 1 || newStepNumber > allSteps.length) {
      throw new Error("Invalid step number");
    }

    // Reorder steps
    if (oldStepNumber < newStepNumber) {
      // Moving down - decrement steps in between
      for (const s of allSteps) {
        if (s.stepNumber > oldStepNumber && s.stepNumber <= newStepNumber) {
          await ctx.db.patch(s._id, {
            stepNumber: s.stepNumber - 1,
          });
        }
      }
    } else {
      // Moving up - increment steps in between
      for (const s of allSteps) {
        if (s.stepNumber >= newStepNumber && s.stepNumber < oldStepNumber) {
          await ctx.db.patch(s._id, {
            stepNumber: s.stepNumber + 1,
          });
        }
      }
    }

    // Update the moved step
    await ctx.db.patch(args.stepId, {
      stepNumber: newStepNumber,
    });

    return { success: true };
  },
});

// Get all steps for a process (for cloning screenshot dropdown and step cloning)
export const getStepsForProcess = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    steps.sort((a, b) => a.stepNumber - b.stepNumber);

    // Get screenshot URLs and return full step data for cloning
    const stepsWithScreenshots = await Promise.all(
      steps.map(async (step) => {
        let screenshotUrl: string | null = null;
        if (step.screenshotStorageId) {
          screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
        }
        return {
          _id: step._id,
          stepNumber: step.stepNumber,
          description: step.description,
          hasScreenshot: !!step.screenshotStorageId,
          screenshotUrl,
          // Additional fields for cloning functionality
          application: step.application,
          screenName: step.screenName,
          actionType: step.actionType,
          specificAction: step.specificAction,
          screenshotRequired: step.screenshotRequired,
          automationHint: step.automationHint,
          uiElement: step.uiElement,
          dataInfo: step.dataInfo,
        };
      })
    );

    return stepsWithScreenshots;
  },
});

// Get video URL for a process (via job)
export const getVideoForProcess = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) return null;

    const job = await ctx.db.get(process.jobId);
    if (!job || !job.videoStorageId) return null;

    const videoUrl = await ctx.storage.getUrl(job.videoStorageId);

    return {
      videoUrl,
      fileName: job.fileName,
      recordingDurationSeconds: process.recordingDurationSeconds,
    };
  },
});

// Generate upload URL (public version for client uploads)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Update bounding box manually (for manual drawing)
export const updateBoundingBox = mutation({
  args: {
    stepId: v.id("steps"),
    boundingBox: v.object({
      label: v.string(),
      box_2d: v.array(v.number()),
      found: v.boolean(),
      masked: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    await ctx.db.patch(args.stepId, {
      boundingBox: args.boundingBox,
      boundingBoxDetected: true,
    });

    return { success: true };
  },
});

// Add a single sensitive info box manually
export const addSensitiveBox = mutation({
  args: {
    stepId: v.id("steps"),
    sensitiveBox: sensitiveInfoBoxValidator,
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const existingBoxes = step.sensitiveInfoBoxes || [];
    // Ensure the new box has a unique ID
    const newBox = {
      ...args.sensitiveBox,
      id: args.sensitiveBox.id || Math.random().toString(36).substring(2, 11),
    };
    const updatedBoxes = [...existingBoxes, newBox];

    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: updatedBoxes,
      sensitiveInfoDetected: true,
    });

    return { success: true, boxCount: updatedBoxes.length, boxId: newBox.id };
  },
});

// Remove a sensitive info box by index
export const removeSensitiveBox = mutation({
  args: {
    stepId: v.id("steps"),
    boxIndex: v.optional(v.number()),
    boxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const existingBoxes = step.sensitiveInfoBoxes || [];
    let updatedBoxes: any[];

    if (args.boxId) {
      updatedBoxes = existingBoxes.filter((box) => box.id !== args.boxId);
      if (updatedBoxes.length === existingBoxes.length && args.boxIndex === undefined) {
        // If boxId was provided but not found, and no index provided, return success anyway (already deleted)
        return { success: true, boxCount: existingBoxes.length };
      }
    }

    // Fallback to index if boxId not found or not provided
    if (args.boxId === undefined || (args.boxId && updatedBoxes!.length === existingBoxes.length)) {
      if (args.boxIndex !== undefined) {
        if (args.boxIndex < 0 || args.boxIndex >= existingBoxes.length) {
          // Instead of throwing, just return current state if index is invalid
          // This avoids frontend crashes durante rapid interactions
          return { success: true, boxCount: existingBoxes.length };
        }
        updatedBoxes = existingBoxes.filter((_, idx) => idx !== args.boxIndex);
      } else {
        return { success: true, boxCount: existingBoxes.length };
      }
    }

    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: updatedBoxes!.length > 0 ? updatedBoxes! : undefined,
      sensitiveInfoDetected: updatedBoxes!.length > 0,
    });

    return { success: true, boxCount: updatedBoxes!.length };
  },
});

// Clear all bounding boxes (UI element box)
export const clearBoundingBox = mutation({
  args: {
    stepId: v.id("steps"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    await ctx.db.patch(args.stepId, {
      boundingBox: undefined,
      boundingBoxDetected: false,
      overlayImageStorageId: undefined,
    });

    return { success: true };
  },
});

// Clear all sensitive info boxes
export const clearSensitiveBoxes = mutation({
  args: {
    stepId: v.id("steps"),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: undefined,
      sensitiveInfoDetected: false,
    });

    return { success: true };
  },
});

// Update a specific sensitive box by index (for resizing)
export const updateSensitiveBox = mutation({
  args: {
    stepId: v.id("steps"),
    boxIndex: v.optional(v.number()),
    boxId: v.optional(v.string()),
    box_2d: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const existingBoxes = step.sensitiveInfoBoxes || [];
    let updatedBoxes: any[];

    if (args.boxId) {
      updatedBoxes = existingBoxes.map((box) =>
        box.id === args.boxId ? { ...box, box_2d: args.box_2d } : box
      );
    } else if (args.boxIndex !== undefined) {
      if (args.boxIndex < 0 || args.boxIndex >= existingBoxes.length) {
        throw new Error("Invalid box index");
      }
      updatedBoxes = existingBoxes.map((box, idx) =>
        idx === args.boxIndex ? { ...box, box_2d: args.box_2d } : box
      );
    } else {
      throw new Error("Either boxId or boxIndex must be provided");
    }

    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: updatedBoxes,
    });

    return { success: true };
  },
});

// Update a sensitive box label by index
export const updateSensitiveBoxLabel = mutation({
  args: {
    stepId: v.id("steps"),
    boxIndex: v.optional(v.number()),
    boxId: v.optional(v.string()),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    const existingBoxes = step.sensitiveInfoBoxes || [];
    let updatedBoxes: any[];

    if (args.boxId) {
      updatedBoxes = existingBoxes.map((box) =>
        box.id === args.boxId ? { ...box, label: args.label } : box
      );
    } else if (args.boxIndex !== undefined) {
      if (args.boxIndex < 0 || args.boxIndex >= existingBoxes.length) {
        throw new Error("Invalid box index");
      }
      updatedBoxes = existingBoxes.map((box, idx) =>
        idx === args.boxIndex ? { ...box, label: args.label } : box
      );
    } else {
      throw new Error("Either boxId or boxIndex must be provided");
    }

    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: updatedBoxes,
    });

    return { success: true };
  },
});

// Update UI element properties without resetting bounding box
export const updateUiElement = mutation({
  args: {
    stepId: v.id("steps"),
    uiElement: v.any(),
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) {
      throw new Error("Step not found");
    }

    // Update UI element without touching the bounding box
    await ctx.db.patch(args.stepId, {
      uiElement: args.uiElement,
    });

    return { success: true };
  },
});
