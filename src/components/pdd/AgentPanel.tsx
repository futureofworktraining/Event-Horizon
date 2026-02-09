/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
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
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Pause,
  Square,
  Play,
  RotateCcw,
  X,
  Bot,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

// ============================================
// Types
// ============================================

interface AgentPanelProps {
  jobId: Id<"jobs">;
  isOpen: boolean;
  onToggle: () => void;
  videoStorageId?: Id<"_storage">;
}

type SessionState = "idle" | "uploading" | "caching" | "analyzing" | "completed" | "error" | "paused";
type EventType = "state_changed" | "thinking" | "tool_call" | "tool_result" | "pdd_updated" | "progress" | "completed" | "error";

// ============================================
// Config
// ============================================

const STATE_CONFIG: Record<SessionState, { label: string; color: string; dotColor: string }> = {
  idle: { label: "Idle", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  uploading: { label: "Uploading", color: "text-blue-500", dotColor: "bg-blue-500 animate-pulse" },
  caching: { label: "Caching", color: "text-purple-500", dotColor: "bg-purple-500 animate-pulse" },
  analyzing: { label: "Analyzing", color: "text-amber-500", dotColor: "bg-amber-500 animate-pulse" },
  completed: { label: "Completed", color: "text-green-500", dotColor: "bg-green-500" },
  error: { label: "Error", color: "text-red-500", dotColor: "bg-red-500" },
  paused: { label: "Paused", color: "text-yellow-500", dotColor: "bg-yellow-500" },
};

const EVENT_STYLE: Record<EventType, { icon: React.ReactNode; label: string }> = {
  thinking: {
    icon: <Brain className="w-3.5 h-3.5 text-purple-500" />,
    label: "Thinking",
  },
  tool_call: {
    icon: <Wrench className="w-3.5 h-3.5 text-blue-500" />,
    label: "Tool Call",
  },
  tool_result: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    label: "Result",
  },
  pdd_updated: {
    icon: <FileText className="w-3.5 h-3.5 text-amber-500" />,
    label: "PDD Updated",
  },
  progress: {
    icon: <Activity className="w-3.5 h-3.5 text-cyan-500" />,
    label: "Iteration",
  },
  state_changed: {
    icon: <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/70" />,
    label: "State",
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    label: "Done",
  },
  error: {
    icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
    label: "Error",
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

function calcIterCost(input: number, output: number, cached: number): number {
  const nonCached = Math.max(0, input - cached);
  return (
    (nonCached / 1_000_000) * 0.15 +
    (cached / 1_000_000) * 0.0375 +
    (output / 1_000_000) * 3.50
  );
}

// ============================================
// Event Description
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
// AgentPanel Component
// ============================================

export function AgentPanel({ jobId, isOpen, onToggle, videoStorageId }: AgentPanelProps) {
  const session = useQuery(api.agentSessions.getSessionForJob, { jobId });
  const events = useQuery(api.agentEvents.getEventsForJob, { jobId, limit: 200 });

  // Agent controls
  const requestStop = useMutation(api.agentSessions.requestStop);
  const resumeSession = useMutation(api.agentSessions.resumeSession);
  const rerunAnalysis = useAction(api.agentAnalyze.agentAnalyzeVideo);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

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

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [events?.length, isOpen]);

  // Parse events
  const parsedEvents = useMemo(() => {
    if (!events) return [];
    return events.map((e) => ({
      ...e,
      parsed: parsePayload(e.payload),
    }));
  }, [events]);

  // Last agent message (for strip display)
  const lastMessage = useMemo(() => {
    const ev = parsedEvents.slice().reverse().find((e) =>
      e.eventType === "thinking" || e.eventType === "tool_call" || e.eventType === "pdd_updated" || e.eventType === "completed" || e.eventType === "error"
    );
    if (!ev) return null;
    const { primary } = getEventDescription(ev.eventType as EventType, ev.parsed);
    return primary;
  }, [parsedEvents]);

  const sessionState = (session?.state as SessionState) || "idle";
  const stateConfig = STATE_CONFIG[sessionState];
  const isActive = sessionState === "analyzing" || sessionState === "uploading" || sessionState === "caching";

  // ---- Collapsed Strip ----
  if (!isOpen) {
    return (
      <div
        className="fixed right-0 top-0 h-full w-12 z-40 flex flex-col items-center cursor-pointer border-l bg-background/95 backdrop-blur-sm hover:bg-muted/50 transition-colors shadow-sm"
        onClick={onToggle}
        title={lastMessage || stateConfig.label}
      >
        {/* Agent icon */}
        <div className="mt-4 mb-3 p-2 rounded-md hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* State dot */}
        <div className="relative mb-6 group">
           <div className={cn("w-3 h-3 rounded-full transition-all group-hover:scale-110", stateConfig.dotColor)} />
        </div>

        {/* Rotated text */}
        <div className="flex-1 flex items-start mt-2 pb-4">
          <span
            className="text-xs font-medium text-muted-foreground whitespace-nowrap uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
            }}
          >
            AI Agent <span className="opacity-50 mx-2">-</span> {stateConfig.label}
          </span>
        </div>
      </div>
    );
  }

  // ---- Open Panel ----
  return (
    <div className="fixed right-0 top-0 h-full w-[400px] z-40 border-l bg-background flex flex-col shadow-hard-lg animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="shrink-0 border-b p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5" />
            </div>
            <div>
                <h2 className="font-bold text-sm leading-none flex items-center gap-2">
                    AI Agent
                    <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 font-normal border-current opacity-80", stateConfig.color)}>
                        {stateConfig.label}
                    </Badge>
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                    {session && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {formatElapsed(session.startedAt || Date.now())}
                        </span>
                    )}
                </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onToggle}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Improved Metrics Grid */}
        {session && (
             <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground font-mono bg-muted/30 p-2 rounded-md border border-border/40">
                <div className="flex flex-col items-center justify-center border-r border-border/40 last:border-r-0">
                    <span className="text-muted-foreground/60 uppercase tracking-tighter text-[9px] mb-0.5">Tokens</span>
                    <span className="font-semibold text-foreground">{formatTokens(session.inputTokens + session.outputTokens)}</span>
                </div>
                <div className="flex flex-col items-center justify-center border-r border-border/40 last:border-r-0">
                    <span className="text-muted-foreground/60 uppercase tracking-tighter text-[9px] mb-0.5">Cost</span>
                   <span className="font-semibold text-foreground">{formatCost(session.totalCost)}</span>
                </div>
                 <div className="flex flex-col items-center justify-center border-r border-border/40 last:border-r-0">
                    <span className="text-muted-foreground/60 uppercase tracking-tighter text-[9px] mb-0.5">Iter</span>
                   <span className="font-semibold text-foreground">{session.iteration}/{session.maxIterations}</span>
                </div>
             </div>
        )}
      </div>

      {/* Control Bar (if active/complete) */}
      <div className="shrink-0 px-4 py-2 border-b bg-muted/10 flex items-center justify-between gap-2">
         <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Controls</span>
          {session && (
          <div className="flex items-center gap-2">
            {/* Pause */}
            {session.state === "analyzing" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 shadow-sm bg-background"
                disabled={actionInProgress !== null || !!session.stopRequested}
                onClick={async () => {
                  setActionInProgress("pause");
                  try { await requestStop({ jobId, action: "pause" }); } finally { setActionInProgress(null); }
                }}
              >
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                Pause
              </Button>
            )}

            {/* Resume */}
            {session.state === "paused" && videoStorageId && (
              <Button
                variant="default" 
                size="sm"
                className="h-7 text-xs px-2 shadow-sm"
                disabled={actionInProgress !== null}
                onClick={async () => {
                  setActionInProgress("resume");
                  try {
                    await resumeSession({ jobId });
                    await rerunAnalysis({ jobId, videoStorageId });
                  } finally { setActionInProgress(null); }
                }}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Resume
              </Button>
            )}

            {/* Stop */}
            {(session.state === "analyzing" || session.state === "paused") && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs px-2 shadow-sm opacity-90 hover:opacity-100"
                disabled={actionInProgress !== null || session.stopRequested === "stop"}
                onClick={async () => {
                  setActionInProgress("stop");
                  try { await requestStop({ jobId, action: "stop" }); } finally { setActionInProgress(null); }
                }}
              >
                <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
                Stop
              </Button>
            )}

            {/* Re-run */}
            {(session.state === "completed" || session.state === "error" || session.state === "paused") && videoStorageId && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs px-3 shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-hard-xs transition-all active:translate-y-0.5 active:shadow-none bg-primary text-primary-foreground"
                disabled={actionInProgress !== null}
                onClick={async () => {
                  setActionInProgress("rerun");
                  try { await rerunAnalysis({ jobId, videoStorageId }); } finally { setActionInProgress(null); }
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Re-run Analysis
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent">
        {parsedEvents.length > 0 ? (
          <div className="relative pl-4 pb-4">
             {/* Timeline vertical line - centered on icons (16px padding + 12px half-icon = 28px) */}
             <div className="absolute left-[28px] top-3 bottom-0 w-px bg-border/40" />

            <div className="space-y-6">
              {parsedEvents.map((event, index) => {
                const eventType = event.eventType as EventType;
                const style = EVENT_STYLE[eventType] || EVENT_STYLE.state_changed;
                const { primary, secondary } = getEventDescription(eventType, event.parsed);

                const stepTokens = eventType === "progress"
                  ? (event.parsed.stepTokens as Record<string, number> | undefined)
                  : null;
                const stepDuration = eventType === "progress"
                  ? ((event.parsed.stepDuration as number | undefined) ?? null)
                  : null;

                const isFailed = eventType === "tool_result" && event.parsed.success === false;
                const isThinking = eventType === "thinking";
                const isLast = index === parsedEvents.length - 1;

                return (
                  <div key={event._id} className="relative z-10 group">
                    <div className="flex gap-3">
                       {/* Icon Bubble */}
                      <div className={cn(
                          "shrink-0 w-6 h-6 rounded-full border bg-background flex items-center justify-center shadow-sm transition-transform group-hover:scale-110", 
                          isFailed ? "border-red-500 bg-red-50" : "border-border"
                      )}>
                         {isFailed ? <AlertCircle className="w-3.5 h-3.5 text-red-500" /> : style.icon}
                      </div>
                      
                      {/* Content Card */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", isFailed ? "text-red-600" : "text-foreground")}>
                                {style.label}
                            </span>
                            {event.iteration !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded-sm">
                                #{event.iteration}
                              </span>
                            )}
                        </div>
                        
                        {/* Primary Message */}
                        <div className={cn(
                            "text-xs leading-normal rounded-md p-2 border bg-card/50 shadow-sm",
                            isThinking ? "italic text-muted-foreground font-serif bg-muted/20 border-border/30" : "text-foreground border-border/60",
                            isFailed && "bg-red-50/50 border-red-200 text-red-800"
                        )}>
                            {primary}
                        </div>

                        {/* Secondary Details */}
                        {secondary && (
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all pl-1 border-l-2 border-border/40 ml-1">
                            {secondary}
                          </p>
                        )}
                        
                        {/* Step Metadata Footer */}
                        {stepTokens && (
                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground font-mono pl-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <span title="Duration" className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> 
                                {stepDuration ? formatDuration(stepDuration) : "-"}
                            </span>
                            <span title="Tokens" className="flex items-center gap-1">
                                <Zap className="w-3 h-3" />
                                {formatTokens(stepTokens.input || 0)}in / {formatTokens(stepTokens.output || 0)}out
                            </span>
                            <span title="Cost" className="flex items-center gap-1 text-foreground/80">
                                <Coins className="w-3 h-3" />
                                {formatCost(calcIterCost(stepTokens.input || 0, stepTokens.output || 0, stepTokens.cached || 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} className="h-4" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground opacity-60">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary/40" />
            <p className="text-sm font-medium">Waiting for agent activity...</p>
            <p className="text-xs max-w-[200px] mt-1">First time analysis might take a few moments to warm up.</p>
          </div>
        )}
      </div>

      {/* Chat placeholder */}
      <div className="shrink-0 border-t p-4 bg-background">
        <div className="relative group cursor-not-allowed opacity-70 hover:opacity-100 transition-opacity">
           <div className="absolute left-3 top-2.5 text-muted-foreground">
              <Bot className="w-4 h-4" />
           </div>
          <input 
            type="text" 
            disabled 
            placeholder="Chat with AI about this process... (coming soon)" 
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm shadow-hard-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
          />
        </div>
      </div>
    </div>
  );
}
