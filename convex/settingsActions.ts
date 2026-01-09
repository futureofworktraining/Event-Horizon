"use node";

/**
 * Settings Actions (Node.js runtime)
 *
 * Actions that require Node.js APIs (like crypto for encryption).
 * These are separated from queries/mutations which run in the V8 runtime.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// ============================================
// Encryption Configuration
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derives a 256-bit key from the encryption secret using scrypt
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns a base64 encoded string containing: salt + iv + tag + ciphertext
 */
function encrypt(plaintext: string, encryptionSecret: string | undefined): string {
  if (!encryptionSecret) {
    console.warn("ENCRYPTION_SECRET not set, returning plaintext");
    return plaintext;
  }

  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionSecret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine: salt + iv + tag + ciphertext
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a base64 encoded encrypted string
 */
function decrypt(encryptedBase64: string, encryptionSecret: string | undefined): string {
  if (!encryptionSecret) {
    console.warn("ENCRYPTION_SECRET not set, assuming plaintext");
    return encryptedBase64;
  }

  const combined = Buffer.from(encryptedBase64, "base64");

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(encryptionSecret, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ============================================
// Public Actions
// ============================================

/**
 * Update Gemini API key with encryption
 * This is an action because it needs access to Node.js crypto APIs
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

    // Get encryption secret from environment
    const encryptionSecret = process.env.ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      console.warn("ENCRYPTION_SECRET environment variable is not configured. Storing API key as plain text.");
    }

    try {
      // Encrypt the API key
      const encryptedValue = encrypt(args.apiKey, encryptionSecret);

      // Store encrypted value in database
      await ctx.runMutation(internal.settings.storeEncryptedApiKey, {
        encryptedValue,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to encrypt API key: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// ============================================
// Internal Actions
// ============================================

/**
 * Internal action to get decrypted API key
 * For use in other actions that need the Gemini API key
 */
export const getGeminiApiKeyInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    // Get encrypted value from database
    const encryptedValue = await ctx.runQuery(internal.settings.getEncryptedApiKey);

    if (!encryptedValue) {
      return null;
    }

    // Get encryption secret from environment
    const encryptionSecret = process.env.ENCRYPTION_SECRET;
    if (!encryptionSecret) {
      console.warn("ENCRYPTION_SECRET environment variable is not configured. Attempting to use stored value as-is.");
    }

    try {
      // Decrypt and return the API key
      return decrypt(encryptedValue, encryptionSecret);
    } catch (error) {
      // If decryption fails, the key might be stored in plain text (legacy)
      // Check if it looks like a valid API key
      if (encryptedValue.startsWith("AIza")) {
        console.warn("API key appears to be stored in plain text. Please re-save it to encrypt.");
        return encryptedValue;
      }
      throw new Error(`Failed to decrypt API key: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});
