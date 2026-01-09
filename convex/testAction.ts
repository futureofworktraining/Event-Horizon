"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// Minimal test action to isolate ESM issues
export const testMinimal = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    console.log("=== testMinimal action started ===");
    return "Test successful!";
  },
});
