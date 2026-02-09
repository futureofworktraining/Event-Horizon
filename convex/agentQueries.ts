/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Get all processes for a job with their steps and flows (flat list)
 * Used by read_pdd section="full"
 */
export const getProcessesForJobFlat = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const result = [];
    for (const proc of processes) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .collect();
      steps.sort((a, b) => a.stepNumber - b.stepNumber);

      const flow = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .first();

      result.push({
        process_id: proc._id,
        process_name: proc.processName,
        process_description: proc.processDescription,
        is_main_process: proc.isMainProcess ?? true,
        parent_process_id: proc.parentProcessId || null,
        recording_duration_seconds: proc.recordingDurationSeconds,
        total_steps: proc.totalSteps,
        video_start_timestamp: proc.videoStartTimestamp,
        video_end_timestamp: proc.videoEndTimestamp,
        applications: proc.applications,
        business_rules_observed: proc.businessRulesObserved,
        exceptions_noted: proc.exceptionsNoted,
        steps: steps.map((s) => ({
          step_number: s.stepNumber,
          timestamp: s.timestamp,
          action_type: s.actionType,
          specific_action: s.specificAction,
          description: s.description,
          application: s.application,
          screen_name: s.screenName,
          screenshot_required: s.screenshotRequired,
          flow_node_id: s.flowNodeId,
          ...(s.uiElement ? { ui_element: s.uiElement } : {}),
          ...(s.dataInfo ? { data_info: s.dataInfo } : {}),
          ...(s.waitCondition ? { wait_condition: s.waitCondition } : {}),
          notes: s.notes,
          automation_hint: s.automationHint,
        })),
        flow: flow
          ? { nodes: flow.nodes, edges: flow.edges }
          : { nodes: [], edges: [] },
      });
    }

    return result;
  },
});

/**
 * Get process summaries for a job (compact list)
 * Used by read_pdd section="processes"
 */
export const getProcessSummariesForJob = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const result = [];
    for (const proc of processes) {
      const stepCount = (
        await ctx.db
          .query("steps")
          .withIndex("by_process", (q) => q.eq("processId", proc._id))
          .collect()
      ).length;

      const flow = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .first();

      result.push({
        process_id: proc._id,
        process_name: proc.processName,
        process_description: proc.processDescription,
        is_main_process: proc.isMainProcess ?? true,
        parent_process_id: proc.parentProcessId || null,
        stepCount,
        nodeCount: flow?.nodes?.length || 0,
        edgeCount: flow?.edges?.length || 0,
      });
    }

    return result;
  },
});

/**
 * Get steps for a process (in snake_case for the agent)
 * Used by read_pdd section="steps"
 */
export const getStepsForProcess = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("steps")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .collect();
    steps.sort((a, b) => a.stepNumber - b.stepNumber);

    return steps.map((s) => ({
      step_number: s.stepNumber,
      timestamp: s.timestamp,
      action_type: s.actionType,
      specific_action: s.specificAction,
      description: s.description,
      application: s.application,
      screen_name: s.screenName,
      screenshot_required: s.screenshotRequired,
      flow_node_id: s.flowNodeId,
      ui_element: s.uiElement,
      data_info: s.dataInfo,
      wait_condition: s.waitCondition,
      notes: s.notes,
      automation_hint: s.automationHint,
    }));
  },
});

/**
 * Get flow for a process
 * Used by read_pdd section="flow"
 */
export const getFlowForProcess = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const flow = await ctx.db
      .query("processFlows")
      .withIndex("by_process", (q) => q.eq("processId", args.processId))
      .first();

    return flow ? { nodes: flow.nodes, edges: flow.edges } : { nodes: [], edges: [] };
  },
});

/**
 * Get process metadata
 * Used by read_pdd section="metadata"
 */
export const getProcessMetadata = internalQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const proc = await ctx.db.get(args.processId);
    if (!proc) return null;

    return {
      applications: proc.applications,
      business_rules_observed: proc.businessRulesObserved,
      exceptions_noted: proc.exceptionsNoted,
      recording_duration_seconds: proc.recordingDurationSeconds,
      total_steps: proc.totalSteps,
      video_start_timestamp: proc.videoStartTimestamp,
      video_end_timestamp: proc.videoEndTimestamp,
    };
  },
});

/**
 * Get aggregate stats for a job (process count, step count, node count, edge count)
 */
export const getJobStats = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    let stepCount = 0;
    let nodeCount = 0;
    let edgeCount = 0;

    for (const proc of processes) {
      const steps = await ctx.db
        .query("steps")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .collect();
      stepCount += steps.length;

      const flow = await ctx.db
        .query("processFlows")
        .withIndex("by_process", (q) => q.eq("processId", proc._id))
        .first();
      if (flow) {
        nodeCount += flow.nodes.length;
        edgeCount += flow.edges.length;
      }
    }

    return {
      processCount: processes.length,
      stepCount,
      nodeCount,
      edgeCount,
    };
  },
});
