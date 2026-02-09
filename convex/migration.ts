import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============================================
// EXPORT QUERIES - one per table
// Each returns all documents including _id
// ============================================

export const exportSettings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").collect();
  },
});

export const exportPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("prompts").collect();
  },
});

export const exportSystemPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("systemPrompts").collect();
  },
});

export const exportUserPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userPrompts").collect();
  },
});

export const exportJsonSchemas = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jsonSchemas").collect();
  },
});

export const exportPromptConfigurations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("promptConfigurations").collect();
  },
});

export const exportWorkflows = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workflows").collect();
  },
});

export const exportJobs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobs").collect();
  },
});

export const exportProcesses = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("processes").collect();
  },
});

export const exportSteps = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("steps").collect();
  },
});

export const exportProcessFlows = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("processFlows").collect();
  },
});

export const exportDocuments = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("documents").collect();
  },
});

export const exportAgentSessions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentSessions").collect();
  },
});

export const exportAgentEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentEvents").collect();
  },
});

export const exportAnalysisVersions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("analysisVersions").collect();
  },
});

export const exportWorkflowRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workflowRuns").collect();
  },
});

export const exportApiLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiLogs").collect();
  },
});

// Get signed URL for a storage file
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ============================================
// IMPORT MUTATIONS - one per table
// Each accepts records with oldId + data, inserts, returns [{oldId, newId}]
// Uses v.any() for data - schema validates at insert time
// ============================================

export const importSettings = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("settings", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importPrompts = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("prompts", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importSystemPrompts = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("systemPrompts", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importUserPrompts = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("userPrompts", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importJsonSchemas = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("jsonSchemas", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importPromptConfigurations = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("promptConfigurations", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importWorkflows = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("workflows", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importJobs = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("jobs", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importProcesses = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("processes", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importSteps = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("steps", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importProcessFlows = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("processFlows", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importDocuments = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("documents", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importAgentSessions = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("agentSessions", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importAgentEvents = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("agentEvents", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importAnalysisVersions = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("analysisVersions", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importWorkflowRuns = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("workflowRuns", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

export const importApiLogs = mutation({
  args: { records: v.array(v.object({ oldId: v.string(), data: v.any() })) },
  handler: async (ctx, args) => {
    const results = [];
    for (const record of args.records) {
      const newId = await ctx.db.insert("apiLogs", record.data);
      results.push({ oldId: record.oldId, newId });
    }
    return results;
  },
});

// ============================================
// CIRCULAR REFERENCE FIX
// Patch jobs with processId after processes exist
// ============================================

export const patchJobProcessId = mutation({
  args: {
    patches: v.array(
      v.object({
        jobId: v.id("jobs"),
        processId: v.id("processes"),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const patch of args.patches) {
      await ctx.db.patch(patch.jobId, { processId: patch.processId });
    }
    return { patched: args.patches.length };
  },
});
