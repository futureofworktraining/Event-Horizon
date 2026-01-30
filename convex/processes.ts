/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal query for use in actions (like analyze.ts)
export const getProcessInternal = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.processId);
  },
});

// Get a single process by ID with job information and steps
export const getProcess = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      return null;
    }

    // Get associated job for status info
    const job = await ctx.db.get(process.jobId);

    // Get all steps for this process
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    // Sort steps by stepNumber
    steps.sort((a, b) => a.stepNumber - b.stepNumber);

    // Get screenshot URLs for each step
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

    return {
      ...process,
      job,
      steps: stepsWithScreenshots,
    };
  },
});

// Get process by job ID
export const getProcessByJobId = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const process = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!process) {
      return null;
    }

    // Get all steps for this process
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", process._id))
      .collect();

    // Sort steps by stepNumber
    steps.sort((a, b) => a.stepNumber - b.stepNumber);

    // Get screenshot URLs for each step
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

    return {
      ...process,
      steps: stepsWithScreenshots,
    };
  },
});

// List all processes
export const listProcesses = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const processes = await ctx.db
      .query("processes")
      .order("desc")
      .take(limit);

    // Get jobs for each process
    const processesWithJobs = await Promise.all(
      processes.map(async (process) => {
        const job = await ctx.db.get(process.jobId);
        return {
          ...process,
          job,
        };
      })
    );

    return processesWithJobs;
  },
});

// Get steps for a process (separate query for pagination if needed)
export const getSteps = query({
  args: {
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    // Sort by stepNumber
    steps.sort((a, b) => a.stepNumber - b.stepNumber);

    // Get screenshot URLs
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

    return stepsWithScreenshots;
  },
});

// Update process metadata
export const updateProcess = mutation({
  args: {
    processId: v.id("processes"),
    processName: v.optional(v.string()),
    processDescription: v.optional(v.string()),
    businessRulesObserved: v.optional(v.array(v.string())),
    exceptionsNoted: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { processId, ...updates } = args;

    const process = await ctx.db.get(processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Filter out undefined values
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(processId, filteredUpdates);
    }

    return { success: true };
  },
});

// Delete a process and all associated data
export const deleteProcess = mutation({
  args: {
    processId: v.id("processes"),
    deleteVideo: v.optional(v.boolean()), // Also delete the source video
  },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Get all steps for this process
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

    // Delete all step screenshots from storage
    for (const step of steps) {
      if (step.screenshotStorageId) {
        await ctx.storage.delete(step.screenshotStorageId);
      }
      // Delete the step
      await ctx.db.delete(step._id);
    }

    // Get the job to optionally delete video
    const job = await ctx.db.get(process.jobId);

    // Delete the process
    await ctx.db.delete(args.processId);

    // Optionally delete the video and job
    if (args.deleteVideo && job) {
      if (job.videoStorageId) {
        await ctx.storage.delete(job.videoStorageId);
      }
      await ctx.db.delete(job._id);
    } else if (job) {
      // Just update the job to remove processId reference
      await ctx.db.patch(job._id, {
        processId: undefined,
      });
    }

    return {
      success: true,
      deletedSteps: steps.length,
      deletedVideo: args.deleteVideo ?? false,
    };
  },
});

