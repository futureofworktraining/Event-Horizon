"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

/**
 * Checks if the Gemini API key is configured on app load.
 * Shows a toast with instructions if it's missing.
 */
export function ApiKeyCheck() {
  const apiKeyStatus = useQuery(api.settings.getApiKeyStatus);
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (apiKeyStatus === undefined) return; // still loading
    if (hasNotifiedRef.current) return; // already shown

    if (!apiKeyStatus.isConfigured) {
      hasNotifiedRef.current = true;
      toast.warning("Gemini API key not configured", {
        description:
          "Video analysis requires a Gemini API key. Get your free key at aistudio.google.com/apikey, then add it in Settings.",
        duration: 15000,
        action: {
          label: "Open Settings",
          onClick: () => (window.location.href = "/settings"),
        },
      });
    }
  }, [apiKeyStatus]);

  return null;
}
