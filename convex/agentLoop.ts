"use node";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Agent Loop - ReAct Agent Engine
 *
 * Runs the iterative ReAct loop inside a Convex action.
 * Each iteration: Gemini reasons -> calls tools -> tools execute -> results fed back.
 * All state is persisted to Convex DB (agentSessions, agentEvents, processes, steps, flows).
 */

import { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  generateContentWithCache,
  refreshGeminiCacheTTL,
  GeminiMessage,
} from "./geminiApi";
import { executeTool, getToolDeclarations } from "./agentTools";

// ============================================
// Configuration Constants
// ============================================

const AGENT_CONFIG = {
  cacheTtlMinutes: 5,
  cacheRefreshEveryNIterations: 20,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 60000,
  // Cost rates (Gemini 3 Flash - cached pricing)
  cost: {
    inputPer1MTokens: 0.15,
    outputPer1MTokens: 3.50,
    cachedInputPer1MTokens: 0.0375,
    cacheStoragePer1MTokensPerHour: 1.00,
  },
  // Safety: max time before we force-complete (8.5 minutes, leaving buffer for cleanup)
  maxRunTimeMs: 8.5 * 60 * 1000,
};

// ============================================
// User Prompt for the Agent
// ============================================

const AGENT_USER_PROMPT = `Analyze the video provided in the cached context and build a complete Process Design Document (PDD) with flowchart structure.

Watch the entire video carefully and document:
1. All User Actions - clicks, typing, selections, scrolling, drag-drop
2. All System Responses - page loads, popups, notifications, errors
3. Decision Points - any branching logic, conditions, choices
4. Waiting Periods - loading, processing, delays
5. Subprocesses - distinct reusable sequences
6. Multiple Processes - if the video shows independent processes, separate them

## Step Detail Requirements

For EVERY step, always provide: step_number, timestamp (MM:SS.s), flow_node_id, action_type, specific_action, description (must start with "User" or "System"), application, screen_name, screenshot_required.

Additionally, include these OPTIONAL fields when applicable:

**ui_element** - Include for ANY step that involves interacting with or referencing a UI element (clicks, typing, selecting, hovering, reading, verifying). Provide:
- element_name: descriptive name (e.g. "Login Button", "Username Field")
- element_type: one of button, link, text_field, text_area, dropdown, combobox, checkbox, radio_button, toggle, slider, date_picker, time_picker, file_upload, menu, menu_item, tab, table, table_row, table_cell, tree_view, tree_node, list, list_item, card, modal, dialog, tooltip, notification, icon, image, label, heading, paragraph, breadcrumb, pagination, search_field, other
- location_description: where on screen (e.g. "Top navigation bar", "Main content area")
- screen_region: one of top_left, top_center, top_right, middle_left, middle_center, middle_right, bottom_left, bottom_center, bottom_right, full_screen
- identifiers (optional): id, class_name, xpath, accessibility_id - include if visible in the video

**data_info** - Include when data is being entered, read, copied, or transferred. Provide:
- value: the actual data value (mask sensitive data like passwords with "***")
- data_type: one of text, number, date, datetime, currency, percentage, boolean, email, phone, url, file, password, other
- source: one of user_input, system_generated, database, external_api, file_import, calculation, other
- is_sensitive: true if the data contains passwords, PII, credit cards, etc.

**wait_condition** - Include for loading, processing, or delay steps. Provide:
- wait_type: one of page_load, element_visible, element_clickable, api_response, file_download, animation_complete, manual_trigger, timeout, other
- description: what the system is waiting for

**notes** and **automation_hint** - Include when there are special considerations for RPA automation.

## Flowchart Requirements

- Create START and END nodes
- Create ACTION nodes for each step
- Create DECISION nodes for any branching (if/else, success/failure)
- Create SUBPROCESS nodes for distinct sequences
- Connect all nodes with properly labeled EDGES
- Use "TAK"/"NIE" or "Yes"/"No" labels for decision edges

## Variable Standardization

- Replace specific business data with generic placeholders: "[Customer Name]", "[Invoice Number]", etc.
- Define and use key variables with \`{{VariableName}}\` format consistently across step descriptions, data values, and conditions.

Use the write_pdd tool to incrementally build the document. Use read_pdd to review your progress.
When you are done, provide a final summary without calling any tools.`;

// ============================================
// Main Agent Loop
// ============================================

export interface AgentLoopParams {
  ctx: ActionCtx;
  apiKey: string;
  model: string;
  jobId: Id<"jobs">;
  sessionId: Id<"agentSessions">;
  cacheName: string;
  maxIterations: number;
}

export interface AgentLoopResult {
  iterations: number;
  processIdMap: Map<string, Id<"processes">>;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  userStopped: boolean;
  stopAction?: "stop" | "pause";
}

