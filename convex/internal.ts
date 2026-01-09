import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal query to get a job by ID
export const getJobById = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Internal mutation to create process (metadata only)
export const createProcess = internalMutation({
  args: {
    jobId: v.id("jobs"),
    processName: v.string(),
    processDescription: v.string(),
    recordingDurationSeconds: v.number(),
    totalSteps: v.number(),
    applications: v.array(v.object({
      name: v.string(),
      type: v.string(),
      url: v.optional(v.string()),
      version: v.optional(v.string()),
    })),
    businessRulesObserved: v.optional(v.array(v.string())),
    exceptionsNoted: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const processId = await ctx.db.insert("processes", {
      jobId: args.jobId,
      processName: args.processName,
      processDescription: args.processDescription,
      recordingDurationSeconds: args.recordingDurationSeconds,
      totalSteps: args.totalSteps,
      applications: args.applications as any,
      businessRulesObserved: args.businessRulesObserved,
      exceptionsNoted: args.exceptionsNoted,
      createdAt: Date.now(),
    });

    return processId;
  },
});

// Internal mutation to create a step
export const createStep = internalMutation({
  args: {
    processId: v.id("processes"),
    stepNumber: v.number(),
    timestamp: v.string(),
    timestampSeconds: v.number(),
    actionType: v.string(),
    specificAction: v.string(),
    description: v.string(),
    application: v.string(),
    screenName: v.string(),
    screenshotRequired: v.boolean(),
    screenshotStorageId: v.optional(v.id("_storage")),
    uiElement: v.optional(v.any()),
    dataInfo: v.optional(v.any()),
    waitCondition: v.optional(v.any()),
    notes: v.optional(v.string()),
    automationHint: v.optional(v.string()),
    flowNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stepId = await ctx.db.insert("steps", {
      processId: args.processId,
      stepNumber: args.stepNumber,
      timestamp: args.timestamp,
      timestampSeconds: args.timestampSeconds,
      actionType: args.actionType as any,
      specificAction: args.specificAction as any,
      description: args.description,
      application: args.application,
      screenName: args.screenName,
      screenshotRequired: args.screenshotRequired,
      screenshotStorageId: args.screenshotStorageId,
      uiElement: args.uiElement,
      dataInfo: args.dataInfo,
      waitCondition: args.waitCondition,
      notes: args.notes,
      automationHint: args.automationHint,
      flowNodeId: args.flowNodeId,
    });

    return stepId;
  },
});

// Internal mutation to update step with screenshot
export const updateStepScreenshot = internalMutation({
  args: {
    stepId: v.id("steps"),
    screenshotStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      screenshotStorageId: args.screenshotStorageId,
    });
  },
});

// Internal mutation to complete job
export const completeJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      processId: args.processId,
      progress: 100,
      updatedAt: Date.now(),
    });
  },
});

// Internal mutation to update job status
export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    rawAiResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Build patch object with only provided fields to avoid overwriting existing values
    const patch: Record<string, any> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.progress !== undefined) {
      patch.progress = args.progress;
    }
    if (args.errorMessage !== undefined) {
      patch.errorMessage = args.errorMessage;
    }
    if (args.rawAiResponse !== undefined) {
      patch.rawAiResponse = args.rawAiResponse;
    }

    await ctx.db.patch(args.jobId, patch);
  },
});

// Generate upload URL for screenshots
export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
