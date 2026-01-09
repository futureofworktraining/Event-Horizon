import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { sensitiveInfoBoxValidator } from "./schema";

// Internal query to get step with screenshot URL
export const getStepWithScreenshot = internalQuery({
  args: { stepId: v.id("steps") },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) return null;

    let screenshotUrl: string | null = null;
    if (step.screenshotStorageId) {
      screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
    }

    return {
      ...step,
      screenshotUrl,
    };
  },
});

// Internal query to get all steps with screenshots for a process
export const getStepsWithScreenshots = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    const stepsWithScreenshots = await Promise.all(
      steps.map(async (step) => {
        let screenshotUrl: string | null = null;
        if (step.screenshotStorageId) {
          screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
        }
        return {
          ...step,
          screenshotUrl,
        };
      })
    );

    return stepsWithScreenshots.filter(s => s.screenshotUrl);
  },
});

// Internal query to get a single step by ID with screenshot URL
export const getStepById = internalQuery({
  args: { stepId: v.id("steps") },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.stepId);
    if (!step) return null;

    let screenshotUrl: string | null = null;
    if (step.screenshotStorageId) {
      screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
    }

    return {
      ...step,
      screenshotUrl,
    };
  },
});

// Internal mutation to update step with bounding box
export const updateStepBoundingBox = internalMutation({
  args: {
    stepId: v.id("steps"),
    boundingBox: v.object({
      label: v.string(),
      box_2d: v.array(v.number()),
      found: v.boolean(),
      masked: v.boolean(),
    }),
    overlayImageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const update: any = {
      boundingBox: args.boundingBox,
      boundingBoxDetected: true,
    };
    if (args.overlayImageStorageId) {
      update.overlayImageStorageId = args.overlayImageStorageId;
    }
    await ctx.db.patch(args.stepId, update);
  },
});

// Internal mutation to update step with sensitive information boxes
export const updateStepSensitiveBoxes = internalMutation({
  args: {
    stepId: v.id("steps"),
    sensitiveBoxes: v.array(sensitiveInfoBoxValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      sensitiveInfoBoxes: args.sensitiveBoxes,
      sensitiveInfoDetected: true,
    });
  },
});

// Get all export data for a process (for PDD export)
// Includes all steps from main process AND all subprocesses/related processes in the same job
export const getProcessExportData = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const selectedProcess = await ctx.db.get(args.processId);
    if (!selectedProcess) return null;

    // Get ALL processes for this job (not just parent-child hierarchy)
    const allProcessesInJob = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", selectedProcess.jobId))
      .collect();

    // Find the main process (isMainProcess=true or no parentProcessId)
    let mainProcess = allProcessesInJob.find(p => p.isMainProcess)
      || allProcessesInJob.find(p => !p.parentProcessId)
      || selectedProcess;

    // Use all processes from the job
    const allProcesses = allProcessesInJob;

    // Sort processes: main process first, then by hierarchy level and name
    allProcesses.sort((a, b) => {
      // Main process always first
      if (a._id === mainProcess._id) return -1;
      if (b._id === mainProcess._id) return 1;

      // Then by hierarchy level
      const levelA = a.hierarchyLevel ?? 1;
      const levelB = b.hierarchyLevel ?? 1;
      if (levelA !== levelB) return levelA - levelB;

      // Then by name
      return a.processName.localeCompare(b.processName);
    });

    // Collect all steps from all processes with process info
    const allStepsWithProcess: any[] = [];

    for (const process of allProcesses) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      steps.sort((a, b) => a.stepNumber - b.stepNumber);

      // Get screenshot and overlay URLs for each step
      const stepsWithUrls = await Promise.all(
        steps.map(async (step) => {
          let screenshotUrl: string | null = null;
          let overlayImageUrl: string | null = null;

          if (step.screenshotStorageId) {
            screenshotUrl = await ctx.storage.getUrl(step.screenshotStorageId);
          }
          if (step.overlayImageStorageId) {
            overlayImageUrl = await ctx.storage.getUrl(step.overlayImageStorageId);
          }

          return {
            ...step,
            screenshotUrl,
            overlayImageUrl,
            // Add process context for each step
            processName: process.processName,
            processHierarchyLevel: process.hierarchyLevel ?? 1,
            isSubprocessStep: process._id !== mainProcess._id,
          };
        })
      );

      allStepsWithProcess.push(...stepsWithUrls);
    }

    // Sort ALL steps by timestampSeconds to maintain chronological order from video
    allStepsWithProcess.sort((a, b) => {
      // Primary sort by timestampSeconds (chronological order)
      const timeA = a.timestampSeconds ?? 0;
      const timeB = b.timestampSeconds ?? 0;
      if (timeA !== timeB) return timeA - timeB;

      // Secondary sort by step number within same timestamp
      return a.stepNumber - b.stepNumber;
    });

    // Get job info for filename
    const job = await ctx.db.get(mainProcess.jobId);

    // Calculate totals
    const totalStepsAllProcesses = allStepsWithProcess.length;
    const subprocessCount = allProcesses.length - 1;

    return {
      ...mainProcess,
      steps: allStepsWithProcess,
      job,
      // Include subprocess info
      subprocesses: allProcesses.slice(1).map(p => ({
        _id: p._id,
        processName: p.processName,
        hierarchyLevel: p.hierarchyLevel ?? 1,
        totalSteps: p.totalSteps,
      })),
      totalStepsAllProcesses,
      subprocessCount,
    };
  },
});
