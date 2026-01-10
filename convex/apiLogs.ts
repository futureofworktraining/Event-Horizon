import { v } from "convex/values";
// Controller for API logs and cost stats
import { mutation, query, internalMutation } from "./_generated/server";

/**
 * Log an API call with cost calculation
 */
export const logApiCall = internalMutation({
    args: {
        model: v.string(),
        category: v.string(),
        source: v.string(),
        promptTokens: v.number(),
        completionTokens: v.number(),
        durationMs: v.number(),
        status: v.union(v.literal("success"), v.literal("error")),
        errorMessage: v.optional(v.string()),
        processId: v.optional(v.id("processes")),
    },
    handler: async (ctx, args) => {
        const timestamp = Date.now();
        const totalTokens = args.promptTokens + args.completionTokens;

        // Calculate cost based on current January 2026 pricing
        let cost = 0;
        const model = args.model.toLowerCase();

        if (model.includes("pro")) {
            // Gemini 3 Pro
            // Input: $2.00 / 1M (< 200k), $4.00 / 1M (> 200k)
            // Output: $12.00 / 1M
            const inputRate = args.promptTokens > 200000 ? 0.000004 : 0.000002;
            const outputRate = 0.000012;
            cost = (args.promptTokens * inputRate) + (args.completionTokens * outputRate);
        } else if (model.includes("flash")) {
            // Gemini 3 Flash
            // Input: $0.50 / 1M
            // Output: $3.00 / 1M
            const inputRate = 0.0000005;
            const outputRate = 0.000003;
            cost = (args.promptTokens * inputRate) + (args.completionTokens * outputRate);
        } else {
            // Fallback/Default for other models
            const inputRate = 0.000001;
            const outputRate = 0.000005;
            cost = (args.promptTokens * inputRate) + (args.completionTokens * outputRate);
        }

        const logId = await ctx.db.insert("apiLogs", {
            timestamp,
            model: args.model,
            category: args.category,
            source: args.source,
            promptTokens: args.promptTokens,
            completionTokens: args.completionTokens,
            totalTokens,
            cost,
            durationMs: args.durationMs,
            status: args.status,
            errorMessage: args.errorMessage,
            processId: args.processId,
        });

        return logId;
    },
});

/**
 * Get recent API logs
 */
export const getRecentLogs = query({
    args: {
        limit: v.optional(v.number()),
        category: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        let q;
        if (args.category) {
            q = ctx.db.query("apiLogs").withIndex("by_category", (q) => q.eq("category", args.category as any));
        } else {
            q = ctx.db.query("apiLogs").withIndex("by_timestamp");
        }

        return await q.order("desc").take(args.limit || 50);
    },
});

/**
 * Get cost statistics
 */
export const getCostStats = query({
    args: {},
    handler: async (ctx) => {
        const logs = await ctx.db.query("apiLogs").collect();

        const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
        const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
        const count = logs.length;

        // Group by category
        const byCategory = logs.reduce((acc, log) => {
            if (!acc[log.category]) {
                acc[log.category] = { cost: 0, tokens: 0, count: 0 };
            }
            acc[log.category].cost += log.cost;
            acc[log.category].tokens += log.totalTokens;
            acc[log.category].count += 1;
            return acc;
        }, {} as Record<string, { cost: number; tokens: number; count: number }>);

        return {
            totalCost,
            totalTokens,
            count,
            byCategory,
        };
    },
});

/**
 * Get extended log statistics and enriched logs
 */
export const getExtendedLogStats = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const logs = await ctx.db.query("apiLogs").order("desc").take(args.limit || 500);

        // Fetch all unique process IDs
        const processIds = new Set(logs.map(l => l.processId).filter(Boolean));
        const processMap = new Map();

        for (const pid of processIds) {
            if (pid) {
                const process = await ctx.db.get(pid);
                if (process) {
                    processMap.set(pid, process.processName);
                }
            }
        }

        const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
        const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
        const count = logs.length;

        // Group by category
        const byCategory = logs.reduce((acc, log) => {
            if (!acc[log.category]) {
                acc[log.category] = { cost: 0, tokens: 0, count: 0 };
            }
            acc[log.category].cost += log.cost;
            acc[log.category].tokens += log.totalTokens;
            acc[log.category].count += 1;
            return acc;
        }, {} as Record<string, { cost: number; tokens: number; count: number }>);

        // Group by project
        const byProject = logs.reduce((acc, log) => {
            const pid = log.processId || "unknown";
            const pName = log.processId ? (processMap.get(log.processId) || "Unknown Project") : "No Project";

            if (!acc[pid]) {
                acc[pid] = { name: pName, cost: 0, tokens: 0, count: 0 };
            }
            acc[pid].cost += log.cost;
            acc[pid].tokens += log.totalTokens;
            acc[pid].count += 1;
            return acc;
        }, {} as Record<string, { name: string; cost: number; tokens: number; count: number }>);

        // Enrich logs
        const enrichedLogs = logs.map(log => ({
            ...log,
            processName: log.processId ? processMap.get(log.processId) : undefined
        }));

        return {
            totalCost,
            totalTokens,
            count,
            byCategory,
            byProject,
            logs: enrichedLogs
        };
    },
});
