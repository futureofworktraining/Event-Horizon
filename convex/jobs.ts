import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate upload URL for Convex file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create a new job after video upload
export const createJob = mutation({
  args: {
    videoStorageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    // Analysis options
    autoExtractScreenshots: v.optional(v.boolean()),
    autoBoundingBoxes: v.optional(v.boolean()),
    autoSensitiveInfo: v.optional(v.boolean()),
    sensitiveInfoPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      videoStorageId: args.videoStorageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      // Analysis options (default to true for backwards compatibility)
      autoExtractScreenshots: args.autoExtractScreenshots ?? true,
      autoBoundingBoxes: args.autoBoundingBoxes ?? true,
      autoSensitiveInfo: args.autoSensitiveInfo ?? false,
      sensitiveInfoPrompt: args.sensitiveInfoPrompt,
    });
    return jobId;
  },
});

// Update job status
export const updateJobStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    processId: v.optional(v.id("processes")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      errorMessage: args.errorMessage,
      processId: args.processId,
      updatedAt: Date.now(),
    });
  },
});

// Update job progress
export const updateJobProgress = mutation({
  args: {
    jobId: v.id("jobs"),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
  },
});

// List jobs with optional status filter
export const listJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    if (args.search) {
      return await ctx.db
        .query("jobs")
        .withSearchIndex("search_filename", (q) =>
          q.search("fileName", args.search!)
        )
        .take(limit);
    }

    let jobs;
    if (args.status) {
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else {
      jobs = await ctx.db
        .query("jobs")
        .withIndex("by_created")
        .order("desc")
        .take(limit);
    }

    return jobs;
  },
});

// Get a single job by ID
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Get video URL for a job
export const getVideoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Update step screenshot after client-side extraction
export const updateStepScreenshot = mutation({
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

// Get steps without screenshots for a process (for client-side extraction)
export const getStepsNeedingScreenshots = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    // Return only steps that need screenshots and don't have them yet
    return steps
      .filter((step) => step.screenshotRequired && !step.screenshotStorageId)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({
        _id: step._id,
        stepNumber: step.stepNumber,
        timestamp: step.timestamp,
        timestampSeconds: step.timestampSeconds,
      }));
  },
});

// Update job (rename file)
export const updateJob = mutation({
  args: {
    jobId: v.id("jobs"),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.fileName !== undefined) {
      updates.fileName = args.fileName;
    }

    await ctx.db.patch(args.jobId, updates);
    return { success: true };
  },
});

// Get all processes for a job (flat list including subprocesses)
export const getAllProcessesFlat = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    return allProcesses.map((p) => ({
      _id: p._id,
      processName: p.processName,
      parentProcessId: p.parentProcessId,
    }));
  },
});

// Get steps needing bounding box detection for a process
export const getStepsNeedingBoundingBoxes = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    // Return steps that have screenshots AND uiElement AND haven't been detected yet
    return steps
      .filter((step) =>
        step.screenshotStorageId &&
        step.uiElement &&
        !step.boundingBoxDetected
      )
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step) => ({
        _id: step._id,
        stepNumber: step.stepNumber,
        uiElementType: step.uiElement?.elementType,
      }));
  },
});

// Get all steps needing screenshots across all processes in a job
export const getAllStepsNeedingScreenshots = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const allSteps: Array<{
      stepId: string;
      processId: string;
      processName: string;
      stepNumber: number;
      timestamp: string;
      timestampSeconds: number;
    }> = [];

    for (const process of allProcesses) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      const stepsNeedingScreenshots = steps
        .filter((s) => s.screenshotRequired && !s.screenshotStorageId)
        .sort((a, b) => a.stepNumber - b.stepNumber);

      for (const step of stepsNeedingScreenshots) {
        allSteps.push({
          stepId: step._id,
          processId: process._id,
          processName: process.processName,
          stepNumber: step.stepNumber,
          timestamp: step.timestamp,
          timestampSeconds: step.timestampSeconds ?? 0,
        });
      }
    }

    return allSteps;
  },
});

// Get all steps needing bounding box detection across all processes in a job
export const getAllStepsNeedingBoundingBoxes = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const allSteps: Array<{
      stepId: string;
      processId: string;
      processName: string;
      stepNumber: number;
      uiElementType: string;
    }> = [];

    for (const process of allProcesses) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      const stepsNeedingBoundingBoxes = steps
        .filter((s) => s.screenshotStorageId && s.uiElement && !s.boundingBoxDetected)
        .sort((a, b) => a.stepNumber - b.stepNumber);

      for (const step of stepsNeedingBoundingBoxes) {
        allSteps.push({
          stepId: step._id,
          processId: process._id,
          processName: process.processName,
          stepNumber: step.stepNumber,
          uiElementType: step.uiElement?.elementType ?? "unknown",
        });
      }
    }

    return allSteps;
  },
});

