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

// ============================================
// UNIFIED PROMPTS MIGRATION
// ============================================

/**
 * Migrate legacy prompts to unified prompts table
 * This copies data from systemPrompts, userPrompts, jsonSchemas to the new prompts table
 */
export const migrateToUnifiedPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      migratedSystemPrompts: 0,
      migratedUserPrompts: 0,
      migratedSchemas: 0,
      updatedProcesses: 0,
      errors: [] as string[],
    };

    // Check if already migrated by looking for existing unified prompts
    const existingUnified = await ctx.db.query("prompts").first();
    if (existingUnified) {
      return {
        ...results,
        alreadyMigrated: true,
        message: "Unified prompts table already has data. Use verifyMigration to check status.",
      };
    }

    // Create ID mappings from old to new
    const systemPromptMapping: Map<string, any> = new Map();
    const userPromptMapping: Map<string, any> = new Map();
    const schemaMapping: Map<string, any> = new Map();

    // 1. Migrate system prompts
    const systemPrompts = await ctx.db.query("systemPrompts").collect();
    for (const sp of systemPrompts) {
      try {
        const newId = await ctx.db.insert("prompts", {
          type: "system",
          version: sp.version,
          versionNumber: parseInt(sp.version.replace("v", "")) || 1,
          name: sp.name,
          description: sp.description,
          content: sp.content,
          isDefault: sp.isDefault ?? false,
          isActive: sp.isActive ?? true,
          source: sp.source ?? "builtin",
          createdAt: sp.createdAt ?? Date.now(),
          updatedAt: sp.updatedAt,
        });
        systemPromptMapping.set(sp._id.toString(), newId);
        results.migratedSystemPrompts++;
      } catch (error) {
        results.errors.push(`System prompt ${sp.name}: ${error}`);
      }
    }

    // 2. Migrate user prompts
    const userPrompts = await ctx.db.query("userPrompts").collect();
    for (const up of userPrompts) {
      try {
        const newId = await ctx.db.insert("prompts", {
          type: "user",
          version: up.version,
          versionNumber: parseInt(up.version.replace("v", "")) || 1,
          name: up.name,
          description: up.description,
          content: up.content,
          isDefault: up.isDefault ?? false,
          isActive: up.isActive ?? true,
          source: up.source ?? "builtin",
          createdAt: up.createdAt ?? Date.now(),
          updatedAt: up.updatedAt,
        });
        userPromptMapping.set(up._id.toString(), newId);
        results.migratedUserPrompts++;
      } catch (error) {
        results.errors.push(`User prompt ${up.name}: ${error}`);
      }
    }

    // 3. Migrate JSON schemas
    const jsonSchemas = await ctx.db.query("jsonSchemas").collect();
    for (const js of jsonSchemas) {
      try {
        const newId = await ctx.db.insert("prompts", {
          type: "schema",
          version: js.version,
          versionNumber: parseInt(js.version.replace("v", "")) || 1,
          name: js.name,
          description: js.description,
          content: js.content,
          isDefault: js.isDefault ?? false,
          isActive: js.isActive ?? true,
          source: js.source ?? "builtin",
          createdAt: js.createdAt ?? Date.now(),
          updatedAt: js.updatedAt,
        });
        schemaMapping.set(js._id.toString(), newId);
        results.migratedSchemas++;
      } catch (error) {
        results.errors.push(`JSON schema ${js.name}: ${error}`);
      }
    }

    // 4. Update processes with unified prompt IDs
    const processes = await ctx.db.query("processes").collect();
    for (const process of processes) {
      const updates: any = {};

      if (process.systemPromptId) {
        const newId = systemPromptMapping.get(process.systemPromptId.toString());
        if (newId) {
          updates.unifiedSystemPromptId = newId;
        }
      }

      if (process.userPromptId) {
        const newId = userPromptMapping.get(process.userPromptId.toString());
        if (newId) {
          updates.unifiedUserPromptId = newId;
        }
      }

      if (process.jsonSchemaId) {
        const newId = schemaMapping.get(process.jsonSchemaId.toString());
        if (newId) {
          updates.unifiedSchemaId = newId;
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(process._id, updates);
        results.updatedProcesses++;
      }
    }

    // 5. Seed default detection prompts if not already present
    const existingUiElement = await ctx.db
      .query("prompts")
      .withIndex("by_type", (q) => q.eq("type", "ui_element"))
      .first();

    if (!existingUiElement) {
      await ctx.db.insert("prompts", {
        type: "ui_element",
        version: "v1",
        versionNumber: 1,
        name: "UI Element Detection V1",
        description: "Default prompt for detecting UI elements in screenshots",
        content: `You are a UI element detector specialized in locating specific UI elements in screenshots for RPA automation.

TARGET ELEMENT TO FIND:
- Element name: {elementName}
- Element type: {elementType}
- Location hint: {locationDescription}
- Screen region: {screenRegion}
- Description: {description}

TASK: Find the EXACT element described above in this screenshot.
Return coordinates as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale.

Return a JSON object:
{
  "box_2d": [ymin, xmin, ymax, xmax],
  "found": true,
  "confidence": 0.95
}

If element is NOT found, return: {"box_2d": [0, 0, 0, 0], "found": false, "confidence": 0}

Return ONLY the JSON object, no other text.`,
        isDefault: true,
        isActive: true,
        source: "builtin",
        createdAt: Date.now(),
      });
    }

    const existingSensitiveInfo = await ctx.db
      .query("prompts")
      .withIndex("by_type", (q) => q.eq("type", "sensitive_info"))
      .first();

    if (!existingSensitiveInfo) {
      await ctx.db.insert("prompts", {
        type: "sensitive_info",
        version: "v1",
        versionNumber: 1,
        name: "Sensitive Info Detection V1",
        description: "Default prompt for detecting sensitive information in screenshots",
        content: `You are a sensitive information detector for RPA documentation.

USER'S SENSITIVE INFO DEFINITION:
{userDefinition}

STEP CONTEXT:
{stepDescription}

TASK: Find ALL instances of sensitive information matching the definition above in this screenshot.
For EACH instance found, return a bounding box with:
- The type of sensitive info detected (e.g., "SSN", "Credit Card Number", "Password", etc.)
- The exact location as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale
- A confidence score 0-1

Return a JSON object:
{
  "sensitive_boxes": [
    {
      "label": "SSN",
      "box_2d": [100, 200, 150, 400],
      "found": true,
      "confidence": 0.95
    }
  ]
}

If no sensitive information found, return: {"sensitive_boxes": []}

Return ONLY the JSON object, no other text.`,
        isDefault: true,
        isActive: true,
        source: "builtin",
        createdAt: Date.now(),
      });
    }

    return {
      ...results,
      success: true,
      message: `Migrated ${results.migratedSystemPrompts} system prompts, ${results.migratedUserPrompts} user prompts, ${results.migratedSchemas} schemas. Updated ${results.updatedProcesses} processes.`,
    };
  },
});

