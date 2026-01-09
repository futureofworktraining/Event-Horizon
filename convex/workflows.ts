/**
 * AI Workflows
 *
 * Functions for managing and executing AI workflow definitions.
 * Workflows define multi-step AI pipelines that can be reused and tested.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================
// Available Models (Gemini 3 + Legacy - 2.5 removed as deprecated)
// ============================================

// Thinking effort levels for Gemini 3 models
export const THINKING_EFFORT_LEVELS = {
  "gemini-3-pro-preview": [
    { id: "low", name: "Low", description: "Basic reasoning, faster responses" },
    { id: "high", name: "High", description: "Deep reasoning for complex tasks" },
  ],
  "gemini-3-flash-preview": [
    { id: "minimal", name: "Minimal", description: "Fastest, basic analysis" },
    { id: "low", name: "Low", description: "Quick reasoning" },
    { id: "medium", name: "Medium", description: "Balanced speed and depth" },
    { id: "high", name: "High", description: "Thorough analysis" },
  ],
} as const;

export const GEMINI_MODELS = [
  // Gemini 3 (Latest)
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    description: "Most capable model with advanced reasoning",
    category: "gemini-3",
    supportsVideo: true,
    supportsThinking: true,
    thinkingEffortLevels: ["low", "high"],
    defaultThinkingEffort: "high",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    description: "Fast multimodal with great performance",
    category: "gemini-3",
    supportsVideo: true,
    supportsThinking: true,
    thinkingEffortLevels: ["minimal", "low", "medium", "high"],
    defaultThinkingEffort: "medium",
  },
];

// ============================================
// Workflow Step Validator
// ============================================

const workflowStepValidator = v.object({
  stepId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  model: v.string(),
  input: v.object({
    type: v.union(
      v.literal("video"),
      v.literal("image"),
      v.literal("text"),
      v.literal("previous_step"),
      v.literal("combined")
    ),
    sources: v.optional(v.array(v.string())),
    includeVideo: v.optional(v.boolean()),
    includeScreenshots: v.optional(v.boolean()),
  }),
  systemPrompt: v.string(),
  userPrompt: v.string(),
  output: v.object({
    type: v.union(
      v.literal("json"),
      v.literal("text"),
      v.literal("structured")
    ),
    schema: v.optional(v.string()),
    variableName: v.optional(v.string()),
  }),
  options: v.optional(v.object({
    maxOutputTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
    enableThinking: v.optional(v.boolean()),
    thinkingEffort: v.optional(v.union(
      v.literal("minimal"),
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    thinkingBudget: v.optional(v.number()),
  })),
  condition: v.optional(v.string()),
});

// ============================================
// Query Functions
// ============================================

/**
 * Get all available Gemini models
 */
export const getAvailableModels = query({
  args: {},
  handler: async () => {
    console.log("getAvailableModels query called");
    return GEMINI_MODELS;
  },
});

/**
 * Get all workflows
 */
export const listWorkflows = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let workflows;
    if (args.category) {
      workflows = await ctx.db
        .query("workflows")
        .withIndex("by_category", (q) => q.eq("category", args.category))
        .collect();
    } else {
      workflows = await ctx.db.query("workflows").collect();
    }
    return workflows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single workflow by ID
 */
export const getWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.workflowId);
  },
});

/**
 * Get the default workflow for a category
 */
export const getDefaultWorkflow = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const workflows = await ctx.db
      .query("workflows")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();

    return workflows.find((w) => w.isDefault) || workflows[0] || null;
  },
});

/**
 * Get workflow run history
 */
export const getWorkflowRuns = query({
  args: {
    workflowId: v.optional(v.id("workflows")),
    processId: v.optional(v.id("processes")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let runsQuery;

    if (args.workflowId) {
      const workflowId = args.workflowId; // Narrow the type
      runsQuery = ctx.db
        .query("workflowRuns")
        .withIndex("by_workflow", (q) => q.eq("workflowId", workflowId));
    } else if (args.processId) {
      const processId = args.processId; // Narrow the type
      runsQuery = ctx.db
        .query("workflowRuns")
        .withIndex("by_process", (q) => q.eq("processId", processId));
    } else {
      runsQuery = ctx.db.query("workflowRuns");
    }

    const runs = await runsQuery.collect();
    const sorted = runs.sort((a, b) => b.startedAt - a.startedAt);

    return args.limit ? sorted.slice(0, args.limit) : sorted;
  },
});

/**
 * Get a single workflow run
 */
export const getWorkflowRun = query({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.runId);
  },
});

