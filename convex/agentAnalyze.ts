"use node";

/**
 * Agent Analysis Action
 *
 * Entry point for agent-mode video analysis.
 * Orchestrates: video upload -> cache creation -> agent loop -> post-processing -> cleanup.
 * Runs entirely inside a Convex action (no separate server needed).
 */

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

import {
  uploadBufferToGemini,
  waitForFileProcessing,
  createGeminiCache,
  deleteGeminiCache,
  deleteGeminiFile,
} from "./geminiApi";

import { getToolDeclarations } from "./agentTools";
import { runAgentLoop } from "./agentLoop";
import { JSON_SCHEMA } from "./prompts/jsonSchema";

// ============================================
// Constants
// ============================================

const DEFAULT_MAX_ITERATIONS = 50;
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

// ============================================
// Tool Instructions Appendix for System Prompt
// ============================================

const TOOL_INSTRUCTIONS = `

## Tool Instructions

You have access to two tools to incrementally build the PDD document:

### read_pdd
Read the current state of the PDD document you are building.
- Use \`section: "full"\` to see the entire document
- Use \`section: "processes"\` to see just the process list
- Use \`section: "steps"\` to see steps for a specific process (provide process_id)
- Use \`section: "flow"\` to see flow nodes/edges for a specific process (provide process_id)
- Use \`section: "metadata"\` to see process metadata (applications, rules, exceptions)

**Use read_pdd frequently** to review your work, check completeness, and verify the structure.

### write_pdd
Write or update sections of the PDD document.
- \`operation: "add_process"\` - Add a new process. Provide data with process_id, process_name, process_description, and optional fields.
- \`operation: "update_process"\` - Update process metadata. Provide process_id and data with fields to update.
- \`operation: "set_processes"\` - Replace ALL processes (use sparingly, mainly for initial setup).
- \`operation: "add_steps"\` - Add steps to a process. Provide process_id and data.steps array.
- \`operation: "set_flow"\` - Set/replace the flow (nodes + edges) for a process. Provide process_id and data with nodes and edges arrays.
- \`operation: "update_metadata"\` - Update applications, business_rules_observed, exceptions_noted for a process.

## Your Task

Analyze the video provided in context and build a complete PDD document. You decide:
- **What to analyze first** - overview, then details, or dive into specific sections
- **When to write** - early and often with incremental updates, or in larger batches
- **When to read** - check your progress, verify completeness, catch errors
- **When you're done** - when ALL processes, steps, flow nodes, and edges are documented

## Completion Criteria

When you are confident that:
1. ALL processes observed in the video are documented
2. ALL steps within each process are captured with correct timestamps
3. ALL flow nodes (start, end, action, decision, merge, etc.) are created
4. ALL edges properly connect the flow nodes with correct labels
5. Applications, business rules, and exceptions are noted

Then simply provide your **final summary** without calling any tools. This signals completion.

## Quality Guidelines

- Be thorough - capture EVERY user action and system response
- Use read_pdd to self-review before finishing
- Ensure flow connectivity - every node must be reachable from start
- Decision nodes must have exactly 2 outgoing labeled edges
- Step descriptions must start with "User" or "System"
- Timestamps in MM:SS.s format
- Replace specific business data with generic placeholders and \`{{VariableName}}\` format

## JSON Schema Reference

The PDD must conform to this schema:
` + JSON.stringify(JSON_SCHEMA, null, 2);

// ============================================
// Progress Helper
// ============================================

async function updateProgress(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  progress: number
) {
  await ctx.runMutation(internal.internal.updateJobStatus, {
    jobId,
    status: "processing",
    progress,
  });
}

// ============================================
// Main Agent Analysis Action
// ============================================

