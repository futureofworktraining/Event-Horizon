
import { query } from "./_generated/server";
import { v } from "convex/values";

export const inspectProcess = query({
    args: { processId: v.id("processes") },
    handler: async (ctx, args) => {
        // 1. Get the process
        const processDoc = await ctx.db.get(args.processId);

        if (!processDoc) {
            return { error: "Process not found" };
        }

        // 2. Get the flow
        const flow = await ctx.db
            .query("processFlows")
            .withIndex("by_process", (q) => q.eq("processId", args.processId))
            .first();

        // 3. Get subprocesses
        const subprocesses = await ctx.db
            .query("processes")
            .withIndex("by_parent", (q) => q.eq("parentProcessId", args.processId))
            .collect();

        // 4. Return summary
        return {
            processName: processDoc.processName,
            processId: processDoc._id,
            flowNodes: flow?.nodes.map(n => ({
                id: n.nodeId,
                type: n.nodeType,
                subprocessId: n.subprocessId,
                label: n.label
            })).filter(n => n.type === 'subprocess'),
            subprocesses: subprocesses.map(s => ({
                id: s._id,
                name: s.processName,
                desc: s.processDescription
            }))
        };
    },
});