// ============================================
// Mutation Functions
// ============================================

/**
 * Create a new workflow
 */
export const createWorkflow = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    steps: v.array(workflowStepValidator),
  },
  handler: async (ctx, args) => {
    // If setting as default, unset other defaults in same category
    if (args.isDefault && args.category) {
      const existing = await ctx.db
        .query("workflows")
        .withIndex("by_category", (q) => q.eq("category", args.category))
        .collect();

      for (const workflow of existing) {
        if (workflow.isDefault) {
          await ctx.db.patch(workflow._id, { isDefault: false });
        }
      }
    }

    return ctx.db.insert("workflows", {
      name: args.name,
      description: args.description,
      category: args.category,
      isDefault: args.isDefault,
      steps: args.steps,
      createdAt: Date.now(),
      version: 1,
    });
  },
});

/**
 * Update an existing workflow
 */
export const updateWorkflow = mutation({
  args: {
    workflowId: v.id("workflows"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    steps: v.optional(v.array(workflowStepValidator)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    if (!existing) {
      throw new Error("Workflow not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
      version: (existing.version || 1) + 1,
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.steps !== undefined) updates.steps = args.steps;

    // Handle default flag
    if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;

      // If setting as default, unset other defaults in same category
      if (args.isDefault) {
        const category = args.category || existing.category;
        if (category) {
          const others = await ctx.db
            .query("workflows")
            .withIndex("by_category", (q) => q.eq("category", category))
            .collect();

          for (const workflow of others) {
            if (workflow._id !== args.workflowId && workflow.isDefault) {
              await ctx.db.patch(workflow._id, { isDefault: false });
            }
          }
        }
      }
    }

    await ctx.db.patch(args.workflowId, updates);
    return args.workflowId;
  },
});

/**
 * Delete a workflow
 */
export const deleteWorkflow = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.workflowId);
    return { success: true };
  },
});

/**
 * Duplicate a workflow
 */