export async function runAgentLoop(
  params: AgentLoopParams
): Promise<AgentLoopResult> {
  const {
    ctx,
    apiKey,
    model,
    jobId,
    sessionId,
    cacheName,
    maxIterations,
  } = params;

  const loopStartTime = Date.now();
  const processIdMap = new Map<string, Id<"processes">>();

  // Token tracking
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let cacheTokenCount = 0;
  const cacheCreatedAt = Date.now();

  // Build initial conversation
  const messages: GeminiMessage[] = [
    {
      role: "user",
      parts: [{ text: AGENT_USER_PROMPT }],
    },
  ];

  let iteration = 0;

  // Emit initial state
  await emitEvent(ctx, jobId, "state_changed", {
    state: "analyzing",
    message: "Agent is analyzing the video...",
  });

  let userStopped = false;
  let stopAction: "stop" | "pause" | undefined;

  while (iteration < maxIterations) {
    iteration++;

    // Safety: check if we're running out of time
    const elapsed = Date.now() - loopStartTime;
    if (elapsed > AGENT_CONFIG.maxRunTimeMs) {
      await emitEvent(ctx, jobId, "error", {
        message: `Approaching timeout after ${Math.round(elapsed / 1000)}s. Saving current progress.`,
        recoverable: true,
      }, iteration);
      break;
    }

    // Check if user requested stop/pause
    const currentSession = await ctx.runQuery(
      internal.agentSessions.getSessionForJobInternal, { jobId }
    );
    if (currentSession?.stopRequested) {
      stopAction = currentSession.stopRequested;
      userStopped = true;
      const actionLabel = stopAction === "pause" ? "Pausing" : "Stopping";
      await emitEvent(ctx, jobId, "state_changed", {
        state: stopAction === "pause" ? "paused" : "completing",
        message: `${actionLabel} by user request. Saving current progress...`,
      }, iteration);
      break;
    }

    const stepStartTime = Date.now();
    const tokensBefore = { input: inputTokens, output: outputTokens, cached: cachedTokens };

    // Call Gemini with retry logic
    let response: any;
    try {
      response = await callWithRetry(
        () => generateContentWithCache(apiKey, model, cacheName, messages),
        AGENT_CONFIG.maxRetries
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await emitEvent(ctx, jobId, "error", {
        message: `Gemini API error: ${msg}`,
        recoverable: false,
      }, iteration);
      break;
    }

    // Track token usage
    const usage = response.usageMetadata;
    if (usage) {
      inputTokens += usage.promptTokenCount || 0;
      outputTokens += usage.candidatesTokenCount || 0;
      cachedTokens += usage.cachedContentTokenCount || 0;

      if (!cacheTokenCount && usage.cachedContentTokenCount) {
        cacheTokenCount = usage.cachedContentTokenCount;
      }
    }

    // Per-step cost
    const stepInputTokens = inputTokens - tokensBefore.input;
    const stepOutputTokens = outputTokens - tokensBefore.output;
    const stepCachedTokens = cachedTokens - tokensBefore.cached;

    // Extract response parts
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) {
      const finishReason = candidate?.finishReason;

      if (finishReason === "MALFORMED_FUNCTION_CALL") {
        console.warn(`Iteration ${iteration}: MALFORMED_FUNCTION_CALL. Retrying with hint.`);
        messages.push({
          role: "user",
          parts: [
            {
              text: "System Notification: Your last attempt to call a tool failed with MALFORMED_FUNCTION_CALL. Please try again, carefully ensuring all required arguments are present and correctly typed.",
            },
          ],
        });
        await emitEvent(ctx, jobId, "state_changed", {
          state: "analyzing",
          message: "Retrying malformed tool call...",
        }, iteration);
        continue;
      }

      if (finishReason === "STOP") {
        console.log(`Iteration ${iteration}: Model finished with STOP and no content — clean exit.`);
        break;
      }

      await emitEvent(ctx, jobId, "error", {
        message: `Empty response from model (finishReason: ${finishReason || "unknown"})`,
        recoverable: true,
      }, iteration);
      break;
    }

    const parts = candidate.content.parts;
    const textParts = parts.filter((p: any) => p.text);
    const functionCallParts = parts.filter((p: any) => p.functionCall);

    // Emit thinking text
    const thinkingText = textParts.map((p: any) => p.text).join("");
    if (thinkingText) {
      await emitEvent(ctx, jobId, "thinking", {
        text: thinkingText,
      }, iteration);
    }

    // Add model response to conversation
    messages.push({ role: "model", parts });

    // If no function calls, model is done
    if (functionCallParts.length === 0) {
      break;
    }

    // Execute tool calls
    const functionResponses: any[] = [];

    for (const part of functionCallParts) {
      const fc = part.functionCall;
      const toolName: string = fc.name;
      const toolArgs: Record<string, unknown> = fc.args || {};

      await emitEvent(ctx, jobId, "tool_call", {
        tool: toolName,
        args: toolArgs,
      }, iteration);

      const result = await executeTool(ctx, toolName, toolArgs, jobId, processIdMap);

      const summary = result.success
        ? `OK - ${result.stats ? `${result.stats.processCount} processes, ${result.stats.stepCount} steps, ${result.stats.nodeCount} nodes` : "done"}`
        : `Error: ${result.error}`;

      await emitEvent(ctx, jobId, "tool_result", {
        tool: toolName,
        success: result.success,
        summary,
      }, iteration);

      if (toolName === "write_pdd" && result.success && result.stats) {
        await emitEvent(ctx, jobId, "pdd_updated", {
          stats: result.stats,
          section: (toolArgs as any).operation || "unknown",
        }, iteration);
      }

      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: result,
        },
      });
    }

    // Feed tool results back to conversation
    messages.push({ role: "user", parts: functionResponses });

    // Step timing and cost
    const stepDuration = Date.now() - stepStartTime;
    const totalCost = calculateTotalCost(
      inputTokens, outputTokens, cachedTokens,
      cacheTokenCount, cacheCreatedAt
    );

    // Emit progress
    await emitEvent(ctx, jobId, "progress", {
      iteration,
      maxIterations,
      tokensUsed: { input: inputTokens, output: outputTokens, cached: cachedTokens },
      cost: totalCost,
      stepTokens: { input: stepInputTokens, output: stepOutputTokens, cached: stepCachedTokens },
      stepDuration,
      elapsed: Date.now() - loopStartTime,
    }, iteration);

    // Update session in DB
    await ctx.runMutation(internal.agentSessions.updateSession, {
      sessionId,
      iteration,
      inputTokens,
      outputTokens,
      cachedTokens,
      totalCost,
      processIdMap: JSON.stringify(Object.fromEntries(processIdMap)),
    });

    // Update job progress (map iteration to 25-90% range)
    const progressPct = 25 + Math.round((iteration / maxIterations) * 65);
    await ctx.runMutation(internal.internal.updateJobStatus, {
      jobId,
      status: "processing",
      progress: Math.min(progressPct, 90),
    });

    // Log API call
    await ctx.runMutation(internal.apiLogs.logApiCall, {
      model,
      category: "agent_analysis",
      source: "agentLoop.ts",
      promptTokens: stepInputTokens,
      completionTokens: stepOutputTokens,
      durationMs: stepDuration,
      status: "success",
    });

    // Refresh cache TTL periodically
    if (iteration % AGENT_CONFIG.cacheRefreshEveryNIterations === 0) {
      try {
        await refreshGeminiCacheTTL(
          apiKey,
          cacheName,
          AGENT_CONFIG.cacheTtlMinutes * 60
        );
      } catch (err) {
        console.warn("Failed to refresh cache TTL:", err);
      }
    }
  }

  // Handle max iterations reached
  if (iteration >= maxIterations) {
    await emitEvent(ctx, jobId, "error", {
      message: `Reached maximum iterations (${maxIterations}). PDD saved with current progress.`,
      recoverable: false,
    }, iteration);
  }

  const totalCost = calculateTotalCost(
    inputTokens, outputTokens, cachedTokens,
    cacheTokenCount, cacheCreatedAt
  );

  return {
    iterations: iteration,
    processIdMap,
    totalCost,
    inputTokens,
    outputTokens,
    cachedTokens,
    userStopped,
    stopAction,
  };
}

