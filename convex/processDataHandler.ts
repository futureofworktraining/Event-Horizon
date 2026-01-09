"use node";

/**
 * Process Data Handler
 *
 * Functions for processing and storing PDD analysis results
 * including processes, flows, and steps.
 */

import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  ProcessWithFlow,
  convertFlowToCamelCase,
  parseTimestamp,
} from "./types";

// ============================================
// Constants
// ============================================

/** Number of available colors for subprocesses (0-7) */
export const SUBPROCESS_COLORS = 8;

// ============================================
// Types
// ============================================

export interface ProcessingContext {
  runMutation: (mutation: any, args: any) => Promise<any>;
  runQuery: (query: any, args: any) => Promise<any>;
}

// ============================================
// Step Data Converters
// ============================================

/**
 * Convert snake_case UI element to camelCase
 */
export function convertUiElement(uiElement: any) {
  if (!uiElement) return undefined;

  return {
    elementName: uiElement.element_name,
    elementType: uiElement.element_type,
    locationDescription: uiElement.location_description,
    screenRegion: uiElement.screen_region,
    parentElement: uiElement.parent_element,
    identifiers: uiElement.identifiers
      ? {
          id: uiElement.identifiers.id,
          className: uiElement.identifiers.class_name,
          xpath: uiElement.identifiers.xpath,
          accessibilityId: uiElement.identifiers.accessibility_id,
        }
      : undefined,
  };
}

/**
 * Convert snake_case data info to camelCase
 */
export function convertDataInfo(dataInfo: any) {
  if (!dataInfo) return undefined;

  return {
    value: dataInfo.value,
    dataType: dataInfo.data_type,
    source: dataInfo.source,
    isSensitive: dataInfo.is_sensitive,
    format: dataInfo.format,
    validationRules: dataInfo.validation_rules,
  };
}

/**
 * Convert snake_case wait condition to camelCase
 */
export function convertWaitCondition(waitCondition: any) {
  if (!waitCondition) return undefined;

  return {
    waitType: waitCondition.wait_type,
    description: waitCondition.description,
    timeoutSeconds: waitCondition.timeout_seconds,
    retryCount: waitCondition.retry_count,
  };
}

/**
 * Convert snake_case applications array to camelCase
 */
export function convertApplications(applications: any[]) {
  if (!applications) return [];

  return applications.map((app) => ({
    name: app.name,
    type: app.type,
    url: app.url,
    version: app.version,
  }));
}

// ============================================
// Flow Metadata Helpers
// ============================================

/**
 * Calculate flow metadata from nodes
 */
export function calculateFlowMetadata(flow: any) {
  const nodes = flow?.nodes || [];

  return {
    nodeCount: nodes.length,
    decisionCount: nodes.filter(
      (n: any) => n.node_type === "decision" || n.node_type === "switch"
    ).length,
    subprocessCount: nodes.filter((n: any) => n.node_type === "subprocess")
      .length,
  };
}

// ============================================
// Main Processing Function
// ============================================

/**
 * Process a single process and its flow, creating database records
 *
 * @param ctx - Convex action context
 * @param processData - The process data from Gemini analysis
 * @param jobId - The job ID
 * @param parentProcessId - Parent process ID (null for main process)
 * @param hierarchyLevel - Current hierarchy level (1-5)
 * @param colorIndex - Color index for visual distinction
 * @param processIdMap - Map to track process IDs for subprocess references
 * @returns The created process ID
 */
