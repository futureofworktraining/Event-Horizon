/**
 * Seed Prompts - Migration script to populate the database with builtin prompts
 *
 * This script reads from the file-based prompt backups and inserts them into the database.
 * Run this once after deploying the schema changes.
 *
 * Usage: Call seedBuiltinPrompts mutation from the Convex dashboard
 */

import { mutation } from "./_generated/server";

// Import prompt content from file backups (V2 Flowchart - Default)
import { SYSTEM_PROMPT } from "./prompts/systemPrompt";
import { USER_PROMPT } from "./prompts/userPrompt";
import { JSON_SCHEMA } from "./prompts/jsonSchema";

export const seedBuiltinPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingSystemPrompts = await ctx.db
      .query("systemPrompts")
      .collect();

    if (existingSystemPrompts.length > 0) {
      console.log("Prompts already seeded. Skipping.");
      return {
        success: false,
        message: "Prompts already seeded. Use clearAndReseed to force re-seeding.",
        existingCount: existingSystemPrompts.length,
      };
    }

    const now = Date.now();

    // ============================================
    // SEED FLOWCHART PROMPTS (V2 - Default)
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
    console.log(`- System Prompt: ${sysId} (DEFAULT)`);
    console.log(`- User Prompt: ${userId} (DEFAULT)`);
    console.log(`- Schema: ${schemaId} (DEFAULT)`);

    return {
      success: true,
      message: "Successfully seeded Flowchart Analysis prompts",
      systemPromptId: sysId,
      userPromptId: userId,
      schemaId: schemaId,
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
    // Delete all existing prompt data
    const configs = await ctx.db.query("promptConfigurations").collect();
    const systemPrompts = await ctx.db.query("systemPrompts").collect();
    const userPrompts = await ctx.db.query("userPrompts").collect();
    const jsonSchemas = await ctx.db.query("jsonSchemas").collect();

    // Delete all prompts (both builtin and custom for clean slate)
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

    // Remove old settings
    const defaultSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "default_prompt_configuration_id"))
      .first();

    if (defaultSetting) {
      await ctx.db.delete(defaultSetting._id);
    }

    console.log("Cleared all prompts. Re-seeding...");

    // Now re-seed
    const now = Date.now();

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

    return {
      success: true,
      message: "Cleared and re-seeded Flowchart Analysis prompts",
      systemPromptId: sysId,
      userPromptId: userId,
      schemaId: schemaId,
    };
  },
});