// Shared handler for getting process prompts
async function getProcessPromptsHandler(ctx: any, args: { processId: any }) {
  console.log("getProcessPrompts called for:", args.processId);

  const currentProcess = await ctx.db.get(args.processId);
  if (!currentProcess) {
    console.log("Process not found:", args.processId);
    return null;
  }

  let sensitiveInfoPrompt = currentProcess.sensitiveInfoPrompt;
  let boundingBoxPrompt = currentProcess.boundingBoxPrompt;

  // If prompts are missing, check hierarchy
  let ptr = currentProcess;
  let depth = 0;
  const MAX_DEPTH = 10; // Prevent infinite loops

  while ((!sensitiveInfoPrompt || !boundingBoxPrompt) && ptr.parentProcessId && depth < MAX_DEPTH) {
    depth++;
    const parent = await ctx.db.get(ptr.parentProcessId);
    if (!parent) break;

    if (!sensitiveInfoPrompt && parent.sensitiveInfoPrompt) {
      sensitiveInfoPrompt = parent.sensitiveInfoPrompt;
    }
    if (!boundingBoxPrompt && parent.boundingBoxPrompt) {
      boundingBoxPrompt = parent.boundingBoxPrompt;
    }

    // Prevent cycles
    if (ptr._id === parent._id) break;

    ptr = parent;
  }

  return {
    processId: args.processId,
    sensitiveInfoPrompt: sensitiveInfoPrompt ?? null,
    boundingBoxPrompt: boundingBoxPrompt ?? null,
    // Analysis prompt IDs
    systemPromptId: currentProcess.systemPromptId ?? null,
    userPromptId: currentProcess.userPromptId ?? null,
    jsonSchemaId: currentProcess.jsonSchemaId ?? null,
  };
}

// Query to get process with prompts (supporting inheritance from parent)
export const getProcessPrompts = query({
  args: { processId: v.id("processes") },
  handler: getProcessPromptsHandler,
});

export const getProcessWithSensitivePrompt = query({
  args: { processId: v.id("processes") },
  handler: getProcessPromptsHandler,
});

// Mutation to save/update sensitive info prompt
export const updateSensitiveInfoPrompt = mutation({
  args: {
    processId: v.id("processes"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    await ctx.db.patch(args.processId, {
      sensitiveInfoPrompt: args.prompt,
    });

    return { success: true };
  },
});

// Mutation to save/update bounding box prompt
export const updateBoundingBoxPrompt = mutation({
  args: {
    processId: v.id("processes"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    await ctx.db.patch(args.processId, {
      boundingBoxPrompt: args.prompt,
    });

    return { success: true };
  },
});

// Mutation to set analysis prompts for a process (for re-analysis)
export const setProcessPrompts = mutation({
  args: {
    processId: v.id("processes"),
    systemPromptId: v.id("systemPrompts"),
    userPromptId: v.id("userPrompts"),
    jsonSchemaId: v.id("jsonSchemas"),
  },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    await ctx.db.patch(args.processId, {
      systemPromptId: args.systemPromptId,
      userPromptId: args.userPromptId,
      jsonSchemaId: args.jsonSchemaId,
    });

    return { success: true };
  },
});

// ============================================
// PROMPT CONFIGURATION
// ============================================

/**
 * Set the prompt configuration for a process
 * Used when user selects a different prompt from the dropdown on the process page
 * before re-analyzing
 */
export const setPromptConfiguration = mutation({
  args: {
    processId: v.id("processes"),
    promptConfigurationId: v.union(v.id("promptConfigurations"), v.null()),
  },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Verify the prompt configuration exists (if not null)
    if (args.promptConfigurationId) {
      const config = await ctx.db.get(args.promptConfigurationId);
      if (!config) {
        throw new Error("Prompt configuration not found");
      }
      if (!config.isActive) {
        throw new Error("Prompt configuration is not active");
      }
    }

    await ctx.db.patch(args.processId, {
      promptConfigurationId: args.promptConfigurationId ?? undefined,
    });

    return { success: true };
  },
});

/**
 * Get the prompt configuration for a process
 * Returns null if process uses the default configuration
 */
export const getPromptConfiguration = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      return null;
    }

    if (!process.promptConfigurationId) {
      return null; // Using default
    }

    const config = await ctx.db.get(process.promptConfigurationId);
    if (!config) {
      return null;
    }

    // Resolve the referenced prompts
    const systemPrompt = await ctx.db.get(config.systemPromptId);
    const userPrompt = await ctx.db.get(config.userPromptId);
    const jsonSchema = await ctx.db.get(config.jsonSchemaId);

    return {
      ...config,
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});
