"use node";

/**
 * Video Analysis Action
 *
 * Main entry point for analyzing screen recordings and generating
 * Process Design Documents (PDD) with flowchart support.
 */

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Prompts and schemas
import { SYSTEM_PROMPT_V2, USER_PROMPT_V2, JSON_SCHEMA_V2 } from "./prompts";

// Types
import { PDDAnalysisResultV2 } from "./types";

// Gemini API helpers
import {
  uploadBufferToGemini,
  waitForFileProcessing,
  generateContentWithGemini,
  deleteGeminiFile,
} from "./geminiApi";

// Process data handling
import {
  processProcessData,
  sortProcesses,
  processSubprocesses,
  SUBPROCESS_COLORS,
} from "./processDataHandler";

// ============================================
// Progress Update Helper
// ============================================

async function updateProgress(
  ctx: ActionCtx,
  jobId: Id<"jobs">,
  progress: number,
  extras: { rawAiResponse?: string } = {}
) {
  await ctx.runMutation(internal.internal.updateJobStatus, {
    jobId,
    status: "processing",
    progress,
    ...extras,
  });
}

// ============================================
// Main Analysis Action
// ============================================

export const analyzeVideo = action({
  args: {
    jobId: v.id("jobs"),
    videoStorageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log("=== analyzeVideo action started ===");
    console.log("Job ID:", args.jobId);
    console.log("Video Storage ID:", args.videoStorageId);

    // Get job to read analysis options
    const job = await ctx.runQuery(internal.internal.getJobById, { jobId: args.jobId });
    const analysisOptions = {
      autoExtractScreenshots: job?.autoExtractScreenshots ?? true,
      autoBoundingBoxes: job?.autoBoundingBoxes ?? true,
      autoSensitiveInfo: job?.autoSensitiveInfo ?? false,
      sensitiveInfoPrompt: job?.sensitiveInfoPrompt,
    };
    console.log("Analysis options:", analysisOptions);

    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      await ctx.runMutation(internal.internal.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to retrieve API key",
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

    let uploadedFileName: string | null = null;

    try {
      // ========================================
      // Phase 1: Download Video
      // ========================================
      await updateProgress(ctx, args.jobId, 0);

      const videoUrl = await ctx.storage.getUrl(args.videoStorageId);
      if (!videoUrl) {
        throw new Error("Could not get video URL from storage");
      }

      await updateProgress(ctx, args.jobId, 5);

      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      console.log(`Video downloaded: ${videoBuffer.length} bytes`);

      // ========================================
      // Phase 2: Upload to Gemini
      // ========================================
      await updateProgress(ctx, args.jobId, 15);

      console.log("Uploading video to Gemini...");
      const uploadResult = await uploadBufferToGemini(
        apiKey,
        videoBuffer,
        "video/mp4",
        `video-${args.jobId}`
      );
      uploadedFileName = uploadResult.name;
      console.log("Upload successful:", uploadResult.name);

      // ========================================
      // Phase 3: Wait for Processing
      // ========================================
      await updateProgress(ctx, args.jobId, 30);

      console.log("Waiting for video processing...");
      const processedFile = await waitForFileProcessing(apiKey, uploadResult);
      console.log("Video processing complete");

      // ========================================
      // Phase 4: AI Analysis
      // ========================================
      await updateProgress(ctx, args.jobId, 45);

      // Get custom prompts and model from database (or use defaults)
      const customPrompts = await ctx.runQuery(internal.settings.getAnalysisPromptsInternal);

      const systemPrompt = customPrompts.systemPrompt || SYSTEM_PROMPT_V2;
      const userPrompt = customPrompts.userPrompt || USER_PROMPT_V2;
      const selectedModel = customPrompts.model || "gemini-3-flash-preview";

      // Parse custom schema if provided, otherwise use default
      let responseSchema = JSON_SCHEMA_V2;
      if (customPrompts.schema) {
        try {
          responseSchema = JSON.parse(customPrompts.schema);
          console.log("Using custom JSON schema from settings");
        } catch (schemaError) {
          console.warn("Failed to parse custom schema, using default:", schemaError);
        }
      }

      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      console.log("Using model:", selectedModel);
      console.log("Using custom prompts:", !!customPrompts.systemPrompt || !!customPrompts.userPrompt);
      console.log("Calling Gemini API for video analysis...");

      const startTime = Date.now();
      let responseText = "";
      let usageMetadata;

      try {
        const result = await generateContentWithGemini(
          apiKey,
          selectedModel,
          processedFile.uri,
          processedFile.mimeType,
          fullPrompt,
          { responseSchema }
        );
        responseText = result.text;
        usageMetadata = result.usageMetadata;

        // Log successful call
        await ctx.runMutation(internal.apiLogs.logApiCall, {
          model: selectedModel,
          category: "video_analysis",
          source: "analyze.ts",
          promptTokens: usageMetadata?.promptTokenCount || 0,
          completionTokens: usageMetadata?.candidatesTokenCount || 0,
          durationMs: Date.now() - startTime,
          status: "success",
        });
      } catch (apiError) {
        const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        // Log failed call
        await ctx.runMutation(internal.apiLogs.logApiCall, {
          model: selectedModel,
          category: "video_analysis",
          source: "analyze.ts",
          promptTokens: 0,
          completionTokens: 0,
          durationMs: Date.now() - startTime,
          status: "error",
          errorMessage: errorMsg,
        });
        throw apiError;
      }

      console.log(`Gemini response received: ${responseText.length} chars`);

      // ========================================
      // Phase 5: Parse Response
      // ========================================
      await updateProgress(ctx, args.jobId, 60);

      // Save raw response for debugging
      try {
        await updateProgress(ctx, args.jobId, 62, { rawAiResponse: responseText });
        console.log("Raw AI response saved");
      } catch (saveError) {
        console.error("Failed to save raw AI response:", saveError);
      }

      let analysisResult: PDDAnalysisResultV2;
      try {
        analysisResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`JSON parse error at response length: ${responseText.length}`);
        throw new Error(
          `Failed to parse Gemini response as JSON: ${parseError}. Response length: ${responseText.length} chars`
        );
      }

      if (!analysisResult.processes || analysisResult.processes.length === 0) {
        throw new Error("No processes found in Gemini response");
      }

      console.log(`Found ${analysisResult.processes.length} process(es)`);

      // ========================================
      // Phase 6: Store Processes
      // ========================================
      await updateProgress(ctx, args.jobId, 65);

      const processIdMap = new Map<string, Id<"processes">>();
      const { mainProcesses, subprocesses } = sortProcesses(analysisResult.processes);

      const totalProcesses = mainProcesses.length + subprocesses.length;
      let mainProcessId: Id<"processes"> | null = null;
      let colorCounter = 0;

      // Process main processes
      for (let i = 0; i < mainProcesses.length; i++) {
        const processData = mainProcesses[i];

        await updateProgress(
          ctx,
          args.jobId,
          70 + Math.round((i / Math.max(totalProcesses, 1)) * 20)
        );

        const processId = await processProcessData(
          ctx,
          processData,
          args.jobId,
          null,
          1, // hierarchy level
          colorCounter++ % SUBPROCESS_COLORS,
          processIdMap
        );

        if (!mainProcessId) {
          mainProcessId = processId;
        }

        console.log(`Created main process: ${processData.process_name}`);
      }

      // Process subprocesses
      await processSubprocesses(
        ctx,
        subprocesses,
        analysisResult.processes,
        args.jobId,
        processIdMap,
        colorCounter,
        async (processed, total) => {
          await updateProgress(
            ctx,
            args.jobId,
            70 + Math.round(((mainProcesses.length + processed) / Math.max(totalProcesses, 1)) * 20)
          );
        }
      );

      // ========================================
      // Phase 6.5: Update Subprocess References in Flows
      // ========================================
      // After all subprocesses are created, update flow nodes to use database IDs
      if (processIdMap.size > 0) {
        const processIdMappings = Array.from(processIdMap.entries()).map(
          ([geminiId, databaseId]) => ({ geminiId, databaseId })
        );
        await ctx.runMutation(internal.flows.updateFlowSubprocessIds, {
          processIdMap: processIdMappings,
        });
        console.log(`Updated subprocess references in flows (${processIdMappings.length} mappings)`);
      }

      // ========================================
      // Phase 7: Complete Job
      // ========================================
      await updateProgress(ctx, args.jobId, 95);

      if (!mainProcessId) {
        throw new Error("No main process was created");
      }

      await ctx.runMutation(internal.internal.completeJob, {
        jobId: args.jobId,
        processId: mainProcessId,
      });

      console.log("Job completed successfully");

      // ========================================
      // Cleanup
      // ========================================
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

      console.error("Analysis failed:", errorMessage);

      await ctx.runMutation(internal.internal.updateJobStatus, {
        jobId: args.jobId,
        status: "failed",
        errorMessage,
      });

      // Attempt cleanup on error
      if (uploadedFileName) {
        try {
          await deleteGeminiFile(apiKey, uploadedFileName);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  },
});