// Get all steps needing sensitive info detection across all processes in a job
export const getAllStepsNeedingSensitiveInfo = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const allSteps: Array<{
      stepId: string;
      processId: string;
      processName: string;
      stepNumber: number;
      customPrompt?: string;
    }> = [];

    const job = await ctx.db.get(args.jobId);

    for (const process of allProcesses) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      // Only steps with screenshots and NOT YET detected sensitive info
      const stepsNeedingSensitiveInfo = steps
        .filter((s) => s.screenshotStorageId && !s.sensitiveInfoDetected)
        .sort((a, b) => a.stepNumber - b.stepNumber);

      for (const step of stepsNeedingSensitiveInfo) {
        allSteps.push({
          stepId: step._id,
          processId: process._id,
          processName: process.processName,
          stepNumber: step.stepNumber,
          customPrompt: job?.sensitiveInfoPrompt ?? process.sensitiveInfoPrompt,
        });
      }
    }

    return allSteps;
  },
});

// Get processing status for all processes in a job (for orchestrator)
export const getJobProcessingStatus = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const processStatuses = await Promise.all(
      allProcesses.map(async (process) => {
        const steps = await ctx.db
          .query("steps")
          .withIndex("by_process", (q) => q.eq("processId", process._id))
          .collect();

        const stepsNeedingScreenshots = steps.filter(
          (s) => s.screenshotRequired && !s.screenshotStorageId
        ).length;

        const stepsWithScreenshots = steps.filter(
          (s) => s.screenshotStorageId
        ).length;

        const stepsNeedingBoundingBoxes = steps.filter(
          (s) => s.screenshotStorageId && s.uiElement && !s.boundingBoxDetected
        ).length;

        const stepsWithBoundingBoxes = steps.filter(
          (s) => s.boundingBoxDetected
        ).length;

        // Steps that have a screenshot but haven't been checked for sensitive info yet
        const stepsNeedingSensitiveInfo = steps.filter(
          (s) => s.screenshotStorageId && !s.sensitiveInfoDetected
        ).length;

        const stepsWithSensitiveInfo = steps.filter(
          (s) => s.sensitiveInfoDetected
        ).length;

        return {
          processId: process._id,
          processName: process.processName,
          parentProcessId: process.parentProcessId,
          totalSteps: steps.length,
          stepsNeedingScreenshots,
          stepsWithScreenshots,
          stepsNeedingBoundingBoxes,
          stepsWithBoundingBoxes,
          stepsNeedingSensitiveInfo,
          stepsWithSensitiveInfo,
        };
      })
    );

    return {
      job: {
        _id: job._id,
        status: job.status,
        videoStorageId: job.videoStorageId,
        autoExtractScreenshots: job.autoExtractScreenshots ?? true,
        autoBoundingBoxes: job.autoBoundingBoxes ?? true,
        autoSensitiveInfo: job.autoSensitiveInfo ?? false,
        sensitiveInfoPrompt: job.sensitiveInfoPrompt,
      },
      processes: processStatuses,
      totals: {
        totalScreenshotsNeeded: processStatuses.reduce((sum, p) => sum + p.stepsNeedingScreenshots, 0),
        totalScreenshotsComplete: processStatuses.reduce((sum, p) => sum + p.stepsWithScreenshots, 0),
        totalBoundingBoxesNeeded: processStatuses.reduce((sum, p) => sum + p.stepsNeedingBoundingBoxes, 0),
        totalBoundingBoxesComplete: processStatuses.reduce((sum, p) => sum + p.stepsWithBoundingBoxes, 0),
        totalSensitiveInfoNeeded: processStatuses.reduce((sum, p) => sum + p.stepsNeedingSensitiveInfo, 0),
        totalSensitiveInfoComplete: processStatuses.reduce((sum, p) => sum + p.stepsWithSensitiveInfo, 0),
      },
    };
  },
});

// Delete a job and all associated data
export const deleteJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // If job has a process, delete it and all its steps
    if (job.processId) {
      const process = await ctx.db.get(job.processId);
      if (process) {
        // Get all steps for this process
        const steps = await ctx.db
          .query("steps")
          .withIndex("by_process", (q) => q.eq("processId", job.processId!))
          .collect();

        // Delete all step screenshots from storage
        for (const step of steps) {
          if (step.screenshotStorageId) {
            await ctx.storage.delete(step.screenshotStorageId);
          }
          await ctx.db.delete(step._id);
        }

        // Delete the process
        await ctx.db.delete(job.processId);
      }
    }

    // Delete the video from storage
    if (job.videoStorageId) {
      await ctx.storage.delete(job.videoStorageId);
    }

    // Delete the job
    await ctx.db.delete(args.jobId);

    return { success: true };
  },
});
