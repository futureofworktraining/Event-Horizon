import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================
// QUERIES - System Prompts
// ============================================

export const listSystemPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("systemPrompts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();
  },
});

export const getSystemPrompt = query({
  args: { id: v.id("systemPrompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// QUERIES - User Prompts
// ============================================

export const listUserPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("userPrompts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();
  },
});

export const getUserPrompt = query({
  args: { id: v.id("userPrompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// QUERIES - JSON Schemas
// ============================================

export const listJsonSchemas = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jsonSchemas")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();
  },
});

export const getJsonSchema = query({
  args: { id: v.id("jsonSchemas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// QUERIES - Prompt Configurations
// ============================================

export const listPromptConfigurations = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db
      .query("promptConfigurations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();

    // Resolve referenced prompts for each config
    const resolvedConfigs = await Promise.all(
      configs.map(async (config) => {
        const systemPrompt = await ctx.db.get(config.systemPromptId);
        const userPrompt = await ctx.db.get(config.userPromptId);
        const jsonSchema = await ctx.db.get(config.jsonSchemaId);

        return {
          ...config,
          systemPrompt,
          userPrompt,
          jsonSchema,
        };
      })
    );

    return resolvedConfigs;
  },
});

export const getPromptConfiguration = query({
  args: { id: v.id("promptConfigurations") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.id);
    if (!config) return null;

    const systemPrompt = await ctx.db.get(config.systemPromptId);
    const userPrompt = await ctx.db.get(config.userPromptId);
    const jsonSchema = await ctx.db.get(config.jsonSchemaId);

    return {
      ...config,
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});

export const getDefaultPromptConfiguration = query({
  args: {},
  handler: async (ctx) => {
    // First, check if there's a default set in settings
    const defaultSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "default_prompt_configuration_id"))
      .first();

    let config;
    if (defaultSetting?.value) {
      config = await ctx.db.get(defaultSetting.value as Id<"promptConfigurations">);
    }

    // If no default in settings, find config marked as isDefault
    if (!config) {
      config = await ctx.db
        .query("promptConfigurations")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .first();
    }

    // If still no config, get any active config
    if (!config) {
      config = await ctx.db
        .query("promptConfigurations")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first();
    }

    if (!config) return null;

    const systemPrompt = await ctx.db.get(config.systemPromptId);
    const userPrompt = await ctx.db.get(config.userPromptId);
    const jsonSchema = await ctx.db.get(config.jsonSchemaId);

    return {
      ...config,
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});

// Internal query for use in actions (like analyze.ts)
export const getPromptConfigurationInternal = internalQuery({
  args: { id: v.id("promptConfigurations") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.id);
    if (!config) return null;

    const systemPrompt = await ctx.db.get(config.systemPromptId);
    const userPrompt = await ctx.db.get(config.userPromptId);
    const jsonSchema = await ctx.db.get(config.jsonSchemaId);

    return {
      ...config,
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});

export const getDefaultPromptConfigurationInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Fetch default system prompt (or first active if none marked default)
    let systemPrompt = await ctx.db
      .query("systemPrompts")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    if (!systemPrompt) {
      systemPrompt = await ctx.db
        .query("systemPrompts")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first();
    }

    // Fetch default user prompt (or first active if none marked default)
    let userPrompt = await ctx.db
      .query("userPrompts")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    if (!userPrompt) {
      userPrompt = await ctx.db
        .query("userPrompts")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first();
    }

    // Fetch default JSON schema (or first active if none marked default)
    let jsonSchema = await ctx.db
      .query("jsonSchemas")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    if (!jsonSchema) {
      jsonSchema = await ctx.db
        .query("jsonSchemas")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .first();
    }

    if (!systemPrompt || !userPrompt || !jsonSchema) {
      throw new Error("No default prompts found. Please run seedBuiltinPrompts first.");
    }

    return {
      name: "Default Configuration",
      systemPrompt,
      userPrompt,
      jsonSchema,
    };
  },
});

// Internal queries for getting individual prompts by ID
export const getSystemPromptInternal = internalQuery({
  args: { id: v.id("systemPrompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUserPromptInternal = internalQuery({
  args: { id: v.id("userPrompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getJsonSchemaInternal = internalQuery({
  args: { id: v.id("jsonSchemas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================
// MUTATIONS - System Prompts
// ============================================

export const createSystemPrompt = mutation({
  args: {
    version: v.string(),
    versionNumber: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal("builtin"), v.literal("custom")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("systemPrompts", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateSystemPrompt = mutation({
  args: {
    id: v.id("systemPrompts"),
    version: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const deactivateSystemPrompt = mutation({
  args: { id: v.id("systemPrompts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

export const setDefaultSystemPrompt = mutation({
  args: { id: v.id("systemPrompts") },
  handler: async (ctx, args) => {
    // Unset all other defaults
    const existingDefaults = await ctx.db
      .query("systemPrompts")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    for (const prompt of existingDefaults) {
      await ctx.db.patch(prompt._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// MUTATIONS - User Prompts
// ============================================

export const createUserPrompt = mutation({
  args: {
    version: v.string(),
    versionNumber: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal("builtin"), v.literal("custom")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("userPrompts", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateUserPrompt = mutation({
  args: {
    id: v.id("userPrompts"),
    version: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const deactivateUserPrompt = mutation({
  args: { id: v.id("userPrompts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

export const setDefaultUserPrompt = mutation({
  args: { id: v.id("userPrompts") },
  handler: async (ctx, args) => {
    // Unset all other defaults
    const existingDefaults = await ctx.db
      .query("userPrompts")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    for (const prompt of existingDefaults) {
      await ctx.db.patch(prompt._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// MUTATIONS - JSON Schemas
// ============================================

export const createJsonSchema = mutation({
  args: {
    version: v.string(),
    versionNumber: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
    source: v.union(v.literal("builtin"), v.literal("custom")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jsonSchemas", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateJsonSchema = mutation({
  args: {
    id: v.id("jsonSchemas"),
    version: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const deactivateJsonSchema = mutation({
  args: { id: v.id("jsonSchemas") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

export const setDefaultJsonSchema = mutation({
  args: { id: v.id("jsonSchemas") },
  handler: async (ctx, args) => {
    // Unset all other defaults
    const existingDefaults = await ctx.db
      .query("jsonSchemas")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    for (const schema of existingDefaults) {
      await ctx.db.patch(schema._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// MUTATIONS - Prompt Configurations
// ============================================

export const createPromptConfiguration = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    systemPromptId: v.id("systemPrompts"),
    userPromptId: v.id("userPrompts"),
    jsonSchemaId: v.id("jsonSchemas"),
    isDefault: v.optional(v.boolean()),
    source: v.union(v.literal("builtin"), v.literal("custom")),
  },
  handler: async (ctx, args) => {
    // If this is being set as default, unset other defaults
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("promptConfigurations")
        .withIndex("by_default", (q) => q.eq("isDefault", true))
        .collect();

      for (const config of existingDefaults) {
        await ctx.db.patch(config._id, { isDefault: false });
      }
    }

    return await ctx.db.insert("promptConfigurations", {
      ...args,
      isDefault: args.isDefault ?? false,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updatePromptConfiguration = mutation({
  args: {
    id: v.id("promptConfigurations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPromptId: v.optional(v.id("systemPrompts")),
    userPromptId: v.optional(v.id("userPrompts")),
    jsonSchemaId: v.optional(v.id("jsonSchemas")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const setDefaultPromptConfiguration = mutation({
  args: { id: v.id("promptConfigurations") },
  handler: async (ctx, args) => {
    // Unset all other defaults
    const existingDefaults = await ctx.db
      .query("promptConfigurations")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();

    for (const config of existingDefaults) {
      await ctx.db.patch(config._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.id, {
      isDefault: true,
      updatedAt: Date.now(),
    });

    // Also update the settings table
    const existingSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "default_prompt_configuration_id"))
      .first();

    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value: args.id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: "default_prompt_configuration_id",
        value: args.id,
        isSecret: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const deactivatePromptConfiguration = mutation({
  args: { id: v.id("promptConfigurations") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.id);
    if (config?.isDefault) {
      throw new Error("Cannot deactivate the default prompt configuration. Set another as default first.");
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});
