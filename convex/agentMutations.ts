/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { flowNodeValidator, flowEdgeValidator } from "./schema";

/**
 * Delete all processes (and their steps/flows) for a job.
 * Used by write_pdd set_processes operation.
 */
export const deleteProcessesForJob = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const proc of processes) {
      // Delete steps
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .collect();
      for (const step of steps) {
        await ctx.db.delete(step._id);
      }

      // Delete flows
      const flows = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .collect();
      for (const flow of flows) {
        await ctx.db.delete(flow._id);
      }

      // Delete process
      await ctx.db.delete(proc._id);
    }
  },
});

/**
 * Update process fields (partial update)
 */
export const updateProcess = internalMutation({
  args: {
    processId: v.id("processes"),
    processName: v.optional(v.string()),
    processDescription: v.optional(v.string()),
    isMainProcess: v.optional(v.boolean()),
    recordingDurationSeconds: v.optional(v.number()),
    totalSteps: v.optional(v.number()),
    videoStartTimestamp: v.optional(v.string()),
    videoEndTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { processId, ...updates } = args;

    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(processId, patch);
    }
  },
});

/**
 * Update process metadata (applications, rules, exceptions)
 */
export const updateProcessMetadata = internalMutation({
  args: {
    processId: v.id("processes"),
    applications: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          url: v.optional(v.string()),
          version: v.optional(v.string()),
        })
      )
    ),
    businessRulesObserved: v.optional(v.array(v.string())),
    exceptionsNoted: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { processId, ...updates } = args;

    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(processId, patch);
    }
  },
});

/**
 * Upsert process flow (create or replace)
 */
export const upsertProcessFlow = internalMutation({
  args: {
    processId: v.id("processes"),
    nodes: v.array(flowNodeValidator),
    edges: v.array(flowEdgeValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nodes: args.nodes,
        edges: args.edges,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("processFlows", {
        processId: args.processId,
        nodes: args.nodes,
        edges: args.edges,
        createdAt: Date.now(),
      });
    }
  },
});
