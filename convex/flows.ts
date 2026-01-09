import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { flowNodeValidator, flowEdgeValidator } from "./schema";

// ============================================
// PUBLIC QUERIES
// ============================================

// Get flow for a process
export const getProcessFlow = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const flow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    return flow;
  },
});

// Get process with flow and steps (complete data for flowchart)
export const getProcessWithFlow = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      return null;
    }

    // Ensure it's a valid process document (not a Job ID or other table ID passed by mistake)
    // In Convex 1.0+, IDs are generic, so we must verify the document structure
    if (!("processName" in process) || !("jobId" in process)) {
      console.error(`ID ${args.processId} points to a document that is not a Process.`);
      return null;
    }

    // Get flow
    const flow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    // Get steps
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();

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

    // Get subprocesses (child processes)
    const subprocesses = await ctx.db
      .query("processes")
      .withIndex("by_parent", (q) => q.eq("parentProcessId", args.processId))
      .collect();

    // Get job info
    const job = await ctx.db.get(process.jobId);

    return {
      ...process,
      flow,
      steps: stepsWithScreenshots,
      subprocesses,
      job,
    };
  },
});

// Get all processes for a job (including subprocesses hierarchy)
export const getProcessesForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    // Get all processes for this job
    const allProcesses = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Get top-level processes (no parent)
    const topLevelProcesses = allProcesses.filter(p => !p.parentProcessId);

    // Build hierarchy
    const buildHierarchy = async (parentId: string | null): Promise<any[]> => {
      const children = allProcesses.filter(p =>
        parentId ? p.parentProcessId?.toString() === parentId : !p.parentProcessId
      );

      return Promise.all(children.map(async (process) => {
        const flow = await ctx.db
          .query("processFlows")
          .withIndex("by_process", (q) => q.eq("processId", process._id))
          .first();

        const subprocesses = await buildHierarchy(process._id.toString());

        return {
          ...process,
          flow,
          subprocesses,
        };
      }));
    };

    return buildHierarchy(null);
  },
});