export const agentAnalyzeVideo = action({
  args: {
    jobId: v.id("jobs"),
    videoStorageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log("=== agentAnalyzeVideo action started ===");
    console.log("Job ID:", args.jobId);

    // Get job to read analysis options
    const job = await ctx.runQuery(internal.internal.getJobById, {
      jobId: args.jobId,
    });
    const maxIterations =
      job?.agentMaxIterations || DEFAULT_MAX_ITERATIONS;

    // Get API key
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(
        internal.settingsActions.getGeminiApiKeyInternal
      );
    } catch (error) {
      await ctx.runMutation(internal.internal.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to retrieve API key",
      });
      return;
    }

    if (!apiKey) {
      await ctx.runMutation(internal.internal.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage:
          "Gemini API key not configured. Please set it in Settings.",
      });
      return;
    }

    // Get model from settings
    const modelSetting = await ctx.runQuery(
      internal.settings.getSettingInternal,
      { key: "analysis_model" }
    );
    const model = modelSetting?.value || "gemini-3-flash-preview";

    // Create agent session
    const sessionId = await ctx.runMutation(
      internal.agentSessions.createSession,
      {
        jobId: args.jobId,
        maxIterations,
      }
    );

    let uploadedFileName: string | null = null;
    let cacheName: string | null = null;

    try {
      // ========================================
      // Phase 1: Download Video
      // ========================================
      await updateProgress(ctx, args.jobId, 0);
      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        state: "uploading",
      });
      await ctx.runMutation(internal.agentEvents.insertEvent, {
        jobId: args.jobId,
        eventType: "state_changed",
        payload: JSON.stringify({
          state: "uploading",
          message: "Downloading video from storage...",
        }),
      });

      const videoUrl = await ctx.storage.getUrl(args.videoStorageId);
      if (!videoUrl) {
        throw new Error("Could not get video URL from storage");
      }

      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      console.log(`Video downloaded: ${videoBuffer.length} bytes`);

      // ========================================
      // Phase 2: Upload to Gemini
      // ========================================
      await updateProgress(ctx, args.jobId, 10);

      console.log("Uploading video to Gemini...");
      const uploadResult = await uploadBufferToGemini(
        apiKey,
        videoBuffer,
        "video/mp4",
        `agent-video-${args.jobId}`
      );
      uploadedFileName = uploadResult.name;
      console.log("Upload successful:", uploadResult.name);

      // ========================================
      // Phase 3: Wait for Processing
      // ========================================
      await updateProgress(ctx, args.jobId, 15);

      console.log("Waiting for video processing...");
      const processedFile = await waitForFileProcessing(apiKey, uploadResult);
      console.log("Video processing complete");

      // ========================================
      // Phase 4: Create Context Cache
      // ========================================
      await updateProgress(ctx, args.jobId, 20);
      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        state: "caching",
      });
      await ctx.runMutation(internal.agentEvents.insertEvent, {
        jobId: args.jobId,
        eventType: "state_changed",
        payload: JSON.stringify({
          state: "caching",
          message: "Creating context cache with video + system prompt + tools...",
        }),
      });

      // Get system prompt from DB (same priority logic as analyze.ts)
      let systemPromptContent = await getSystemPrompt(ctx, job);

      // Append tool instructions to the system prompt
      systemPromptContent += TOOL_INSTRUCTIONS;

      // Create cache
      const toolDeclarations = getToolDeclarations();
      console.log("Creating Gemini cache...");
      const cacheResult = await createGeminiCache(
        apiKey,
        model,
        processedFile.uri,
        processedFile.mimeType,
        systemPromptContent,
        toolDeclarations,
        CACHE_TTL_SECONDS
      );
      cacheName = cacheResult.cacheName;
      console.log("Cache created:", cacheName);

      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        cacheName,
        cacheCreatedAt: Date.now(),
      });

      // ========================================
      // Phase 5: Run Agent Loop
      // ========================================
      await updateProgress(ctx, args.jobId, 25);
      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        state: "analyzing",
      });

      console.log(`Starting agent loop (max ${maxIterations} iterations)...`);

      const result = await runAgentLoop({
        ctx,
        apiKey,
        model,
        jobId: args.jobId,
        sessionId,
        cacheName,
        maxIterations,
      });

      console.log(
        `Agent loop completed: ${result.iterations} iterations, $${result.totalCost.toFixed(4)}`
      );

      // ========================================
      // Handle user-requested pause
      // ========================================
      if (result.userStopped && result.stopAction === "pause") {
        console.log("Agent paused by user request");

        // Save conversation history for potential resume
        await ctx.runMutation(internal.agentSessions.updateSession, {
          sessionId,
          state: "paused",
          totalCost: result.totalCost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cachedTokens: result.cachedTokens,
          processIdMap: JSON.stringify(
            Object.fromEntries(result.processIdMap)
          ),
        });

        // Clear the stop request flag
        await ctx.runMutation(internal.agentSessions.clearStopRequest, {
          sessionId,
        });

        await ctx.runMutation(internal.agentEvents.insertEvent, {
          jobId: args.jobId,
          eventType: "state_changed",
          payload: JSON.stringify({
            state: "paused",
            message: `Analysis paused after ${result.iterations} iterations. Use Resume to continue.`,
          }),
        });

        // Cleanup Gemini resources
        if (cacheName) {
          try { await deleteGeminiCache(apiKey, cacheName); } catch { /* ignore */ }
        }
        if (uploadedFileName) {
          try { await deleteGeminiFile(apiKey, uploadedFileName); } catch { /* ignore */ }
        }

        return; // Exit without completing the job
      }

      // ========================================
      // Phase 6: Finalize (normal completion or user stop)
      // ========================================
      await updateProgress(ctx, args.jobId, 92);

      if (result.userStopped) {
        // Clear the stop request flag
        await ctx.runMutation(internal.agentSessions.clearStopRequest, {
          sessionId,
        });
      }

      // Update subprocess flow references
      if (result.processIdMap.size > 0) {
        const processIdMappings = Array.from(
          result.processIdMap.entries()
        ).map(([geminiId, databaseId]) => ({ geminiId, databaseId }));

        await ctx.runMutation(internal.flows.updateFlowSubprocessIds, {
          processIdMap: processIdMappings,
        });
        console.log(
          `Updated subprocess references (${processIdMappings.length} mappings)`
        );
      }

      // Find the main process
      let mainProcessId: Id<"processes"> | null = null;
      for (const [, processId] of result.processIdMap) {
        mainProcessId = processId;
        break; // First created process is the main one
      }

      if (!mainProcessId) {
        throw new Error(
          "No processes were created by the agent. The analysis may have failed."
        );
      }

      // ========================================
      // Phase 7: Complete Job
      // ========================================
      await updateProgress(ctx, args.jobId, 95);

      await ctx.runMutation(internal.internal.completeJob, {
        jobId: args.jobId,
        processId: mainProcessId,
      });

      // Update session to completed
      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        state: "completed",
        completedAt: Date.now(),
        totalCost: result.totalCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cachedTokens: result.cachedTokens,
        processIdMap: JSON.stringify(
          Object.fromEntries(result.processIdMap)
        ),
      });

      // Emit completion event
      await ctx.runMutation(internal.agentEvents.insertEvent, {
        jobId: args.jobId,
        eventType: "completed",
        payload: JSON.stringify({
          iterations: result.iterations,
          totalCost: result.totalCost,
          userStopped: result.userStopped || false,
          tokensUsed: {
            input: result.inputTokens,
            output: result.outputTokens,
            cached: result.cachedTokens,
          },
        }),
      });

      console.log(
        result.userStopped
          ? "Agent analysis stopped by user, finalized with current progress"
          : "Agent analysis completed successfully"
      );

      // ========================================
      // Cleanup
      // ========================================
      if (cacheName) {
        try {
          await deleteGeminiCache(apiKey, cacheName);
          console.log("Cache cleaned up");
        } catch {
          // Ignore cleanup errors
        }
      }
      if (uploadedFileName) {
        try {
          await deleteGeminiFile(apiKey, uploadedFileName);
          console.log("Gemini file cleaned up");
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      console.error("Agent analysis failed:", errorMessage);

      await ctx.runMutation(internal.internal.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage,
      });

      await ctx.runMutation(internal.agentSessions.updateSession, {
        sessionId,
        state: "error",
        error: errorMessage,
        completedAt: Date.now(),
      });

      await ctx.runMutation(internal.agentEvents.insertEvent, {
        jobId: args.jobId,
        eventType: "error",
        payload: JSON.stringify({
          message: errorMessage,
          recoverable: false,
        }),
      });

      // Cleanup on error
      if (cacheName) {
        try {
          await deleteGeminiCache(apiKey, cacheName);
        } catch {
          // Ignore
        }
      }
      if (uploadedFileName) {
        try {
          await deleteGeminiFile(apiKey, uploadedFileName);
        } catch {
          // Ignore
        }
      }
    }
  },
});

