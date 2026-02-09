/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo, useEffect } from "react";
import { api } from "../../convex/_generated/api";

let cachedClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (!cachedClient) {
    cachedClient = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }
  return cachedClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => getConvexClient(), []);

  // Expose Convex client and API globally for browser console debugging
  useEffect(() => {
    (window as any).convex = convex;
    (window as any).convexApi = api;

    (window as any).testSensitivePrompt = async (processId: string, prompt: string) => {
      return await convex.mutation(api.processes.updateSensitiveInfoPrompt, {
        processId: processId as any,
        prompt,
      });
    };

    (window as any).testSensitiveDetection = async (processId: string, prompt?: string) => {
      return await convex.action(api.sensitiveInfoDetection.detectSensitiveInformation, {
        processId: processId as any,
        customPrompt: prompt,
      });
    };
  }, [convex]);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
