"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Clone screenshot from another step (action because we need storage.get/store)
export const cloneScreenshotFromStep = action({
  args: {
    targetStepId: v.id("steps"),
    sourceStepId: v.id("steps"),
  },
  handler: async (ctx, args) => {
    // Get source step to check for screenshot
    const sourceStep = await ctx.runQuery(internal.boundingBoxQueries.getStepById, {
      stepId: args.sourceStepId,
    });

    if (!sourceStep) {
      throw new Error("Source step not found");
    }

    if (!sourceStep.screenshotStorageId) {
      throw new Error("Source step has no screenshot");
    }

    // Get the source screenshot blob
    const sourceBlob = await ctx.storage.get(sourceStep.screenshotStorageId);
    if (!sourceBlob) {
      throw new Error("Source screenshot not found in storage");
    }

    // Upload as new file (creates a copy)
    const newStorageId = await ctx.storage.store(sourceBlob);

    // Update target step with new screenshot using internal mutation
    await ctx.runMutation(internal.steps.updateStepScreenshotInternal, {
      stepId: args.targetStepId,
      screenshotStorageId: newStorageId,
    });

    return { success: true };
  },
});
