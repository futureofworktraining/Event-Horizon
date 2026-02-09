/**
 * Analysis Versions - Mutations and Queries
 *
 * Handles version history storage and retrieval for comparing analysis runs.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// ============================================
// QUERIES
// ============================================

/**
 * Get all analysis versions for a job
 */
export const getVersionsForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .collect();

    return versions;
  },
});

/**
 * Get a specific version by ID
 */
export const getVersion = query({
  args: {
    versionId: v.id("analysisVersions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.versionId);
  },
});

/**
 * Get the current version for a job
 */
export const getCurrentVersion = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const currentVersion = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job_current", (q) => q.eq("jobId", args.jobId).eq("isCurrent", true))
      .first();

    return currentVersion;
  },
});

// ============================================
// INTERNAL QUERIES
// ============================================

/**
 * Get the next version number for a job
 */
export const getNextVersionNumber = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const latestVersion = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();

    return latestVersion ? latestVersion.versionNumber + 1 : 1;
  },
});

// ============================================
// INTERNAL MUTATIONS
// ============================================

/**
 * Archive the current analysis state before re-analysis
 */
export const archiveCurrentAnalysis = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    // Get the job
    const job = await ctx.db.get(args.jobId);
    if (!job || !job.processId) {
      throw new Error("Job not found or has no process");
    }

    // Get the main process
    const process = await ctx.db.get(job.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Get all steps for this process
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", job.processId!))
      .collect();

    // Get the flow for this process
    const flow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", job.processId!))
      .first();

    // Mark any existing current versions as not current
    const existingCurrentVersions = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job_current", (q) => q.eq("jobId", args.jobId).eq("isCurrent", true))
      .collect();

    for (const version of existingCurrentVersions) {
      await ctx.db.patch(version._id, { isCurrent: false });
    }

    // Get the next version number
    const latestVersion = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Create the version snapshot
    const versionId = await ctx.db.insert("analysisVersions", {
      jobId: args.jobId,
      versionNumber,
      createdAt: Date.now(),
      processSnapshot: JSON.stringify({
        processName: process.processName,
        processDescription: process.processDescription,
        recordingDurationSeconds: process.recordingDurationSeconds,
        totalSteps: process.totalSteps,
        applications: process.applications,
        businessRulesObserved: process.businessRulesObserved,
        exceptionsNoted: process.exceptionsNoted,
      }),
      stepsSnapshot: JSON.stringify(steps.map((step) => ({
        stepNumber: step.stepNumber,
        timestamp: step.timestamp,
        timestampSeconds: step.timestampSeconds,
        actionType: step.actionType,
        specificAction: step.specificAction,
        description: step.description,
        application: step.application,
        screenName: step.screenName,
        screenshotRequired: step.screenshotRequired,
        uiElement: step.uiElement,
        dataInfo: step.dataInfo,
        waitCondition: step.waitCondition,
        notes: step.notes,
        automationHint: step.automationHint,
      }))),
      flowSnapshot: flow ? JSON.stringify({
        nodes: flow.nodes,
        edges: flow.edges,
      }) : undefined,
      rawAiResponse: job.rawAiResponse,
      totalSteps: steps.length,
      processName: process.processName,
      isCurrent: true, // This will be the current until new analysis completes
    });

    return { versionId, versionNumber };
  },
});

/**
 * Clear existing analysis data for a job (processes, steps, flows)
 */
export const clearJobAnalysisData = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    // Get the job
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Get all processes for this job
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Delete all steps, flows, and processes
    for (const process of processes) {
      // Delete steps
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      for (const step of steps) {
        await ctx.db.delete(step._id);
      }

      // Delete flows
      const flows = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      for (const flow of flows) {
        await ctx.db.delete(flow._id);
      }

      // Delete the process
      await ctx.db.delete(process._id);
    }

    // Reset job to processing state
    await ctx.db.patch(args.jobId, {
      processId: undefined,
      status: "processing",
      progress: 0,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });

    return { deletedProcesses: processes.length };
  },
});

