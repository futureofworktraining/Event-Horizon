"use node";

/**
 * Workflow Execution Action
 *
 * Runs AI workflows on processes or jobs, executing each step
 * and storing results for review.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { generateContentWithGemini } from "./geminiApi";

// ============================================
// Workflow Execution Action
// ============================================

export const runWorkflow = action({
  args: {
    workflowId: v.id("workflows"),
    processId: v.optional(v.id("processes")),
    jobId: v.optional(v.id("jobs")),
    testMode: v.optional(v.boolean()), // If true, only runs first step for quick testing
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    runId: Id<"workflowRuns">;
    stepResults: Array<{
      stepId: string;
      status: "completed" | "failed" | "skipped";
      output?: string;
      error?: string;
      tokensUsed?: number;
      durationMs?: number;
    }>;
    totalDurationMs: number;
    errorMessage?: string;
  }> => {
    const startTime = Date.now();
    console.log("=== runWorkflow action started ===");
    console.log("Workflow ID:", args.workflowId);
    console.log("Process ID:", args.processId);
    console.log("Test Mode:", args.testMode);

    // Get API key from database (encrypted)
    let apiKey: string | null = null;
    try {
      apiKey = await ctx.runAction(internal.settingsActions.getGeminiApiKeyInternal);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Failed to retrieve API key");
    }
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Please set it in Settings.");
    }

    // Get workflow definition
    const workflow = await ctx.runQuery(api.workflows.getWorkflow, {
      workflowId: args.workflowId,
    });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    console.log(`Running workflow: ${workflow.name} with ${workflow.steps.length} steps`);

    // Create workflow run record
    const runId = await ctx.runMutation(internal.workflows.createWorkflowRun, {
      workflowId: args.workflowId,
      processId: args.processId,
      jobId: args.jobId,
      stepIds: workflow.steps.map((s: { stepId: string }) => s.stepId),
    });

    // Update run status to running
    await ctx.runMutation(internal.workflows.updateWorkflowRunStatus, {
      runId,
      status: "running",
    });

    const stepResults: Array<{
      stepId: string;
      status: "completed" | "failed" | "skipped";
      output?: string;
      error?: string;
      tokensUsed?: number;
      durationMs?: number;
    }> = [];

    // Store step outputs for chaining
    const stepOutputs: Map<string, string> = new Map();
    let totalTokens = 0;

    // Get process data if available (for context)
    let processContext = "";
    if (args.processId) {
      const process = await ctx.runQuery(api.processes.getProcess, {
        processId: args.processId,
      });
      if (process) {
        processContext = `Process: ${process.processName}\nDescription: ${process.processDescription}\nSteps: ${process.totalSteps}`;
      }
    }

    // Execute each step
    const stepsToRun = args.testMode ? workflow.steps.slice(0, 1) : workflow.steps;

    for (const step of stepsToRun) {
      console.log(`\n--- Executing step: ${step.name} (${step.stepId}) ---`);
      const stepStartTime = Date.now();

      // Update step status to running
      await ctx.runMutation(internal.workflows.updateWorkflowStepResult, {
        runId,
        stepId: step.stepId,
        status: "running",
      });

      try {
        // Build input based on step configuration
        let inputContent = "";

        switch (step.input.type) {
          case "text":
            inputContent = processContext;
            break;
          case "previous_step":
            // Get output from previous step
            if (step.input.sources && step.input.sources.length > 0) {
              inputContent = step.input.sources
                .map((sourceId: string) => stepOutputs.get(sourceId) || "")
                .filter(Boolean)
                .join("\n\n---\n\n");
            } else if (stepResults.length > 0) {
              // Default to last step's output
              const lastResult = stepResults[stepResults.length - 1];
              inputContent = lastResult.output || "";
            }
            break;
          case "combined":
            // Combine multiple sources
            if (step.input.sources) {
              inputContent = step.input.sources
                .map((sourceId: string) => stepOutputs.get(sourceId) || "")
                .filter(Boolean)
                .join("\n\n---\n\n");
            }
            if (processContext) {
              inputContent = processContext + "\n\n---\n\n" + inputContent;
            }
            break;
          case "video":
          case "image":
            // For video/image, we'd need to handle file uploads
            // For now, use process context as a fallback
            inputContent = processContext || "No video/image input available in test mode.";
            break;
        }

        // Build prompt
        const fullPrompt = `${step.systemPrompt}\n\n${step.userPrompt}\n\nInput:\n${inputContent}`;

        // Configure generation
        const generationConfig: {
          responseSchema?: object;
          maxOutputTokens?: number;
          temperature?: number;
        } = {};

        if (step.output.type === "structured" && step.output.schema) {
          try {
            generationConfig.responseSchema = JSON.parse(step.output.schema);
          } catch (e) {
            console.warn("Failed to parse output schema:", e);
          }
        }

        if (step.options?.maxOutputTokens) {
          generationConfig.maxOutputTokens = step.options.maxOutputTokens;
        }

        if (step.options?.temperature !== undefined) {
          generationConfig.temperature = step.options.temperature;
        }

        // Call Gemini API (text-only mode for testing)
        console.log(`Calling ${step.model} with prompt length: ${fullPrompt.length}`);

        const stepApiStartTime = Date.now();
        const result = await generateContentWithGemini(
          apiKey,
          step.model,
          undefined, // No file URI for text-only
          undefined, // No mime type
          fullPrompt,
          generationConfig
        );
        const response = result.text;
        const usageMetadata = result.usageMetadata;

        const stepDuration = Date.now() - stepStartTime;
        const apiDuration = Date.now() - stepApiStartTime;

        // Log call
        await ctx.runMutation(internal.apiLogs.logApiCall, {
          model: step.model,
          category: "workflow",
          source: `runWorkflow.ts - ${step.name}`,
          promptTokens: usageMetadata?.promptTokenCount || 0,
          completionTokens: usageMetadata?.candidatesTokenCount || 0,
          durationMs: apiDuration,
          status: "success",
          processId: args.processId,
        });

        // Store output for chaining
        if (step.output.variableName) {
          stepOutputs.set(step.output.variableName, response);
        }
        stepOutputs.set(step.stepId, response);

        // Use actual token usage from API
        const tokensUsed = usageMetadata?.totalTokenCount || Math.ceil((fullPrompt.length + response.length) / 4);
        totalTokens += tokensUsed;

        // Update step result
        await ctx.runMutation(internal.workflows.updateWorkflowStepResult, {
          runId,
          stepId: step.stepId,
          status: "completed",
          output: response.substring(0, 50000), // Truncate for storage
          tokensUsed,
        });

        stepResults.push({
          stepId: step.stepId,
          status: "completed",
          output: response.substring(0, 10000), // Truncate for response
          tokensUsed,
          durationMs: stepDuration,
        });

        console.log(`Step completed in ${stepDuration}ms, ~${tokensUsed} tokens`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const stepDuration = Date.now() - stepStartTime;

        console.error(`Step failed:`, errorMessage);

        // Update step result with error
        await ctx.runMutation(internal.workflows.updateWorkflowStepResult, {
          runId,
          stepId: step.stepId,
          status: "failed",
          error: errorMessage,
        });

        stepResults.push({
          stepId: step.stepId,
          status: "failed",
          error: errorMessage,
          durationMs: stepDuration,
        });

        // Continue to next step (don't fail entire workflow)
      }
    }

    // Skip remaining steps if in test mode
    if (args.testMode && workflow.steps.length > 1) {
      for (let i = 1; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        await ctx.runMutation(internal.workflows.updateWorkflowStepResult, {
          runId,
          stepId: step.stepId,
          status: "skipped",
        });
        stepResults.push({
          stepId: step.stepId,
          status: "skipped",
        });
      }
    }

    // Update run status to completed
    const hasFailures = stepResults.some((r) => r.status === "failed");
    await ctx.runMutation(internal.workflows.updateWorkflowRunStatus, {
      runId,
      status: hasFailures ? "failed" : "completed",
      totalTokensUsed: totalTokens,
    });

    const totalDuration = Date.now() - startTime;
    console.log(`\n=== Workflow completed in ${totalDuration}ms ===`);

    return {
      success: !hasFailures,
      runId,
      stepResults,
      totalDurationMs: totalDuration,
      errorMessage: hasFailures ? "One or more steps failed" : undefined,
    };
  },
});

/**
 * Get workflow runs for a workflow (for UI display)
 */
export const getRecentWorkflowRuns = action({
  args: {
    workflowId: v.id("workflows"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown[]> => {
    const runs = await ctx.runQuery(api.workflows.getWorkflowRuns, {
      workflowId: args.workflowId,
      limit: args.limit || 5,
    });
    return runs || [];
  },
});
