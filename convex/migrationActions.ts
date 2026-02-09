"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Download file from a signed URL (source instance) and store in target storage
export const downloadAndStoreFile = action({
  args: {
    url: v.string(),
    oldStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(args.url);
    if (!response.ok) {
      throw new Error(
        `Failed to download file: ${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();
    const newStorageId = await ctx.storage.store(blob);

    return {
      oldStorageId: args.oldStorageId,
      newStorageId,
    };
  },
});
