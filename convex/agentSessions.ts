import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

/**
 * Create a new agent session for a job
 */
export const createSession = internalMutation({
  args: {
    jobId: v.id("jobs"),
    maxIterations: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentSessions", {
      jobId: args.jobId,
      state: "idle",
      maxIterations: args.maxIterations,
      iteration: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalCost: 0,
      startedAt: Date.now(),
    });
  },
});

/**
 * Update agent session state and metrics
 */
export const updateSession = internalMutation({
  args: {
    sessionId: v.id("agentSessions"),
    state: v.optional(v.union(
      v.literal("idle"),
      v.literal("uploading"),
      v.literal("caching"),
      v.literal("analyzing"),
      v.literal("completed"),
      v.literal("error"),
      v.literal("paused")
    )),
    stopRequested: v.optional(v.union(v.literal("stop"), v.literal("pause"))),
    iteration: v.optional(v.number()),
    cacheName: v.optional(v.string()),
    cacheCreatedAt: v.optional(v.number()),
    cacheTokenCount: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    processIdMap: v.optional(v.string()),
    conversationHistory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...updates } = args;

    // Filter out undefined values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(sessionId, patch);
    }
  },
});

/**
 * Get session for a job (public query for UI)
 */
export const getSessionForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
  },
});

/**
 * Get session for a job (internal query for actions)
 */
export const getSessionForJobInternal = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
  },
});

/**
 * Request stop or pause from the UI (public mutation)
 */
export const requestStop = mutation({
  args: {
    jobId: v.id("jobs"),
    action: v.union(v.literal("stop"), v.literal("pause")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();

    if (!session) throw new Error("No active session found");
    if (session.state === "completed" || session.state === "error") {
      throw new Error("Session already finished");
    }

    await ctx.db.patch(session._id, { stopRequested: args.action });
  },
});

/**
 * Resume a paused session (public mutation) - clears stopRequested and sets state back to analyzing
 */
export const resumeSession = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();

    if (!session) throw new Error("No active session found");
    if (session.state !== "paused") {
      throw new Error("Session is not paused");
    }

    await ctx.db.patch(session._id, {
      stopRequested: undefined,
      state: "analyzing",
    });
  },
});

/**
 * Clear the stopRequested flag (internal, called after agent handles the signal)
 */
export const clearStopRequest = internalMutation({
  args: {
    sessionId: v.id("agentSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { stopRequested: undefined });
  },
});