export const duplicateWorkflow = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.workflowId);
    if (!original) {
      throw new Error("Workflow not found");
    }

    return ctx.db.insert("workflows", {
      name: `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      isDefault: false,
      steps: original.steps,
      createdAt: Date.now(),
      version: 1,
    });
  },
});

// ============================================
// Internal Mutations for Workflow Execution
// ============================================

export const createWorkflowRun = internalMutation({
  args: {
    workflowId: v.id("workflows"),
    processId: v.optional(v.id("processes")),
    jobId: v.optional(v.id("jobs")),
    stepIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("workflowRuns", {
      workflowId: args.workflowId,
      processId: args.processId,
      jobId: args.jobId,
      status: "pending",
      stepResults: args.stepIds.map((stepId) => ({
        stepId,
        status: "pending" as const,
      })),
      startedAt: Date.now(),
    });
  },
});

export const updateWorkflowRunStatus = internalMutation({
  args: {
    runId: v.id("workflowRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
    totalTokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.errorMessage) updates.errorMessage = args.errorMessage;
    if (args.totalTokensUsed) updates.totalTokensUsed = args.totalTokensUsed;
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }
    await ctx.db.patch(args.runId, updates);
  },
});

export const updateWorkflowStepResult = internalMutation({
  args: {
    runId: v.id("workflowRuns"),
    stepId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;

    const stepResults = run.stepResults.map((result) => {
      if (result.stepId === args.stepId) {
        return {
          ...result,
          status: args.status,
          output: args.output,
          error: args.error,
          tokensUsed: args.tokensUsed,
          startedAt: args.status === "running" ? Date.now() : result.startedAt,
          completedAt:
            args.status === "completed" || args.status === "failed"
              ? Date.now()
              : result.completedAt,
        };
      }
      return result;
    });

    await ctx.db.patch(args.runId, { stepResults });
  },
});

// ============================================
// Default Video Analysis Workflow
// ============================================

// Default system prompt for video analysis (same as SYSTEM_PROMPT_V2)
const DEFAULT_VIDEO_ANALYSIS_SYSTEM_PROMPT = `You are an expert RPA (Robotic Process Automation) Business Analyst specializing in creating Process Design Documents (PDD) from screen recordings. Your task is to analyze a video of a business process and extract detailed, structured documentation with FLOWCHART representation that can be used for automation development.

## Documentation Standards

### Step Descriptions
- Every step description MUST start with either "User" or "System" to indicate who performs the action
- Use present tense action verbs (clicks, types, selects, navigates, verifies)
- Reference UI element names in single quotes (e.g., "User clicks 'Submit' button")
- Be specific about what happens, not vague

### UI Element Location Guidelines
Use a 9-zone grid to describe element positions:
- top_left, top_center, top_right
- middle_left, middle_center, middle_right
- bottom_left, bottom_center, bottom_right
- full_screen (for modals, overlays)

### Timestamp Format
Use MM:SS.s format (e.g., "00:05.2" for 5.2 seconds, "01:30.0" for 1 minute 30 seconds)

### Sensitive Data Handling
- Passwords: Show as "[MASKED]"
- Personal Identifiable Information (PII): Show as "[PII MASKED]"
- Credit card numbers: Show as "[CC MASKED]"
- SSN/Government IDs: Show as "[ID MASKED]"
- Always set is_sensitive: true for these data types

## FLOWCHART STRUCTURE (CRITICAL)

You MUST analyze the video and produce a flowchart representation with NODES and EDGES.

### Node Types
1. **start** - Single entry point
2. **end** - Exit points (success/failure/cancelled/exception)
3. **action** - A step performed by user or system
4. **decision** - Binary decision point (yes/no)
5. **switch** - Multi-way decision (3+ options)
6. **merge** - Where branches converge
7. **subprocess** - Reference to nested process
8. **loop_back** - Return to earlier node

### Action Types
1. ui_interaction - Direct interaction with UI elements
2. navigation - Moving between pages, applications, tabs
3. data_transfer - Reading, copying, pasting data
4. explanation - Business rules, decisions, notes
5. wait - Waiting for elements, pages, processes
6. validation - Verifying elements, values, states

## Output Requirements
Return a JSON object with processes[] array containing process metadata, flow structure, and steps.`;

const DEFAULT_VIDEO_ANALYSIS_USER_PROMPT = `Analyze this screen recording video and generate a complete Process Design Document (PDD) with FLOWCHART structure in JSON format.

Watch the entire video carefully and document:
1. **All User Actions** - clicks, typing, selections, scrolling, drag-drop
2. **All System Responses** - page loads, popups, notifications, errors
3. **Decision Points** - any branching logic, conditions, choices
4. **Waiting Periods** - loading, processing, delays
5. **Subprocesses** - distinct reusable sequences (login, payment, etc.)

For the FLOWCHART:
- Create START and END nodes
- Create ACTION nodes for each step
- Create DECISION nodes for any branching (if/else, success/failure)
- Connect all nodes with properly labeled EDGES
- Use "TAK"/"NIE" or "Yes"/"No" labels for decision edges

Return ONLY valid JSON matching the schema. Do not include markdown formatting or code blocks.`;

/**
 * Create the default video analysis workflow if it doesn't exist
 */
export const ensureDefaultWorkflows = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if default video analysis workflow exists
    const existing = await ctx.db
      .query("workflows")
      .withIndex("by_category", (q) => q.eq("category", "video_analysis"))
      .first();

    if (existing) {
      return { created: false, workflowId: existing._id };
    }

    // Create default video analysis workflow with Gemini 3 Flash
    const workflowId = await ctx.db.insert("workflows", {
      name: "Video Analysis (Gemini 3 Flash)",
      description: "Extract PDD documentation from screen recordings using Gemini 3 Flash with medium thinking effort",
      category: "video_analysis",
      isDefault: true,
      steps: [
        {
          stepId: "analyze_video",
          name: "Analyze Video & Extract PDD",
          description: "Process screen recording and generate structured PDD with flowchart",
          model: "gemini-3-flash-preview",
          input: {
            type: "video" as const,
            includeVideo: true,
          },
          systemPrompt: DEFAULT_VIDEO_ANALYSIS_SYSTEM_PROMPT,
          userPrompt: DEFAULT_VIDEO_ANALYSIS_USER_PROMPT,
          output: {
            type: "structured" as const,
            variableName: "pddResult",
          },
          options: {
            maxOutputTokens: 65536,
            enableThinking: true,
            thinkingEffort: "medium" as const,
          },
        },
      ],
      createdAt: Date.now(),
      version: 1,
    });

    return { created: true, workflowId };
  },
});
