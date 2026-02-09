/**
 * Seed Prompts - Migration script to populate the database with builtin prompts
 *
 * This script populates both the legacy tables (for backward compatibility)
 * and the new unified prompts table.
 *
 * Usage: Call seedBuiltinPrompts mutation from the Convex dashboard
 */

import { mutation } from "./_generated/server";

// Import prompt content from file backups (V2 Flowchart - Default)
import { SYSTEM_PROMPT } from "./prompts/systemPrompt";
import { USER_PROMPT } from "./prompts/userPrompt";
import { JSON_SCHEMA } from "./prompts/jsonSchema";

// Default UI Element Detection Prompt
const UI_ELEMENT_PROMPT = `You are a UI element detector. Find the EXACT bounding box of ONE specific UI element in this screenshot.

TARGET ELEMENT TO FIND:
- Element name/label: "{elementName}"
- Element type: {elementType}
- Location description: {locationDescription}
- Screen region: {screenRegion}
- User action context: {description}

IMPORTANT INSTRUCTIONS:
1. Look for a visible label or text that says "{elementName}" or similar
2. The bounding box should cover the INTERACTIVE element itself (input field, button, etc.), NOT the label
3. If there are multiple similar elements (e.g., multiple text fields), use the label text to identify the correct one
4. For input fields: look for the label text ABOVE or BESIDE the input, then select that specific input field
5. The element type "{elementType}" helps identify - for "text_field" look for an input box, for "button" look for a clickable button, etc.

Return a JSON object:
{
  "label": "{elementName}",
  "box_2d": [ymin, xmin, ymax, xmax],
  "found": true
}

Where box_2d coordinates are normalized to 0-1000 scale (0=top/left, 1000=bottom/right).

If the element cannot be found, return:
{"label": "{elementName}", "box_2d": [0, 0, 0, 0], "found": false}

Return ONLY the JSON object, no other text.`;

// Default Sensitive Info Detection Prompt
const SENSITIVE_INFO_PROMPT = `You are a sensitive information detector for RPA documentation.

USER'S SENSITIVE INFO DEFINITION:
{userDefinition}

STEP CONTEXT:
{stepDescription}

TASK: Find ALL instances of sensitive information matching the definition above in this screenshot.
For EACH instance found, return a bounding box with:
- The type of sensitive info detected (e.g., "SSN", "Credit Card Number", "Password", etc.)
- The exact location as [ymin, xmin, ymax, xmax] normalized to 0-1000 scale (0=top/left, 1000=bottom/right)
- A confidence score 0-1 indicating how confident you are this is the sensitive info

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

If no sensitive information found, return:
{"sensitive_boxes": []}

Return ONLY the JSON object, no other text or markdown formatting.`;

