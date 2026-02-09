"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Agent Tools - read_pdd and write_pdd
 *
 * These tools allow the ReAct agent to incrementally build PDD documents
 * by reading from and writing to the Convex database.
 */

import { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { GeminiToolDeclaration } from "./geminiApi";
import {
  convertFlowToCamelCase,
  parseTimestamp,
} from "./types";
import {
  convertUiElement,
  convertDataInfo,
  convertWaitCondition,
  convertApplications,
  calculateFlowMetadata,
} from "./processDataHandler";

// ============================================
// Tool Declarations (for Gemini function calling)
// ============================================

export function getToolDeclarations(): GeminiToolDeclaration[] {
  return [
    {
      name: "read_pdd",
      description:
        "Read the current state of the PDD document being built. Use this to check progress, verify completeness, and review your work.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["full", "processes", "steps", "flow", "metadata"],
            description:
              'Which section to read. "full" returns the entire PDD document.',
          },
          process_id: {
            type: "string",
            description:
              'Required when section is "steps", "flow", or "metadata". The process_id to read.',
          },
        },
        required: ["section"],
      },
    },
    {
      name: "write_pdd",
      description:
        "Write or update a section of the PDD document. Use this to incrementally build the PDD.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "set_processes",
              "add_process",
              "update_process",
              "add_steps",
              "set_flow",
              "update_metadata",
            ],
            description: "The write operation to perform.",
          },
          process_id: {
            type: "string",
            description:
              "Required for update_process, add_steps, set_flow, update_metadata operations.",
          },
          data: {
            type: "object",
            description:
              "The data to write. Structure depends on the operation. See the JSON Schema Reference in system instructions for the full structure.",
          },
        },
        required: ["operation", "data"],
      },
    },
  ];
}

// ============================================
// Tool Result Type
// ============================================

export interface ToolResult {
  success: boolean;
  data?: unknown;
  stats?: PddStats;
  error?: string;
}

interface PddStats {
  processCount: number;
  stepCount: number;
  nodeCount: number;
  edgeCount: number;
}

// ============================================
// Tool Execution
// ============================================

/**
 * Execute a tool call from the agent, reading/writing Convex DB.
 */
export async function executeTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  jobId: Id<"jobs">,
  processIdMap: Map<string, Id<"processes">>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "read_pdd":
        return await executeReadPdd(ctx, args, jobId, processIdMap);
      case "write_pdd":
        return await executeWritePdd(ctx, args, jobId, processIdMap);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================
// read_pdd Implementation
// ============================================

async function executeReadPdd(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  jobId: Id<"jobs">,
  processIdMap: Map<string, Id<"processes">>
): Promise<ToolResult> {
  const section = (args.section as string) || "full";
  const agentProcessId = args.process_id as string | undefined;

  // Resolve agent process ID to Convex ID
  const processId = agentProcessId
    ? processIdMap.get(agentProcessId)
    : undefined;

  switch (section) {
    case "full": {
      const processes = await ctx.runQuery(
        internal.agentQueries.getProcessesForJobFlat,
        { jobId }
      );
      const stats = computeStatsFromProcesses(processes);
      return { success: true, data: processes, stats };
    }

    case "processes": {
      const processes = await ctx.runQuery(
        internal.agentQueries.getProcessSummariesForJob,
        { jobId }
      );
      const stats = computeStatsFromSummaries(processes);
      return { success: true, data: processes, stats };
    }

    case "steps": {
      if (!processId) {
        return {
          success: false,
          error: `Process not found: ${agentProcessId}. Use read_pdd with section "processes" to see available process IDs.`,
        };
      }
      const steps = await ctx.runQuery(
        internal.agentQueries.getStepsForProcess,
        { processId }
      );
      return {
        success: true,
        data: steps,
        stats: { processCount: 0, stepCount: steps.length, nodeCount: 0, edgeCount: 0 },
      };
    }

    case "flow": {
      if (!processId) {
        return {
          success: false,
          error: `Process not found: ${agentProcessId}. Use read_pdd with section "processes" to see available process IDs.`,
        };
      }
      const flow = await ctx.runQuery(
        internal.agentQueries.getFlowForProcess,
        { processId }
      );
      return {
        success: true,
        data: flow,
        stats: {
          processCount: 0,
          stepCount: 0,
          nodeCount: flow?.nodes?.length || 0,
          edgeCount: flow?.edges?.length || 0,
        },
      };
    }

    case "metadata": {
      if (!processId) {
        return {
          success: false,
          error: `Process not found: ${agentProcessId}. Use read_pdd with section "processes" to see available process IDs.`,
        };
      }
      const process = await ctx.runQuery(
        internal.agentQueries.getProcessMetadata,
        { processId }
      );
      return { success: true, data: process };
    }

    default:
      return { success: false, error: `Unknown section: ${section}` };
  }
}