/**
 * Mark the latest version as current after successful re-analysis
 */
export const markVersionAsCurrent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the version to mark as current
    const version = await ctx.db
      .query("analysisVersions")
      .withIndex("by_job_version", (q) =>
        q.eq("jobId", args.jobId).eq("versionNumber", args.versionNumber)
      )
      .first();

    if (version) {
      await ctx.db.patch(version._id, { isCurrent: true });
    }
  },
});

/**
 * Mark job as re-analyzing (keeps existing processId for viewing)
 */
export const markJobReanalyzing = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Set job to processing but KEEP the existing processId
    // This allows users to still view the old data during re-analysis
    await ctx.db.patch(args.jobId, {
      status: "processing",
      progress: 0,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clean up old processes after successful re-analysis
 * Called after new analysis completes to remove orphaned data
 */
export const cleanupOldProcesses = internalMutation({
  args: {
    jobId: v.id("jobs"),
    oldProcessId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    // Get the current job to find the new processId
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Only clean up if the old process is different from the new one
    if (job.processId === args.oldProcessId) {
      console.log("Old and new processId are the same, skipping cleanup");
      return { deletedProcesses: 0 };
    }

    // Get the old process
    const oldProcess = await ctx.db.get(args.oldProcessId);
    if (!oldProcess) {
      return { deletedProcesses: 0 };
    }

    // Get all processes in the old hierarchy (including subprocesses)
    const processesToDelete: typeof args.oldProcessId[] = [args.oldProcessId];

    // Find all subprocesses recursively
    const findSubprocesses = async (parentId: typeof args.oldProcessId) => {
      const subprocesses = await ctx.db
        .query("processes")
        .withIndex("by_parent", (q) => q.eq("parentProcessId", parentId))
        .collect();

      for (const subprocess of subprocesses) {
        processesToDelete.push(subprocess._id);
        await findSubprocesses(subprocess._id);
      }
    };

    await findSubprocesses(args.oldProcessId);

    // Delete all steps, flows, and processes
    for (const processId of processesToDelete) {
      // Delete steps
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", processId))
        .collect();

      for (const step of steps) {
        await ctx.db.delete(step._id);
      }

      // Delete flows
      const flows = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", processId))
        .collect();

      for (const flow of flows) {
        await ctx.db.delete(flow._id);
      }

      // Delete the process
      await ctx.db.delete(processId);
    }

    console.log(`Cleaned up ${processesToDelete.length} old process(es)`);
    return { deletedProcesses: processesToDelete.length };
  },
});

/**
 * Restore job to previous process if re-analysis fails
 */
export const restoreJobProcess = internalMutation({
  args: {
    jobId: v.id("jobs"),
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Restore the job to completed state with the old process
    await ctx.db.patch(args.jobId, {
      status: "completed",
      processId: args.processId,
      progress: 100,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });

    console.log(`Restored job ${args.jobId} to process ${args.processId}`);
  },
});

/**
 * Update job analysis options before re-analysis
 */
export const updateJobAnalysisOptions = internalMutation({
  args: {
    jobId: v.id("jobs"),
    autoExtractScreenshots: v.optional(v.boolean()),
    autoBoundingBoxes: v.optional(v.boolean()),
    autoSensitiveInfo: v.optional(v.boolean()),
    sensitiveInfoPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Build update object with only provided options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.autoExtractScreenshots !== undefined) {
      updates.autoExtractScreenshots = args.autoExtractScreenshots;
    }
    if (args.autoBoundingBoxes !== undefined) {
      updates.autoBoundingBoxes = args.autoBoundingBoxes;
    }
    if (args.autoSensitiveInfo !== undefined) {
      updates.autoSensitiveInfo = args.autoSensitiveInfo;
    }
    if (args.sensitiveInfoPrompt !== undefined) {
      updates.sensitiveInfoPrompt = args.sensitiveInfoPrompt;
    }

    await ctx.db.patch(args.jobId, updates);
    console.log(`Updated job ${args.jobId} analysis options`);
  },
});