export async function processProcessData(
  ctx: ProcessingContext,
  processData: ProcessWithFlow,
  jobId: Id<"jobs">,
  parentProcessId: Id<"processes"> | null,
  hierarchyLevel: number,
  colorIndex: number,
  processIdMap: Map<string, Id<"processes">>
): Promise<Id<"processes">> {
  // Validate hierarchy level
  if (hierarchyLevel > 5) {
    throw new Error(
      `Maximum hierarchy depth (5) exceeded for process: ${processData.process_name}`
    );
  }

  // Convert applications
  const applications = convertApplications(processData.applications || []);

  // Calculate flow metadata
  const flowMetadata = calculateFlowMetadata(processData.flow);

  // Create process record
  const processId = await ctx.runMutation(internal.internal.createProcess, {
    jobId,
    processName: processData.process_name,
    processDescription: processData.process_description,
    recordingDurationSeconds: processData.recording_duration_seconds || 0,
    totalSteps: processData.total_steps || processData.steps?.length || 0,
    applications,
    businessRulesObserved: processData.business_rules_observed,
    exceptionsNoted: processData.exceptions_noted,
  });

  // Store mapping for subprocess references
  processIdMap.set(processData.process_id, processId);

  // Update process with hierarchy and flow metadata
  await ctx.runMutation(internal.flows.updateProcessFlowMetadata, {
    processId,
    parentProcessId: parentProcessId || undefined,
    hierarchyLevel,
    colorIndex,
    isMainProcess: processData.is_main_process || !parentProcessId,
    videoStartTimestamp: processData.video_start_timestamp,
    videoEndTimestamp: processData.video_end_timestamp,
    nodeCount: flowMetadata.nodeCount,
    decisionCount: flowMetadata.decisionCount,
    subprocessCount: flowMetadata.subprocessCount,
  });

  // Create flow record
  if (processData.flow?.nodes && processData.flow?.edges) {
    const camelCaseFlow = convertFlowToCamelCase(processData.flow);
    await ctx.runMutation(internal.flows.createProcessFlow, {
      processId,
      nodes: camelCaseFlow.nodes as any,
      edges: camelCaseFlow.edges as any,
    });
  }

  // Process steps
  await processSteps(ctx, processData.steps || [], processId);

  return processId;
}

/**
 * Process and create step records for a process
 */
async function processSteps(
  ctx: ProcessingContext,
  steps: any[],
  processId: Id<"processes">
): Promise<void> {
  if (!steps || steps.length === 0) return;

  for (const step of steps) {
    const timestampSeconds = parseTimestamp(step.timestamp);

    // Create step record
    await ctx.runMutation(internal.internal.createStep, {
      processId,
      stepNumber: step.step_number,
      timestamp: step.timestamp,
      timestampSeconds,
      actionType: step.action_type,
      specificAction: step.specific_action,
      description: step.description,
      application: step.application,
      screenName: step.screen_name,
      screenshotRequired: step.screenshot_required,
      screenshotStorageId: undefined, // Screenshots extracted client-side
      uiElement: convertUiElement(step.ui_element),
      dataInfo: convertDataInfo(step.data_info),
      waitCondition: convertWaitCondition(step.wait_condition),
      notes: step.notes,
      automationHint: step.automation_hint,
      flowNodeId: step.flow_node_id,
    });
  }
}

// ============================================
// Process Sorting Helpers
// ============================================

/**
 * Sort processes into main processes and subprocesses
 */
export function sortProcesses(processes: ProcessWithFlow[]) {
  const mainProcesses = processes.filter(
    (p) => !p.parent_process_id || p.is_main_process
  );
  const subprocesses = processes.filter(
    (p) => p.parent_process_id && !p.is_main_process
  );

  return { mainProcesses, subprocesses };
}

/**
 * Process all subprocesses with proper hierarchy handling
 * Handles multiple passes for deep hierarchies
 */
export async function processSubprocesses(
  ctx: ProcessingContext,
  subprocesses: ProcessWithFlow[],
  allProcesses: ProcessWithFlow[],
  jobId: Id<"jobs">,
  processIdMap: Map<string, Id<"processes">>,
  startColorIndex: number,
  onProgress?: (processed: number, total: number) => Promise<void>
): Promise<void> {
  const processedSubprocesses = new Set<string>();
  let maxIterations = 5; // Max hierarchy depth
  let colorCounter = startColorIndex;
  let processedCount = 0;

  while (
    processedSubprocesses.size < subprocesses.length &&
    maxIterations > 0
  ) {
    for (const processData of subprocesses) {
      // Skip if already processed
      if (processedSubprocesses.has(processData.process_id)) {
        continue;
      }

      // Check if parent has been processed
      const parentId = processData.parent_process_id;
      if (parentId && processIdMap.has(parentId)) {
        const parentProcessId = processIdMap.get(parentId)!;

        // Determine hierarchy level from parent
        const parentProcess = allProcesses.find(
          (p) => p.process_id === parentId
        );
        const hierarchyLevel = Math.min(
          (parentProcess ? 2 : 1) + 1,
          5
        );

        // Report progress
        if (onProgress) {
          await onProgress(processedCount, subprocesses.length);
        }
        processedCount++;

        await processProcessData(
          ctx,
          processData,
          jobId,
          parentProcessId,
          hierarchyLevel,
          colorCounter++ % SUBPROCESS_COLORS,
          processIdMap
        );

        processedSubprocesses.add(processData.process_id);
      }
    }
    maxIterations--;
  }
}