// ============================================
// Helper: Get System Prompt from DB
// ============================================

async function getSystemPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: ActionCtx, job: any
): Promise<string> {
  let content: string | null = null;

  // Check if re-analysis with unified prompt
  if (job?.processId) {
    const existingProcess = await ctx.runQuery(
      internal.processes.getProcessInternal,
      { processId: job.processId }
    );

    if (existingProcess?.unifiedSystemPromptId) {
      const prompt = await ctx.runQuery(
        internal.unifiedPrompts.getPromptInternal,
        { id: existingProcess.unifiedSystemPromptId }
      );
      if (prompt) content = prompt.content;
    }

    if (!content && existingProcess?.systemPromptId) {
      const prompt = await ctx.runQuery(
        internal.analysisPrompts.getSystemPromptInternal,
        { id: existingProcess.systemPromptId }
      );
      if (prompt) content = prompt.content;
    }
  }

  // Get default from unified prompts
  if (!content) {
    const defaults = await ctx.runQuery(
      internal.unifiedPrompts.getDefaultAnalysisPromptsInternal
    );
    if (defaults?.systemPrompt) {
      content = defaults.systemPrompt.content;
    }
  }

  // Fallback to legacy
  if (!content) {
    const legacy = await ctx.runQuery(
      internal.analysisPrompts.getDefaultPromptConfigurationInternal
    );
    if (legacy?.systemPrompt) {
      content = legacy.systemPrompt.content;
    }
  }

  if (!content) {
    throw new Error(
      "No system prompt found. Please run seedBuiltinPrompts to initialize the database."
    );
  }

  return content;
}
