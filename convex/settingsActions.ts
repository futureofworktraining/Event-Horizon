"use node";

/**
 * Settings Actions (Node.js runtime)
 *
 * Handles Gemini API key retrieval and storage.
 * Primary source: GEMINI_API_KEY environment variable.
 * Fallback: value stored in the database via the Settings UI.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// Public Actions
// ============================================

/**
 * Update Gemini API key (stored in database as fallback).
 * The environment variable GEMINI_API_KEY takes priority over this.
 */
export const updateGeminiApiKey = action({
  args: { apiKey: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Validate API key format (basic check)
    if (!args.apiKey.startsWith("AIza") || args.apiKey.length < 30) {
      return {
        success: false,
        error: "Invalid API key format. Gemini API keys start with 'AIza'",
      };
    }

    try {
      // Store plaintext value in database
      await ctx.runMutation(internal.settings.storeEncryptedApiKey, {
        encryptedValue: args.apiKey,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store API key: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// ============================================
// Internal Actions
// ============================================

/**
 * Internal action to get the Gemini API key.
 * Priority: 1) GEMINI_API_KEY env var  2) database value
 */
export const getGeminiApiKeyInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    // 1. Try environment variable first (preferred)
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      return envKey;
    }

    // 2. Fall back to database value
    const dbValue = await ctx.runQuery(internal.settings.getEncryptedApiKey);
    return dbValue || null;
  },
});
