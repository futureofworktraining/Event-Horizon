"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Brain,
  Wrench,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Zap,
  FileText,
  Activity,
  Loader2,
  Upload,
  Database,
  Minimize2,
  Minus,
  Maximize2,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Pause,
} from "lucide-react";

// ============================================
// Types
// ============================================

interface AgentActivityViewProps {
  jobId: Id<"jobs">;
  defaultViewMode?: ViewMode;
}

type ViewMode = "collapsed" | "medium" | "expanded";
type SessionState = "idle" | "uploading" | "caching" | "analyzing" | "completed" | "error" | "paused";
type EventType = "state_changed" | "thinking" | "tool_call" | "tool_result" | "pdd_updated" | "progress" | "completed" | "error";

// ============================================
// Config
// ============================================

const STATE_CONFIG: Record<SessionState, { label: string; color: string; description: string }> = {
  idle: { label: "Idle", color: "bg-gray-100 text-gray-700", description: "Preparing to start..." },
  uploading: { label: "Uploading", color: "bg-blue-100 text-blue-700", description: "Uploading video to Gemini for analysis..." },
  caching: { label: "Caching", color: "bg-purple-100 text-purple-700", description: "Creating context cache for efficient analysis..." },
  analyzing: { label: "Analyzing", color: "bg-amber-100 text-amber-700", description: "AI agent is iteratively building the PDD..." },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", description: "Analysis complete!" },
  error: { label: "Error", color: "bg-red-100 text-red-700", description: "An error occurred during analysis." },
  paused: { label: "Paused", color: "bg-yellow-100 text-yellow-700", description: "Analysis paused. Click Resume to continue." },
};

const EVENT_STYLE: Record<EventType, { icon: React.ReactNode; label: string; badgeCls: string; rowCls: string }> = {
  thinking: {
    icon: <Brain className="w-4 h-4 text-purple-500" />,
    label: "Thinking",
    badgeCls: "text-purple-600 border-purple-200 bg-purple-50",
    rowCls: "border-l-2 border-l-purple-400 bg-purple-50/40",
  },
  tool_call: {
    icon: <Wrench className="w-4 h-4 text-blue-500" />,
    label: "Tool Call",
    badgeCls: "text-blue-600 border-blue-200 bg-blue-50",
    rowCls: "border-l-2 border-l-blue-400 bg-blue-50/40",
  },
  tool_result: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    label: "Result",
    badgeCls: "text-green-600 border-green-200 bg-green-50",
    rowCls: "border-l-2 border-l-green-400 bg-green-50/40",
  },
  pdd_updated: {
    icon: <FileText className="w-4 h-4 text-amber-500" />,
    label: "PDD Updated",
    badgeCls: "text-amber-600 border-amber-200 bg-amber-50",
    rowCls: "border-l-2 border-l-amber-400 bg-amber-50/40",
  },
  progress: {
    icon: <Activity className="w-4 h-4 text-cyan-600" />,
    label: "Iteration",
    badgeCls: "text-cyan-700 border-cyan-200 bg-cyan-50",
    rowCls: "border-l-2 border-l-cyan-400 bg-cyan-50/30",
  },
  state_changed: {
    icon: <RefreshCw className="w-4 h-4 text-gray-500" />,
    label: "State",
    badgeCls: "text-gray-600 border-gray-200 bg-gray-50",
    rowCls: "border-l-2 border-l-gray-300",
  },
  completed: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    label: "Done",
    badgeCls: "text-green-700 border-green-300 bg-green-50",
    rowCls: "border-l-2 border-l-green-500 bg-green-50/50",
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-red-500" />,
    label: "Error",
    badgeCls: "text-red-600 border-red-200 bg-red-50",
    rowCls: "border-l-2 border-l-red-500 bg-red-50/50",
  },
};