// ============================================
// Helper: Emit Event to DB
// ============================================

async function emitEvent(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  eventType: string,
  payload: Record<string, unknown>,
  iteration?: number
): Promise<void> {
  await ctx.runMutation(internal.agentEvents.insertEvent, {
    jobId,
    eventType: eventType as any,
    payload: JSON.stringify(payload),
    iteration,
  });
}

// ============================================
// Helper: Cost Calculations
// ============================================

function calculateStepCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number
): number {
  const nonCachedInput = inputTokens - cachedTokens;
  return (
    (Math.max(0, nonCachedInput) / 1_000_000) * AGENT_CONFIG.cost.inputPer1MTokens +
    (cachedTokens / 1_000_000) * AGENT_CONFIG.cost.cachedInputPer1MTokens +
    (outputTokens / 1_000_000) * AGENT_CONFIG.cost.outputPer1MTokens
  );
}

function calculateCacheStorageCost(
  cacheTokenCount: number,
  cacheCreatedAt: number
): number {
  if (!cacheCreatedAt || !cacheTokenCount) return 0;
  const hours = Math.max(0, (Date.now() - cacheCreatedAt) / (1000 * 60 * 60));
  return (cacheTokenCount / 1_000_000) * hours * AGENT_CONFIG.cost.cacheStoragePer1MTokensPerHour;
}

function calculateTotalCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number,
  cacheTokenCount: number,
  cacheCreatedAt: number
): number {
  return (
    calculateStepCost(inputTokens, outputTokens, cachedTokens) +
    calculateCacheStorageCost(cacheTokenCount, cacheCreatedAt)
  );
}

// ============================================
// Helper: Retry with Exponential Backoff
// ============================================

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const error = err as Error & { status?: number };

      // Retry on rate limit or server errors
      const status = error.status;
      if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
        const delay = Math.min(
          AGENT_CONFIG.retryBaseDelayMs * Math.pow(2, attempt),
          AGENT_CONFIG.retryMaxDelayMs
        );
        console.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries}): ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry other errors
      throw err;
    }
  }

  throw lastError;
}