export const seedBuiltinPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded (check unified prompts table)
    const existingUnifiedPrompts = await ctx.db
      .query("prompts")
      .collect();

    if (existingUnifiedPrompts.length > 0) {
      console.log("Unified prompts already seeded. Skipping.");
      return {
        success: false,
        message: "Prompts already seeded. Use clearAndReseed to force re-seeding.",
        existingCount: existingUnifiedPrompts.length,
      };
    }

    const now = Date.now();

    // ============================================
    // SEED UNIFIED PROMPTS TABLE
    // ============================================

    // System Prompt (V2 - Default)
    const unifiedSysId = await ctx.db.insert("prompts", {
      type: "system",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis System Prompt",
      description: "Enhanced system prompt with flowchart structure, decision nodes, subprocess support, and comprehensive PDD documentation.",
      content: SYSTEM_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // User Prompt (V2 - Default)
    const unifiedUserId = await ctx.db.insert("prompts", {
      type: "user",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis User Prompt",
      description: "User prompt for flowchart-enabled PDD analysis with decision points and subprocess detection.",
      content: USER_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // JSON Schema (V2 - Default)
    const unifiedSchemaId = await ctx.db.insert("prompts", {
      type: "schema",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis Schema",
      description: "Output schema with processes array, flow structure (nodes/edges), and detailed step information.",
      content: JSON.stringify(JSON_SCHEMA, null, 2),
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // UI Element Detection Prompt (V1 - Default)
    const unifiedUiId = await ctx.db.insert("prompts", {
      type: "ui_element",
      version: "v1",
      versionNumber: 1,
      name: "UI Element Detection Prompt",
      description: "Default prompt for detecting UI elements in screenshots. Uses placeholders for element details.",
      content: UI_ELEMENT_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // Sensitive Info Detection Prompt (V1 - Default)
    const unifiedSensitiveId = await ctx.db.insert("prompts", {
      type: "sensitive_info",
      version: "v1",
      versionNumber: 1,
      name: "Sensitive Info Detection Prompt",
      description: "Default prompt for detecting sensitive information in screenshots. Uses placeholders for user definition.",
      content: SENSITIVE_INFO_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // ============================================
    // ALSO SEED LEGACY TABLES (for backward compatibility)
    // ============================================

    // System Prompt (set as default)
    const sysId = await ctx.db.insert("systemPrompts", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis System Prompt",
      description: "Enhanced system prompt with flowchart structure, decision nodes, subprocess support, and comprehensive PDD documentation.",
      content: SYSTEM_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // User Prompt (set as default)
    const userId = await ctx.db.insert("userPrompts", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis User Prompt",
      description: "User prompt for flowchart-enabled PDD analysis with decision points and subprocess detection.",
      content: USER_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // JSON Schema (set as default)
    const schemaId = await ctx.db.insert("jsonSchemas", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis Schema",
      description: "Output schema with processes array, flow structure (nodes/edges), and detailed step information.",
      content: JSON.stringify(JSON_SCHEMA, null, 2),
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    console.log("Successfully seeded builtin prompts:");
    console.log("Unified table:");
    console.log(`- System Prompt: ${unifiedSysId} (DEFAULT)`);
    console.log(`- User Prompt: ${unifiedUserId} (DEFAULT)`);
    console.log(`- Schema: ${unifiedSchemaId} (DEFAULT)`);
    console.log(`- UI Element: ${unifiedUiId} (DEFAULT)`);
    console.log(`- Sensitive Info: ${unifiedSensitiveId} (DEFAULT)`);
    console.log("Legacy tables:");
    console.log(`- System Prompt: ${sysId} (DEFAULT)`);
    console.log(`- User Prompt: ${userId} (DEFAULT)`);
    console.log(`- Schema: ${schemaId} (DEFAULT)`);

    return {
      success: true,
      message: "Successfully seeded all prompts (unified + legacy)",
      unified: {
        systemPromptId: unifiedSysId,
        userPromptId: unifiedUserId,
        schemaId: unifiedSchemaId,
        uiElementPromptId: unifiedUiId,
        sensitiveInfoPromptId: unifiedSensitiveId,
      },
      legacy: {
        systemPromptId: sysId,
        userPromptId: userId,
        schemaId: schemaId,
      },
    };
  },
});

/**
 * Clear all seeded prompts and re-seed
 * Use this if you need to update the builtin prompts
 */
export const clearAndReseed = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing prompt data from unified table
    const unifiedPrompts = await ctx.db.query("prompts").collect();
    for (const prompt of unifiedPrompts) {
      await ctx.db.delete(prompt._id);
    }

    // Delete from legacy tables
    const configs = await ctx.db.query("promptConfigurations").collect();
    const systemPrompts = await ctx.db.query("systemPrompts").collect();
    const userPrompts = await ctx.db.query("userPrompts").collect();
    const jsonSchemas = await ctx.db.query("jsonSchemas").collect();

    for (const config of configs) {
      await ctx.db.delete(config._id);
    }
    for (const prompt of systemPrompts) {
      await ctx.db.delete(prompt._id);
    }
    for (const prompt of userPrompts) {
      await ctx.db.delete(prompt._id);
    }
    for (const schema of jsonSchemas) {
      await ctx.db.delete(schema._id);
    }

    // Remove related settings
    const settingsToRemove = [
      "default_prompt_configuration_id",
      "default_system_prompt_id",
      "default_user_prompt_id",
      "default_schema_prompt_id",
      "default_ui_element_prompt_id",
      "default_sensitive_info_prompt_id",
    ];

    for (const key of settingsToRemove) {
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (setting) {
        await ctx.db.delete(setting._id);
      }
    }

    console.log("Cleared all prompts. Re-seeding...");

    const now = Date.now();

    // ============================================
    // SEED UNIFIED PROMPTS TABLE
    // ============================================

    const unifiedSysId = await ctx.db.insert("prompts", {
      type: "system",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis System Prompt",
      description: "Enhanced system prompt with flowchart structure, decision nodes, subprocess support, and comprehensive PDD documentation.",
      content: SYSTEM_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedUserId = await ctx.db.insert("prompts", {
      type: "user",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis User Prompt",
      description: "User prompt for flowchart-enabled PDD analysis with decision points and subprocess detection.",
      content: USER_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedSchemaId = await ctx.db.insert("prompts", {
      type: "schema",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis Schema",
      description: "Output schema with processes array, flow structure (nodes/edges), and detailed step information.",
      content: JSON.stringify(JSON_SCHEMA, null, 2),
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedUiId = await ctx.db.insert("prompts", {
      type: "ui_element",
      version: "v1",
      versionNumber: 1,
      name: "UI Element Detection Prompt",
      description: "Default prompt for detecting UI elements in screenshots. Uses placeholders for element details.",
      content: UI_ELEMENT_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedSensitiveId = await ctx.db.insert("prompts", {
      type: "sensitive_info",
      version: "v1",
      versionNumber: 1,
      name: "Sensitive Info Detection Prompt",
      description: "Default prompt for detecting sensitive information in screenshots. Uses placeholders for user definition.",
      content: SENSITIVE_INFO_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    // ============================================
    // ALSO SEED LEGACY TABLES
    // ============================================

    const sysId = await ctx.db.insert("systemPrompts", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis System Prompt",
      description: "Enhanced system prompt with flowchart structure, decision nodes, subprocess support, and comprehensive PDD documentation.",
      content: SYSTEM_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const userId = await ctx.db.insert("userPrompts", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis User Prompt",
      description: "User prompt for flowchart-enabled PDD analysis with decision points and subprocess detection.",
      content: USER_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const schemaId = await ctx.db.insert("jsonSchemas", {
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis Schema",
      description: "Output schema with processes array, flow structure (nodes/edges), and detailed step information.",
      content: JSON.stringify(JSON_SCHEMA, null, 2),
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    return {
      success: true,
      message: "Cleared and re-seeded all prompts",
      unified: {
        systemPromptId: unifiedSysId,
        userPromptId: unifiedUserId,
        schemaId: unifiedSchemaId,
        uiElementPromptId: unifiedUiId,
        sensitiveInfoPromptId: unifiedSensitiveId,
      },
      legacy: {
        systemPromptId: sysId,
        userPromptId: userId,
        schemaId: schemaId,
      },
    };
  },
});

/**
 * Seed only unified prompts (if not already seeded)
 * Used for incremental migration
 */
export const seedUnifiedPromptsOnly = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingPrompts = await ctx.db.query("prompts").collect();
    if (existingPrompts.length > 0) {
      return {
        success: false,
        message: "Unified prompts already seeded",
        existingCount: existingPrompts.length,
      };
    }

    const now = Date.now();

    const unifiedSysId = await ctx.db.insert("prompts", {
      type: "system",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis System Prompt",
      description: "Enhanced system prompt with flowchart structure, decision nodes, subprocess support, and comprehensive PDD documentation.",
      content: SYSTEM_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedUserId = await ctx.db.insert("prompts", {
      type: "user",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis User Prompt",
      description: "User prompt for flowchart-enabled PDD analysis with decision points and subprocess detection.",
      content: USER_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedSchemaId = await ctx.db.insert("prompts", {
      type: "schema",
      version: "v2",
      versionNumber: 2,
      name: "Flowchart Analysis Schema",
      description: "Output schema with processes array, flow structure (nodes/edges), and detailed step information.",
      content: JSON.stringify(JSON_SCHEMA, null, 2),
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedUiId = await ctx.db.insert("prompts", {
      type: "ui_element",
      version: "v1",
      versionNumber: 1,
      name: "UI Element Detection Prompt",
      description: "Default prompt for detecting UI elements in screenshots. Uses placeholders for element details.",
      content: UI_ELEMENT_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    const unifiedSensitiveId = await ctx.db.insert("prompts", {
      type: "sensitive_info",
      version: "v1",
      versionNumber: 1,
      name: "Sensitive Info Detection Prompt",
      description: "Default prompt for detecting sensitive information in screenshots. Uses placeholders for user definition.",
      content: SENSITIVE_INFO_PROMPT,
      isActive: true,
      isDefault: true,
      source: "builtin",
      createdAt: now,
    });

    return {
      success: true,
      message: "Seeded unified prompts only",
      systemPromptId: unifiedSysId,
      userPromptId: unifiedUserId,
      schemaId: unifiedSchemaId,
      uiElementPromptId: unifiedUiId,
      sensitiveInfoPromptId: unifiedSensitiveId,
    };
  },
});
