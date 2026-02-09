"use node";

/**
 * Re-analyze Action
 *
 * Handles re-running video analysis with version archiving.
 * Keeps existing data visible during re-analysis for viewing.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";

// ============================================
// ACTIONS
// ============================================

/**
 * Re-analyze a video job
 * Archives the current state, keeps data visible, and triggers new analysis.
 * Old data is only cleaned up after new analysis completes successfully.
 */
export const reanalyzeJob = action({
  args: {
    jobId: v.id("jobs"),
    // Analysis options
    autoExtractScreenshots: v.optional(v.boolean()),
    autoBoundingBoxes: v.optional(v.boolean()),
    autoSensitiveInfo: v.optional(v.boolean()),
    sensitiveInfoPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("=== reanalyzeJob action started ===");
    console.log("Job ID:", args.jobId);
    console.log("Analysis options:", {
      autoExtractScreenshots: args.autoExtractScreenshots,
      autoBoundingBoxes: args.autoBoundingBoxes,
      autoSensitiveInfo: args.autoSensitiveInfo,
    });

    // Get the job to verify it exists and has a video
    const job = await ctx.runQuery(internal.internal.getJobById, { jobId: args.jobId });

    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.videoStorageId) {
      throw new Error("Job has no video to re-analyze");
    }

    if (job.status === "processing") {
      throw new Error("Job is already being processed");
    }

    const oldProcessId = job.processId;

    // Archive current analysis if it exists
    if (oldProcessId) {
      console.log("Archiving current analysis...");
      const archiveResult = await ctx.runMutation(internal.analysisVersions.archiveCurrentAnalysis, {
        jobId: args.jobId,
      });
      console.log(`Created version ${archiveResult.versionNumber}`);
    }

    // Update job with new analysis options
    console.log("Updating job analysis options...");
    await ctx.runMutation(internal.analysisVersions.updateJobAnalysisOptions, {
      jobId: args.jobId,
      autoExtractScreenshots: args.autoExtractScreenshots,
      autoBoundingBoxes: args.autoBoundingBoxes,
      autoSensitiveInfo: args.autoSensitiveInfo,
      sensitiveInfoPrompt: args.sensitiveInfoPrompt,
    });

    // Mark job as re-analyzing (keeps existing processId for viewing)
    console.log("Marking job as re-analyzing...");
    await ctx.runMutation(internal.analysisVersions.markJobReanalyzing, {
      jobId: args.jobId,
    });

    // Trigger new analysis (this will run the existing analyzeVideo action)
    // The analysis will create new processes and update the job's processId when complete
    console.log("Starting new analysis...");
    try {
      await ctx.runAction(api.analyze.analyzeVideo, {
        jobId: args.jobId,
        videoStorageId: job.videoStorageId,
      });

      // After successful analysis, clean up old processes
      if (oldProcessId) {
        console.log("Cleaning up old processes...");
        await ctx.runMutation(internal.analysisVersions.cleanupOldProcesses, {
          jobId: args.jobId,
          oldProcessId: oldProcessId,
        });
      }

      console.log("Re-analysis completed successfully");
      return { success: true };
    } catch (error) {
      // If analysis fails, restore the old processId
      console.error("Re-analysis failed, restoring previous state...");
      if (oldProcessId) {
        await ctx.runMutation(internal.analysisVersions.restoreJobProcess, {
          jobId: args.jobId,
          processId: oldProcessId,
        });
      }
      throw error;
    }
  },
});
