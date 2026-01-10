import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to store a document reference
export const storeDocument = internalMutation({
    args: {
        processId: v.optional(v.id("processes")),
        storageId: v.id("_storage"),
        name: v.string(),
        format: v.union(v.literal("docx"), v.literal("pdf")),
        size: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("documents", {
            processId: args.processId,
            storageId: args.storageId,
            name: args.name,
            format: args.format,
            createdAt: Date.now(),
            size: args.size,
        });
    },
});

// Query to list all documents, ordered by creation date (newest first)
// This file acts as the controller for the Documents feature
export const listDocuments = query({
    args: {},
    handler: async (ctx) => {
        const documents = await ctx.db.query("documents")
            .withIndex("by_created")
            .order("desc")
            .collect();

        // Enrich with process name if available
        const documentsWithDetails = await Promise.all(
            documents.map(async (doc) => {
                let processName = "Unknown Process";
                if (doc.processId) {
                    const process = await ctx.db.get(doc.processId);
                    if (process) {
                        processName = process.processName;
                    }
                }

                // Get URL for the file
                const url = await ctx.storage.getUrl(doc.storageId);

                return {
                    ...doc,
                    processName,
                    url,
                };
            })
        );

        return documentsWithDetails;
    },
});

// Mutation to delete a document
export const deleteDocument = mutation({
    args: {
        documentId: v.id("documents"),
    },
    handler: async (ctx, args) => {
        const doc = await ctx.db.get(args.documentId);
        if (!doc) throw new Error("Document not found");

        // Delete file from storage
        await ctx.storage.delete(doc.storageId);

        // Delete record from database
        await ctx.db.delete(args.documentId);
    },
});