/**
 * Verify the migration status
 * Checks that all legacy prompts have been migrated and processes updated
 */
export const verifyMigration = mutation({
  args: {},
  handler: async (ctx) => {
    const status = {
      legacySystemPrompts: 0,
      legacyUserPrompts: 0,
      legacySchemas: 0,
      unifiedSystemPrompts: 0,
      unifiedUserPrompts: 0,
      unifiedSchemas: 0,
      unifiedUiElement: 0,
      unifiedSensitiveInfo: 0,
      processesWithLegacyOnly: 0,
      processesWithUnified: 0,
      processesWithBoth: 0,
      processesWithNeither: 0,
    };

    // Count legacy prompts
    status.legacySystemPrompts = (await ctx.db.query("systemPrompts").collect()).length;
    status.legacyUserPrompts = (await ctx.db.query("userPrompts").collect()).length;
    status.legacySchemas = (await ctx.db.query("jsonSchemas").collect()).length;

    // Count unified prompts by type
    const allPrompts = await ctx.db.query("prompts").collect();
    for (const p of allPrompts) {
      switch (p.type) {
        case "system": status.unifiedSystemPrompts++; break;
        case "user": status.unifiedUserPrompts++; break;
        case "schema": status.unifiedSchemas++; break;
        case "ui_element": status.unifiedUiElement++; break;
        case "sensitive_info": status.unifiedSensitiveInfo++; break;
      }
    }

    // Check process prompt assignments
    const processes = await ctx.db.query("processes").collect();
    for (const p of processes) {
      const hasLegacy = p.systemPromptId || p.userPromptId || p.jsonSchemaId;
      const hasUnified = p.unifiedSystemPromptId || p.unifiedUserPromptId || p.unifiedSchemaId;

      if (hasLegacy && hasUnified) status.processesWithBoth++;
      else if (hasLegacy) status.processesWithLegacyOnly++;
      else if (hasUnified) status.processesWithUnified++;
      else status.processesWithNeither++;
    }

    const migrationComplete =
      status.unifiedSystemPrompts >= status.legacySystemPrompts &&
      status.unifiedUserPrompts >= status.legacyUserPrompts &&
      status.unifiedSchemas >= status.legacySchemas &&
      status.unifiedUiElement > 0 &&
      status.unifiedSensitiveInfo > 0;

    return {
      ...status,
      migrationComplete,
      recommendation: migrationComplete
        ? "Migration complete. You can safely run cleanupLegacyTables if desired."
        : "Migration incomplete. Run migrateToUnifiedPrompts first.",
    };
  },
});