// ============================================
// write_pdd Implementation
// ============================================

async function executeWritePdd(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  jobId: Id<"jobs">,
  processIdMap: Map<string, Id<"processes">>
): Promise<ToolResult> {
  const operation = args.operation as string;
  const agentProcessId = args.process_id as string | undefined;
  const data = args.data as Record<string, unknown>;

  if (!data) {
    return { success: false, error: "Missing data parameter" };
  }

  switch (operation) {
    case "set_processes": {
      // Replace all processes - delete existing and create new
      const processes = (
        Array.isArray(data.processes) ? data.processes : Array.isArray(data) ? data : [data]
      ) as any[];

      // Delete existing processes for this job
      await ctx.runMutation(internal.agentMutations.deleteProcessesForJob, {
        jobId,
      });

      // Create new processes
      for (const proc of processes) {
        const processId = await createProcessFromAgent(
          ctx,
          proc,
          jobId,
          processIdMap
        );
        processIdMap.set(proc.process_id || proc.processId, processId);
      }

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    case "add_process": {
      const processId = await createProcessFromAgent(
        ctx,
        data,
        jobId,
        processIdMap
      );
      const agentId =
        (data.process_id as string) || (data.processId as string) || `proc-${Date.now()}`;
      processIdMap.set(agentId, processId);

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    case "update_process": {
      const processId = agentProcessId
        ? processIdMap.get(agentProcessId)
        : undefined;
      if (!processId) {
        return {
          success: false,
          error: `Process not found: ${agentProcessId}`,
        };
      }

      await ctx.runMutation(internal.agentMutations.updateProcess, {
        processId,
        processName: data.process_name as string | undefined,
        processDescription: data.process_description as string | undefined,
        isMainProcess: data.is_main_process as boolean | undefined,
        recordingDurationSeconds: data.recording_duration_seconds as
          | number
          | undefined,
        totalSteps: data.total_steps as number | undefined,
        videoStartTimestamp: data.video_start_timestamp as string | undefined,
        videoEndTimestamp: data.video_end_timestamp as string | undefined,
      });

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    case "add_steps": {
      const pid =
        agentProcessId || (data.process_id as string);
      const processId = pid ? processIdMap.get(pid) : undefined;
      if (!processId) {
        return { success: false, error: `Process not found: ${pid}` };
      }

      const steps = (
        Array.isArray(data.steps) ? data.steps : Array.isArray(data) ? data : []
      ) as any[];

      for (const step of steps) {
        const timestampSeconds = parseTimestamp(step.timestamp || "00:00.0");
        await ctx.runMutation(internal.internal.createStep, {
          processId,
          stepNumber: step.step_number ?? step.stepNumber ?? 0,
          timestamp: step.timestamp || "00:00.0",
          timestampSeconds,
          actionType: step.action_type || step.actionType || "ui_interaction",
          specificAction:
            step.specific_action || step.specificAction || "click",
          description: step.description || "",
          application: step.application || "",
          screenName: step.screen_name || step.screenName || "",
          screenshotRequired:
            step.screenshot_required ?? step.screenshotRequired ?? true,
          uiElement: convertUiElement(step.ui_element || step.uiElement),
          dataInfo: convertDataInfo(step.data_info || step.dataInfo),
          waitCondition: convertWaitCondition(
            step.wait_condition || step.waitCondition
          ),
          notes: step.notes,
          automationHint: step.automation_hint || step.automationHint,
          flowNodeId: step.flow_node_id || step.flowNodeId,
        });
      }

      // Update totalSteps on the process
      const allSteps = await ctx.runQuery(
        internal.agentQueries.getStepsForProcess,
        { processId }
      );
      await ctx.runMutation(internal.agentMutations.updateProcess, {
        processId,
        totalSteps: allSteps.length,
      });

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    case "set_flow": {
      const pid =
        agentProcessId || (data.process_id as string);
      const processId = pid ? processIdMap.get(pid) : undefined;
      if (!processId) {
        return { success: false, error: `Process not found: ${pid}` };
      }

      const nodes = (data.nodes || []) as any[];
      const edges = (data.edges || []) as any[];

      // Convert snake_case to camelCase for DB storage
      const camelFlow = convertFlowToCamelCase({ nodes, edges });

      // Calculate metadata
      const flowMetadata = calculateFlowMetadata({ nodes, edges });

      // Upsert flow
      await ctx.runMutation(internal.agentMutations.upsertProcessFlow, {
        processId,
        nodes: camelFlow.nodes as any,
        edges: camelFlow.edges as any,
      });

      // Update process flow metadata
      await ctx.runMutation(internal.flows.updateProcessFlowMetadata, {
        processId,
        nodeCount: flowMetadata.nodeCount,
        decisionCount: flowMetadata.decisionCount,
        subprocessCount: flowMetadata.subprocessCount,
      });

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    case "update_metadata": {
      const pid =
        agentProcessId || (data.process_id as string);
      const processId = pid ? processIdMap.get(pid) : undefined;
      if (!processId) {
        return { success: false, error: `Process not found: ${pid}` };
      }

      await ctx.runMutation(internal.agentMutations.updateProcessMetadata, {
        processId,
        applications: data.applications
          ? convertApplications(data.applications as any[])
          : undefined,
        businessRulesObserved: data.business_rules_observed as
          | string[]
          | undefined,
        exceptionsNoted: data.exceptions_noted as string[] | undefined,
      });

      return {
        success: true,
        stats: await getJobStats(ctx, jobId),
      };
    }

    default:
      return { success: false, error: `Unknown operation: ${operation}` };
  }
}

// ============================================
// Helper: Create Process from Agent Data
// ============================================

async function createProcessFromAgent(
  ctx: ActionCtx,
  data: any,
  jobId: Id<"jobs">,
  processIdMap: Map<string, Id<"processes">>
): Promise<Id<"processes">> {
  const applications = convertApplications(data.applications || []);

  // Resolve parent process ID if provided
  let parentProcessId: Id<"processes"> | undefined;
  const parentAgentId = data.parent_process_id || data.parentProcessId;
  if (parentAgentId) {
    parentProcessId = processIdMap.get(parentAgentId);
  }

  const processId = await ctx.runMutation(internal.internal.createProcess, {
    jobId,
    processName:
      data.process_name || data.processName || "Unnamed Process",
    processDescription:
      data.process_description || data.processDescription || "",
    recordingDurationSeconds:
      data.recording_duration_seconds || data.recordingDurationSeconds || 0,
    totalSteps: data.total_steps || data.totalSteps || 0,
    applications,
    businessRulesObserved:
      data.business_rules_observed || data.businessRulesObserved,
    exceptionsNoted: data.exceptions_noted || data.exceptionsNoted,
  });

  // Update hierarchy fields
  await ctx.runMutation(internal.flows.updateProcessFlowMetadata, {
    processId,
    parentProcessId,
    hierarchyLevel: parentProcessId ? 2 : 1,
    isMainProcess:
      data.is_main_process ?? data.isMainProcess ?? !parentProcessId,
    videoStartTimestamp:
      data.video_start_timestamp || data.videoStartTimestamp,
    videoEndTimestamp: data.video_end_timestamp || data.videoEndTimestamp,
    colorIndex: processIdMap.size % 8,
  });

  return processId;
}

// ============================================
// Helper: Compute Stats
// ============================================

async function getJobStats(
  ctx: ActionCtx,
  jobId: Id<"jobs">
): Promise<PddStats> {
  return await ctx.runQuery(internal.agentQueries.getJobStats, { jobId });
}

function computeStatsFromProcesses(processes: any[]): PddStats {
  let stepCount = 0;
  let nodeCount = 0;
  let edgeCount = 0;

  for (const proc of processes) {
    stepCount += proc.steps?.length || proc.stepCount || 0;
    nodeCount += proc.flow?.nodes?.length || proc.nodeCount || 0;
    edgeCount += proc.flow?.edges?.length || proc.edgeCount || 0;
  }

  return {
    processCount: processes.length,
    stepCount,
    nodeCount,
    edgeCount,
  };
}

function computeStatsFromSummaries(summaries: any[]): PddStats {
  let stepCount = 0;
  let nodeCount = 0;
  let edgeCount = 0;

  for (const s of summaries) {
    stepCount += s.stepCount || 0;
    nodeCount += s.nodeCount || 0;
    edgeCount += s.edgeCount || 0;
  }

  return {
    processCount: summaries.length,
    stepCount,
    nodeCount,
    edgeCount,
  };
}