// ============================================
// Formatting Helpers
// ============================================

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${tokens}`;
}

function formatElapsed(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parsePayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload);
  } catch {
    return { message: payload };
  }
}

// Approximate per-iteration cost from stepTokens
function calcIterCost(input: number, output: number, cached: number): number {
  const nonCached = Math.max(0, input - cached);
  return (
    (nonCached / 1_000_000) * 0.15 +
    (cached / 1_000_000) * 0.0375 +
    (output / 1_000_000) * 3.50
  );
}

// ============================================
// Event Description Renderer
// ============================================

function getEventDescription(eventType: EventType, payload: Record<string, unknown>): { primary: string; secondary?: string } {
  switch (eventType) {
    case "thinking":
      return { primary: (payload.text as string) || "Reasoning..." };
    case "tool_call": {
      const tool = (payload.tool as string) || (payload.name as string) || "tool";
      const args = payload.args as Record<string, unknown> | undefined;
      let argsStr = "";
      if (args) {
        const entries = Object.entries(args).slice(0, 3);
        argsStr = entries.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)?.slice(0, 40)}`).join(", ");
      }
      return { primary: `Calling ${tool}`, secondary: argsStr || undefined };
    }
    case "tool_result": {
      const tool = (payload.tool as string) || (payload.name as string) || "tool";
      const success = payload.success !== false;
      const summary = (payload.summary as string) || "";
      return {
        primary: success ? `${tool} completed` : `${tool} failed`,
        secondary: summary || undefined,
      };
    }
    case "pdd_updated": {
      const stats = payload.stats as Record<string, number> | undefined;
      const section = (payload.section as string) || "";
      if (stats) {
        return {
          primary: `Document updated (${section})`,
          secondary: `${stats.processCount ?? 0} processes, ${stats.stepCount ?? 0} steps, ${stats.nodeCount ?? 0} nodes`,
        };
      }
      return { primary: (payload.message as string) || "PDD data updated" };
    }
    case "progress": {
      const iter = payload.iteration as number;
      const maxIter = payload.maxIterations as number;
      return { primary: `Iteration ${iter}/${maxIter} completed` };
    }
    case "state_changed": {
      const message = payload.message as string;
      const state = (payload.state as string) || (payload.to as string) || "unknown";
      return { primary: message || `State changed to ${state}` };
    }
    case "completed":
      return { primary: (payload.message as string) || "Analysis completed successfully" };
    case "error":
      return { primary: (payload.message as string) || (payload.error as string) || "Error occurred" };
    default:
      return { primary: (payload.message as string) || eventType };
  }
}

// ============================================
// Main Component
// ============================================

