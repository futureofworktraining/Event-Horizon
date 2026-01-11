"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ExportStatus = "idle" | "exporting" | "downloading" | "complete" | "error";

// Estimated seconds per step for Word export
const WORD_SECONDS_PER_STEP = 5;
// Estimated seconds per step for PDF export (pdf-lib is ~2x slower than docx)
const PDF_SECONDS_PER_STEP = 10;
// Minimum estimated time in seconds for Word
const WORD_MIN_ESTIMATED_TIME = 15;
// Minimum estimated time in seconds for PDF
const PDF_MIN_ESTIMATED_TIME = 25;

export interface ExportItem {
  id: string;
  status: ExportStatus;
  format: "word" | "pdf" | "json";
  filename: string;
  error: string | null;
  startTime: number;
  stepCount: number;
  estimatedDuration: number; // in milliseconds
}

interface ExportContextValue {
  exports: Record<string, ExportItem>;
  startExport: (format: "word" | "pdf" | "json", filename: string, stepCount: number) => string;
  setDownloading: (id: string) => void;
  completeExport: (id: string) => void;
  failExport: (id: string, error: string) => void;
  dismissExport: (id: string) => void;
}

const ExportContext = createContext<ExportContextValue | null>(null);

export function ExportProvider({ children }: { children: ReactNode }) {
  const [exports, setExports] = useState<Record<string, ExportItem>>({});

  const startExport = useCallback((format: "word" | "pdf" | "json", filename: string, stepCount: number) => {
    const id = crypto.randomUUID();

    // Calculate estimated duration based on step count and format
    // PDF generation with pdf-lib takes ~2x longer than Word with docx
    const secondsPerStep = format === "pdf" ? PDF_SECONDS_PER_STEP : WORD_SECONDS_PER_STEP;
    const minTime = format === "pdf" ? PDF_MIN_ESTIMATED_TIME : WORD_MIN_ESTIMATED_TIME;
    const estimatedSeconds = Math.max(minTime, stepCount * secondsPerStep);

    setExports(prev => ({
      ...prev,
      [id]: {
        id,
        status: "exporting",
        format,
        filename,
        error: null,
        startTime: Date.now(),
        stepCount,
        estimatedDuration: estimatedSeconds * 1000,
      }
    }));

    return id;
  }, []);

  const setDownloading = useCallback((id: string) => {
    setExports(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], status: "downloading" }
      };
    });
  }, []);

  const completeExport = useCallback((id: string) => {
    setExports(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], status: "complete" }
      };
    });
  }, []);

  const failExport = useCallback((id: string, error: string) => {
    setExports(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], status: "error", error }
      };
    });
  }, []);

  const dismissExport = useCallback((id: string) => {
    setExports(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return (
    <ExportContext.Provider
      value={{
        exports,
        startExport,
        setDownloading,
        completeExport,
        failExport,
        dismissExport,
      }}
    >
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error("useExport must be used within an ExportProvider");
  }
  return context;
}
