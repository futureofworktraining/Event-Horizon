/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation } from "./_generated/server";

// Migration to clear old process data that had embedded steps
// Run this once to clean up data from the old schema
export const clearOldProcesses = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all processes
    const processes = await ctx.db.query("processes").collect();

    // Delete processes that have embedded steps (old schema)
    let deletedCount = 0;
    for (const process of processes) {
      // Check if the process has embedded steps (old schema)
      if (/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (process as any).steps) {
        await ctx.db.delete(process._id);
        deletedCount++;
      }
    }

    // Also clean up associated jobs that point to deleted processes
    const jobs = await ctx.db.query("jobs").collect();
    for (const job of jobs) {
      if (job.processId) {
        const process = await ctx.db.get(job.processId);
        if (!process) {
          // Reset the job so it can be reprocessed
          await ctx.db.patch(job._id, {
            processId: undefined,
            status: "pending",
            progress: 0,
          });
        }
      }
    }

    return { deletedProcesses: deletedCount };
  },
});

// Migration to clear old bounding boxes data (array format)
// Run this to reset steps so they can use the new single boundingBox format
export const clearOldBoundingBoxes = mutation({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db.query("steps").collect();

    let clearedCount = 0;
    for (const step of steps) {
      // Check if step has old boundingBoxes array
      if (/* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (step as any).boundingBoxes || /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (step as any).boundingBoxesDetected) {
        await ctx.db.patch(step._id, {
          boundingBoxes: undefined,
          boundingBoxesDetected: undefined,
          boundingBox: undefined,
          boundingBoxDetected: undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        clearedCount++;
      }
    }

    return { clearedSteps: clearedCount };
  },
});

// Migration to generate linear flows for existing processes
// Run this once after deploying the new schema
export const generateFlowsForExistingProcesses = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all processes
    const processes = await ctx.db.query("processes").collect();

    let createdFlows = 0;
    let updatedProcesses = 0;
    let updatedSteps = 0;

    for (const process of processes) {
      // Check if process already has a flow
      const existingFlow = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .first();

      if (existingFlow) {
        continue; // Skip if flow already exists
      }

      // Get steps for this process
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", process._id))
        .collect();

      steps.sort((a, b) => a.stepNumber - b.stepNumber);

      // Generate linear flow
      const nodes: Array<{
        nodeId: string;
        nodeType: "start" | "end" | "action";
        stepNumber?: number;
        endType?: "success";
        label?: string;
      }> = [
        { nodeId: "start", nodeType: "start", label: "Start" },
      ];

      const edges: Array<{
        edgeId: string;
        fromNodeId: string;
        toNodeId: string;
      }> = [];

      // Add action nodes for each step
      steps.forEach((step, index) => {
        const nodeId = `step_${step.stepNumber}`;
        nodes.push({
          nodeId: nodeId,
          nodeType: "action",
          stepNumber: step.stepNumber,
        });

        // Connect to previous node
        const prevNodeId = index === 0 ? "start" : `step_${steps[index - 1].stepNumber}`;
        edges.push({
          edgeId: `edge_${prevNodeId}_${nodeId}`,
          fromNodeId: prevNodeId,
          toNodeId: nodeId,
        });

        // Update step with flowNodeId
        ctx.db.patch(step._id, { flowNodeId: nodeId });
        updatedSteps++;
      });

      // Add end node
      const endNodeId = "end_success";
      nodes.push({
        nodeId: endNodeId,
        nodeType: "end",
        endType: "success",
        label: "End",
      });

      // Connect last step to end
      if (steps.length > 0) {
        const lastStepId = `step_${steps[steps.length - 1].stepNumber}`;
        edges.push({
          edgeId: `edge_${lastStepId}_${endNodeId}`,
          fromNodeId: lastStepId,
          toNodeId: endNodeId,
        });
      } else {
        edges.push({
          edgeId: "edge_start_end",
          fromNodeId: "start",
          toNodeId: endNodeId,
        });
      }

      // Create the flow
      await ctx.db.insert("processFlows", {
        processId: process._id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: nodes as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edges: edges as any,
        createdAt: Date.now(),
      });
      createdFlows++;

      // Update process with new metadata
      const decisionCount = 0; // Linear flow has no decisions
      await ctx.db.patch(process._id, {
        isMainProcess: true,
        hierarchyLevel: 1,
        colorIndex: 0,
        nodeCount: nodes.length,
        decisionCount: decisionCount,
        subprocessCount: 0,
      });
      updatedProcesses++;
    }

    return {
      createdFlows,
      updatedProcesses,
      updatedSteps,
    };
  },
});
