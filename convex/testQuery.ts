import { query } from "./_generated/server";

// Simple query without "use node" to test if regular actions work
export const testQuery = query({
  args: {},
  handler: async (ctx) => {
    console.log("testQuery running");
    return { message: "Query works!", timestamp: Date.now() };
  },
});
