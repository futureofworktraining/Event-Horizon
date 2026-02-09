/**
 * Unified Prompts Management
 *
 * Consolidated prompt management for all prompt types:
 * - system: Analysis system prompts
 * - user: Analysis user prompts
 * - schema: Analysis JSON schemas
 * - ui_element: UI element detection prompts
 * - sensitive_info: Sensitive info detection prompts
 */

import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Prompt type validator
const promptTypeValidator = v.union(
  v.literal("system"),
  v.literal("user"),
  v.literal("schema"),
  v.literal("ui_element"),
  v.literal("sensitive_info")
);

// ============================================
// QUERIES
// ============================================

/**
 * List all active prompts of a given type
 */
export const listPrompts = query({
  args: { type: promptTypeValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get a single prompt by ID
 */
export const getPrompt = query({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get the default prompt for a given type
 */
export const getDefaultPrompt = query({
  args: { type: promptTypeValidator },
  handler: async (ctx, args) => {
    // First try to find one marked as default
    const defaultPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", args.type).eq("isDefault", true)
      )
      .first();

    if (defaultPrompt) return defaultPrompt;

    // Fallback to first active prompt of this type
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();
  },
});

/**
 * Get prompt by ID (internal for actions)
 */
export const getPromptInternal = internalQuery({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get default prompt by type (internal for actions)
 */
export const getDefaultPromptInternal = internalQuery({
  args: { type: promptTypeValidator },
  handler: async (ctx, args) => {
    // First try to find one marked as default
    const defaultPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", args.type).eq("isDefault", true)
      )
      .first();

    if (defaultPrompt) return defaultPrompt;

    // Fallback to first active prompt of this type
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", args.type).eq("isActive", true)
      )
      .first();
  },
});

// ============================================
// CONVENIENCE QUERIES - Typed list functions
// ============================================

export const listSystemPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", "system").eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const listUserPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", "user").eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const listSchemaPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", "schema").eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const listUiElementPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", "ui_element").eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

export const listSensitiveInfoPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_type_active", (q) =>
        q.eq("type", "sensitive_info").eq("isActive", true)
      )
      .order("desc")
      .collect();
  },
});

// ============================================
// QUERIES - Analysis defaults (for backward compatibility)
// ============================================

/**
 * Get all default analysis prompts at once (system, user, schema)
 */
export const getDefaultAnalysisPrompts = query({
  args: {},
  handler: async (ctx) => {
    const systemPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "system").eq("isDefault", true)
      )
      .first();

    const userPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "user").eq("isDefault", true)
      )
      .first();

    const schemaPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "schema").eq("isDefault", true)
      )
      .first();

    return {
      systemPrompt,
      userPrompt,
      jsonSchema: schemaPrompt,
    };
  },
});

/**
 * Get all default analysis prompts (internal for actions)
 */
export const getDefaultAnalysisPromptsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get system prompt (default or first active)
    let systemPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "system").eq("isDefault", true)
      )
      .first();

    if (!systemPrompt) {
      systemPrompt = await ctx.db
        .query("prompts")
        .withIndex("by_type_active", (q) =>
          q.eq("type", "system").eq("isActive", true)
        )
        .first();
    }

    // Get user prompt (default or first active)
    let userPrompt = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "user").eq("isDefault", true)
      )
      .first();

    if (!userPrompt) {
      userPrompt = await ctx.db
        .query("prompts")
        .withIndex("by_type_active", (q) =>
          q.eq("type", "user").eq("isActive", true)
        )
        .first();
    }

    // Get schema (default or first active)
    let jsonSchema = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", "schema").eq("isDefault", true)
      )
      .first();

    if (!jsonSchema) {
      jsonSchema = await ctx.db
        .query("prompts")
        .withIndex("by_type_active", (q) =>
          q.eq("type", "schema").eq("isActive", true)
        )
        .first();
    }

    return {
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new prompt
 */
export const createPrompt = mutation({
  args: {
    type: promptTypeValidator,
    version: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal("builtin"), v.literal("custom")),
  },
  handler: async (ctx, args) => {
    const versionNumber = parseInt(args.version.replace(/\D/g, "") || "1");

    return await ctx.db.insert("prompts", {
      type: args.type,
      version: args.version,
      versionNumber,
      name: args.name,
      description: args.description,
      content: args.content,
      source: args.source,
      isActive: true,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update an existing prompt
 */
export const updatePrompt = mutation({
  args: {
    id: v.id("prompts"),
    name: v.optional(v.string()),
    version: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    // Handle versionNumber if version is updated
    if (updates.version) {
      filteredUpdates.versionNumber = parseInt(
        updates.version.replace(/\D/g, "") || "1"
      );
    }

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set a prompt as the default for its type
 */
export const setDefaultPrompt = mutation({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Unset existing defaults for this type
    const existingDefaults = await ctx.db
      .query("prompts")
      .withIndex("by_type_default", (q) =>
        q.eq("type", prompt.type).eq("isDefault", true)
      )
      .collect();

    for (const existing of existingDefaults) {
      await ctx.db.patch(existing._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: Date.now(),
    });

    // Also update the settings table for backward compatibility
    const settingKey = `default_${prompt.type}_prompt_id`;
    const existingSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", settingKey))
      .first();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value: args.id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: settingKey,
        value: args.id,
        isSecret: false,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Deactivate a prompt (soft delete)
 */
export const deactivatePrompt = mutation({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    if (prompt.isDefault) {
      throw new Error(
        "Cannot deactivate the default prompt. Set another as default first."
      );
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to create prompts (used by seed)
 */
export const createPromptInternal = internalMutation({
  args: {
    type: promptTypeValidator,
    version: v.string(),
    versionNumber: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal("builtin"), v.literal("custom")),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prompts", {
      type: args.type,
      version: args.version,
      versionNumber: args.versionNumber,
      name: args.name,
      description: args.description,
      content: args.content,
      source: args.source,
      isActive: true,
      isDefault: args.isDefault ?? false,
      createdAt: Date.now(),
    });
  },
});
