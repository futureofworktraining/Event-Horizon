import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

// ============================================
// Public Queries
// ============================================

/**
 * Get a setting by key
 * Masks secret values for client-side display
 */
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!setting) {
      return null;
    }

    // Mask the value if it's a secret
    if (setting.isSecret) {
      return {
        ...setting,
        value: setting.value ? "••••••••••••" : "",
        hasValue: !!setting.value,
      };
    }

    return setting;
  },
});

/**
 * Get API key status (without exposing the value)
 */
export const getApiKeyStatus = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
      .first();

    // Create masked value showing first 4 chars + masked rest
    let maskedValue = "";
    if (setting?.value && setting.value.length > 4) {
      maskedValue = setting.value.substring(0, 4) + "••••••••••••";
    } else if (setting?.value) {
      maskedValue = "••••••••••••";
    }

    return {
      isConfigured: !!setting?.value,
      lastUpdated: setting?.updatedAt || null,
      maskedValue,
    };
  },
});

// ============================================
// Public Mutations
// ============================================

/**
 * Set a setting value (non-secret settings only)
 * For secret settings like API keys, use the action in settingsActions.ts
 */
export const setSetting = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    isSecret: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Prevent using this for secret settings - use dedicated actions instead
    if (args.isSecret || args.key === "gemini_api_key") {
      return {
        success: false,
        error: "Use updateGeminiApiKey action for secret settings"
      };
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        isSecret: false,
        updatedAt: Date.now(),
      });
      return { success: true, action: "updated" };
    } else {
      await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        isSecret: false,
        updatedAt: Date.now(),
      });
      return { success: true, action: "created" };
    }
  },
});

/**
 * Delete a setting
 */
export const deleteSetting = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (setting) {
      await ctx.db.delete(setting._id);
      return { success: true };
    }

    return { success: false, error: "Setting not found" };
  },
});

// ============================================
// Internal Mutations (for use by actions)
// ============================================

/**
 * Store encrypted API key value
 * Called by updateGeminiApiKey action after encryption
 */
export const storeEncryptedApiKey = internalMutation({
  args: { encryptedValue: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.encryptedValue,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: "gemini_api_key",
        value: args.encryptedValue,
        isSecret: true,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// Internal Queries (for use by actions)
// ============================================

/**
 * Get encrypted API key value from DB
 * Called by getGeminiApiKeyInternal action for decryption
 */
export const getEncryptedApiKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
      .first();

    return setting?.value || null;
  },
});

/**
 * Get any setting by key (internal, returns raw value)
 */
export const getSettingInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * Get analysis prompts (for use in actions)
 * @deprecated Use analysisPrompts.getDefaultPromptConfigurationInternal instead
 */
export const getAnalysisPromptsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const systemPrompt = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "analysis_system_prompt"))
      .first();

    const userPrompt = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "analysis_user_prompt"))
      .first();

    const schema = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "analysis_schema"))
      .first();

    const model = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "analysis_model"))
      .first();

    return {
      systemPrompt: systemPrompt?.value || null,
      userPrompt: userPrompt?.value || null,
      schema: schema?.value || null,
      model: model?.value || null,
    };
  },
});
