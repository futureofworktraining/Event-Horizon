"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useEffect } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Expose Convex client and API globally for browser console debugging
if (typeof window !== "undefined") {
  (window as any).convex = convex;
  (window as any).convexApi = api;

  // Helper function for easy mutation calls from console
  (window as any).testSensitivePrompt = async (processId: string, prompt: string) => {
    return await convex.mutation(api.processes.updateSensitiveInfoPrompt, {
      processId: processId as any,
      prompt,
    });
  };

  // Helper to run sensitive detection
  (window as any).testSensitiveDetection = async (processId: string, prompt?: string) => {
    return await convex.action(api.sensitiveInfoDetection.detectSensitiveInformation, {
      processId: processId as any,
      customPrompt: prompt,
    });
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