export function AgentActivityView({ jobId, defaultViewMode = "medium" }: AgentActivityViewProps) {
  const session = useQuery(api.agentSessions.getSessionForJob, { jobId });
  const events = useQuery(api.agentEvents.getEventsForJob, { jobId, limit: 200 });

  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [elapsed, setElapsed] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Elapsed timer
  useEffect(() => {
    if (!session?.startedAt || session.state === "completed" || session.state === "error" || session.state === "paused") return;
    setElapsed(formatElapsed(session.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(session.startedAt!));
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt, session?.state]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (viewMode !== "collapsed") {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events?.length, viewMode]);

  // Parse events once
  const parsedEvents = useMemo(() => {
    if (!events) return [];
    return events.map((e) => ({
      ...e,
      parsed: parsePayload(e.payload),
    }));
  }, [events]);

  // Latest thinking text
  const thinkingText = useMemo(() => {
    const ev = parsedEvents.slice().reverse().find((e) => e.eventType === "thinking");
    return ev ? ((ev.parsed.text as string) || "...") : null;
  }, [parsedEvents]);

  const stateConfig = STATE_CONFIG[(session?.state as SessionState) || "idle"];

  // Header icon
  const headerIcon = (() => {
    switch (session?.state) {
      case "analyzing": return <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />;
      case "uploading": return <Upload className="h-6 w-6 text-blue-500 animate-pulse" />;
      case "caching":   return <Database className="h-6 w-6 text-purple-500 animate-pulse" />;
      case "completed": return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case "paused":    return <Pause className="h-6 w-6 text-yellow-500" />;
      case "error":     return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:          return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
    }
  })();

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header row - always visible */}
        <div className="flex items-center gap-3">
          <div className="shrink-0">{headerIcon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">AI Agent Analysis</h3>
              <Badge variant="secondary" className={stateConfig.color}>
                {stateConfig.label}
              </Badge>
            </div>
            {viewMode !== "collapsed" && (
              <p className="text-sm text-muted-foreground">{stateConfig.description}</p>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 border rounded-lg p-0.5 shrink-0">
            <Button
              variant={viewMode === "collapsed" ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("collapsed")}
              title="Collapsed"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewMode === "medium" ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("medium")}
              title="1/3 Screen"
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={viewMode === "expanded" ? "default" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setViewMode("expanded")}
              title="Full Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Metrics row */}
        {session && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Iter {session.iteration}/{session.maxIterations}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              <span>{formatTokens(session.inputTokens)} in / {formatTokens(session.outputTokens)} out</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Database className="w-3.5 h-3.5" />
              <span>{formatTokens(session.cachedTokens)} cached</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="w-3.5 h-3.5" />
              <span className="font-mono">{formatCost(session.totalCost)}</span>
            </div>
            {elapsed && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsed}</span>
              </div>
            )}
          </div>
        )}

        {/* Expanded content (hidden in collapsed mode) */}
        {viewMode !== "collapsed" && (
          <>
            {/* Thinking panel */}
            {thinkingText && (
              <div className="rounded-lg border bg-purple-50/30 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Agent Reasoning</span>
                </div>
                <p className={`text-sm italic text-muted-foreground ${viewMode === "expanded" ? "line-clamp-6" : "line-clamp-3"}`}>
                  {thinkingText}
                </p>
              </div>
            )}

            {/* Event feed */}
            {parsedEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity Feed</span>
                  <Badge variant="outline" className="text-[10px] h-5 ml-1">{parsedEvents.length}</Badge>
                </div>

                <div
                  className={`overflow-y-auto rounded-lg border ${
                    viewMode === "expanded" ? "h-[70vh]" : "h-[33vh]"
                  }`}
                >
                  <div className="p-2 space-y-1.5">
                    {parsedEvents.map((event) => {
                      const eventType = event.eventType as EventType;
                      const style = EVENT_STYLE[eventType] || EVENT_STYLE.state_changed;
                      const { primary, secondary } = getEventDescription(eventType, event.parsed);

                      // Per-iteration stats from progress events
                      const stepTokens = eventType === "progress"
                        ? (event.parsed.stepTokens as Record<string, number> | undefined)
                        : null;
                      const stepDuration = eventType === "progress"
                        ? ((event.parsed.stepDuration as number | undefined) ?? null)
                        : null;

                      // Failed tool_result gets red styling
                      const isFailed = eventType === "tool_result" && event.parsed.success === false;
                      const rowCls = isFailed ? "border-l-2 border-l-red-400 bg-red-50/40" : style.rowCls;
                      const iconOverride = isFailed ? <AlertCircle className="w-4 h-4 text-red-500" /> : style.icon;

                      return (
                        <div
                          key={event._id}
                          className={`flex items-start gap-3 py-2 px-3 rounded-lg ${rowCls}`}
                        >
                          {/* Icon */}
                          <span className="mt-0.5 shrink-0">{iconOverride}</span>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 font-medium ${style.badgeCls}`}>
                                {style.label}
                              </Badge>
                              {event.iteration !== undefined && (
                                <span className="text-[10px] text-muted-foreground font-mono">#{event.iteration}</span>
                              )}
                            </div>
                            <p className={`text-sm mt-0.5 ${
                              eventType === "thinking" ? "italic text-muted-foreground line-clamp-2" :
                              eventType === "error" || isFailed ? "text-red-700" :
                              "text-foreground"
                            }`}>
                              {primary}
                            </p>
                            {secondary && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{secondary}</p>
                            )}
                          </div>

                          {/* Per-iteration stats (on progress events) */}
                          {stepTokens && (
                            <div className="shrink-0 text-right space-y-0.5">
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <ArrowDownRight className="w-3 h-3 text-blue-400" />
                                <span>{formatTokens(stepTokens.input || 0)}</span>
                                <ArrowUpRight className="w-3 h-3 text-green-400" />
                                <span>{formatTokens(stepTokens.output || 0)}</span>
                              </div>
                              <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                                <span className="font-mono">
                                  {formatCost(calcIterCost(stepTokens.input || 0, stepTokens.output || 0, stepTokens.cached || 0))}
                                </span>
                                {stepDuration != null && (
                                  <>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span>{formatDuration(stepDuration as number)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={scrollRef} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