/**
 * Clean up legacy prompt tables after successful migration
 * WARNING: This permanently deletes data. Run verifyMigration first!
 */
export const cleanupLegacyTables = mutation({
  args: {},
  handler: async (ctx) => {
    // First verify migration is complete
    const systemPrompts = await ctx.db.query("systemPrompts").collect();
    const userPrompts = await ctx.db.query("userPrompts").collect();
    const jsonSchemas = await ctx.db.query("jsonSchemas").collect();

    const unifiedPrompts = await ctx.db.query("prompts").collect();
    const hasSystemPrompts = unifiedPrompts.some(p => p.type === "system");
    const hasUserPrompts = unifiedPrompts.some(p => p.type === "user");
    const hasSchemas = unifiedPrompts.some(p => p.type === "schema");

    if (!hasSystemPrompts || !hasUserPrompts || !hasSchemas) {
      return {
        success: false,
        error: "Cannot cleanup: unified prompts table is missing required types. Run migrateToUnifiedPrompts first.",
      };
    }

    // Clear legacy prompt IDs from processes
    const processes = await ctx.db.query("processes").collect();
    let clearedProcesses = 0;
    for (const p of processes) {
      if (p.systemPromptId || p.userPromptId || p.jsonSchemaId) {
        await ctx.db.patch(p._id, {
          systemPromptId: undefined,
          userPromptId: undefined,
          jsonSchemaId: undefined,
        } as any);
        clearedProcesses++;
      }
    }

    // Delete legacy prompts
    let deletedSystemPrompts = 0;
    for (const sp of systemPrompts) {
      await ctx.db.delete(sp._id);
      deletedSystemPrompts++;
    }

    let deletedUserPrompts = 0;
    for (const up of userPrompts) {
      await ctx.db.delete(up._id);
      deletedUserPrompts++;
    }

    let deletedSchemas = 0;
    for (const js of jsonSchemas) {
      await ctx.db.delete(js._id);
      deletedSchemas++;
    }

    return {
      success: true,
      deletedSystemPrompts,
      deletedUserPrompts,
      deletedSchemas,
      clearedProcesses,
      message: "Legacy tables cleaned up. Only unified prompts table remains.",
    };
  },
});