// Get subprocess hierarchy for navigation
export const getProcessHierarchy = query({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) {
      return null;
    }

    // Ensure it's a valid process document
    if (!("processName" in process)) {
      return null;
    }

    // Build path from root to current process
    const path: Array<{ _id: string; processName: string; colorIndex?: number }> = [];
    let current = process;

    while (current) {
      path.unshift({
        _id: current._id,
        processName: current.processName,
        colorIndex: current.colorIndex,
      });

      if (current.parentProcessId) {
        const parent = await ctx.db.get(current.parentProcessId); if (!parent) break; current = parent;
      } else {
        break;
      }
    }

    // Get siblings (other processes with same parent)
    const siblings = await ctx.db
      .query("processes")
      .withIndex("by_parent", (q) => q.eq("parentProcessId", process.parentProcessId))
      .collect();

    // Get children
    const children = await ctx.db
      .query("processes")
      .withIndex("by_parent", (q) => q.eq("parentProcessId", args.processId))
      .collect();

    return {
      process,
      path,
      siblings: siblings.filter(s => s._id !== args.processId),
      children,
    };
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

// Create or update flow for a process
export const upsertProcessFlow = mutation({
  args: {
    processId: v.id("processes"),
    nodes: v.array(flowNodeValidator),
    edges: v.array(flowEdgeValidator),
  },
  handler: async (ctx, args) => {
    const existingFlow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    if (existingFlow) {
      await ctx.db.patch(existingFlow._id, {
        nodes: args.nodes,
        edges: args.edges,
        updatedAt: Date.now(),
      });
      return existingFlow._id;
    } else {
      const flowId = await ctx.db.insert("processFlows", {
        processId: args.processId,
        nodes: args.nodes,
        edges: args.edges,
        createdAt: Date.now(),
      });
      return flowId;
    }
  },
});

// Update process hierarchy fields
export const updateProcessHierarchy = mutation({
  args: {
    processId: v.id("processes"),
    parentProcessId: v.optional(v.id("processes")),
    hierarchyLevel: v.optional(v.number()),
    colorIndex: v.optional(v.number()),
    isMainProcess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { processId, ...updates } = args;

    const process = await ctx.db.get(processId);
    if (!process) {
      throw new Error("Process not found");
    }

    // Validate hierarchy level
    if (updates.hierarchyLevel !== undefined && (updates.hierarchyLevel < 1 || updates.hierarchyLevel > 5)) {
      throw new Error("Hierarchy level must be between 1 and 5");
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

// ============================================
// INTERNAL MUTATIONS (for use in actions)
// ============================================

// Create process flow (internal)
export const createProcessFlow = internalMutation({
  args: {
    processId: v.id("processes"),
    nodes: v.array(flowNodeValidator),
    edges: v.array(flowEdgeValidator),
  },
  handler: async (ctx, args) => {
    const flowId = await ctx.db.insert("processFlows", {
      processId: args.processId,
      nodes: args.nodes,
      edges: args.edges,
      createdAt: Date.now(),
    });
    return flowId;
  },
});

// Update step with flow node ID (internal)
export const updateStepFlowNodeId = internalMutation({
  args: {
    stepId: v.id("steps"),
    flowNodeId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      flowNodeId: args.flowNodeId,
    });
  },
});

// Update process metadata for flowchart (internal)
export const updateProcessFlowMetadata = internalMutation({
  args: {
    processId: v.id("processes"),
    nodeCount: v.optional(v.number()),
    decisionCount: v.optional(v.number()),
    subprocessCount: v.optional(v.number()),
    colorIndex: v.optional(v.number()),
    hierarchyLevel: v.optional(v.number()),
    parentProcessId: v.optional(v.id("processes")),
    isMainProcess: v.optional(v.boolean()),
    videoStartTimestamp: v.optional(v.string()),
    videoEndTimestamp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { processId, ...updates } = args;

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
  },
});

// Fix subprocess references for a specific process (public mutation)
// This scans subprocess names and matches them to flow nodes
export const fixSubprocessReferences = mutation({
  args: {
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    // Get the flow for this process
    const flow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    if (!flow) {
      return { success: false, message: "No flow found for this process" };
    }

    // Get all child subprocesses
    const subprocesses = await ctx.db
      .query("processes")
      .withIndex("by_parent", (q) => q.eq("parentProcessId", args.processId))
      .collect();

    if (subprocesses.length === 0) {
      return { success: false, message: "No subprocesses found" };
    }

    // Create a map of potential matches
    // Match by: exact name, normalized name, or ID-like patterns
    const matchMap = new Map<string, string>();

    for (const subprocess of subprocesses) {
      // Normalize the subprocess name for matching
      const normalizedName = subprocess.processName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

      matchMap.set(normalizedName, subprocess._id);
      matchMap.set(subprocess.processName, subprocess._id);
      matchMap.set(`sub_${normalizedName}`, subprocess._id);

      // Also try matching common patterns
      const words = subprocess.processName.toLowerCase().split(/\s+/);
      if (words.length > 0) {
        matchMap.set(`sub_${words.join("_")}`, subprocess._id);
      }
    }

    let updatedCount = 0;
    const updatedNodes = flow.nodes.map((node: any) => {
      if (node.nodeType === "subprocess" && node.subprocessId) {
        // Check if this ID is already a valid database ID
        const existingSubprocess = subprocesses.find(s => s._id === node.subprocessId);
        if (existingSubprocess) {
          return node; // Already correct
        }

        // Try to match the ID to a subprocess
        const matchedId = matchMap.get(node.subprocessId) ||
                          matchMap.get(node.subprocessId.toLowerCase());

        if (matchedId) {
          updatedCount++;
          return { ...node, subprocessId: matchedId };
        }
      }
      return node;
    });

    if (updatedCount > 0) {
      await ctx.db.patch(flow._id, { nodes: updatedNodes, updatedAt: Date.now() });
      return {
        success: true,
        message: `Fixed ${updatedCount} subprocess reference(s)`,
        updatedCount
      };
    }

    return {
      success: false,
      message: "No subprocess references could be matched. Manual fix may be needed.",
      subprocessNames: subprocesses.map(s => s.processName)
    };
  },
});

// Update subprocess IDs in flow nodes after subprocesses are created (internal)
// Maps Gemini process IDs to database IDs in all flow nodes
export const updateFlowSubprocessIds = internalMutation({
  args: {
    processIdMap: v.array(v.object({
      geminiId: v.string(),
      databaseId: v.id("processes"),
    })),
  },
  handler: async (ctx, args) => {
    // Build a lookup map
    const idMap = new Map<string, string>();
    for (const mapping of args.processIdMap) {
      idMap.set(mapping.geminiId, mapping.databaseId);
    }

    // Get all process flows
    const allFlows = await ctx.db.query("processFlows").collect();
    let updatedCount = 0;

    for (const flow of allFlows) {
      let needsUpdate = false;
      const updatedNodes = flow.nodes.map((node: any) => {
        if (node.nodeType === "subprocess" && node.subprocessId) {
          const databaseId = idMap.get(node.subprocessId);
          if (databaseId && databaseId !== node.subprocessId) {
            needsUpdate = true;
            return { ...node, subprocessId: databaseId };
          }
        }
        return node;
      });

      if (needsUpdate) {
        await ctx.db.patch(flow._id, { nodes: updatedNodes });
        updatedCount++;
      }
    }

    console.log(`Updated subprocess IDs in ${updatedCount} flow(s)`);
    return { updatedFlows: updatedCount };
  },
});

// Create subprocess (internal)
export const createSubprocess = internalMutation({
  args: {
    jobId: v.id("jobs"),
    parentProcessId: v.id("processes"),
    processName: v.string(),
    processDescription: v.string(),
    recordingDurationSeconds: v.number(),
    totalSteps: v.number(),
    applications: v.array(v.object({
      name: v.string(),
      type: v.string(),
      url: v.optional(v.string()),
      version: v.optional(v.string()),
    })),
    hierarchyLevel: v.number(),
    colorIndex: v.number(),
    videoStartTimestamp: v.optional(v.string()),
    videoEndTimestamp: v.optional(v.string()),
    businessRulesObserved: v.optional(v.array(v.string())),
    exceptionsNoted: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Validate hierarchy level
    if (args.hierarchyLevel > 5) {
      throw new Error("Maximum hierarchy depth (5) exceeded");
    }

    const processId = await ctx.db.insert("processes", {
      jobId: args.jobId,
      parentProcessId: args.parentProcessId,
      processName: args.processName,
      processDescription: args.processDescription,
      recordingDurationSeconds: args.recordingDurationSeconds,
      totalSteps: args.totalSteps,
      applications: args.applications as any,
      hierarchyLevel: args.hierarchyLevel,
      colorIndex: args.colorIndex,
      isMainProcess: false,
      videoStartTimestamp: args.videoStartTimestamp,
      videoEndTimestamp: args.videoEndTimestamp,
      businessRulesObserved: args.businessRulesObserved,
      exceptionsNoted: args.exceptionsNoted,
      createdAt: Date.now(),
    });

    return processId;
  },
});
