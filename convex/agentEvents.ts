import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

/**
 * Insert an agent event (called from the agent loop action)
 */
export const insertEvent = internalMutation({
  args: {
    jobId: v.id("jobs"),
    eventType: v.union(
      v.literal("state_changed"),
      v.literal("thinking"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("pdd_updated"),
      v.literal("progress"),
      v.literal("completed"),
      v.literal("error")
    ),
    payload: v.string(),
    iteration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentEvents", {
      jobId: args.jobId,
      eventType: args.eventType,
      payload: args.payload,
      iteration: args.iteration,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get all events for a job (reactive query for real-time UI updates)
 */
export const getEventsForJob = query({
  args: {
    jobId: v.id("jobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_job_time", (q) => q.eq("jobId", args.jobId))
      .order("asc")
      .take(args.limit || 500);

    return events;
  },
});

/**
 * Get latest events for a job (for compact status display)
 */
export const getLatestEventsForJob = query({
  args: {
    jobId: v.id("jobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_job_time", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(args.limit || 10);

    return events.reverse();
  },
});

/**
 * Clear all events for a job (for re-analysis)
 */
export const clearEventsForJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("agentEvents")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deleted: events.length };
  },
});
