"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import {
    CreditCard,
    History,
    ChevronDown,
    Info,
    Cpu,
    Maximize2,
    ArrowUpRight
} from "lucide-react";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";

export function ApiLogsDropdown() {
    const router = useRouter();
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"timestamp" | "cost" | "totalTokens" | "durationMs">("timestamp");

    const rawLogs = useQuery(api.apiLogs.getRecentLogs, {
        limit: 50,
        category: categoryFilter === "all" ? undefined : categoryFilter
    });
    const stats = useQuery(api.apiLogs.getCostStats);

    const logs = rawLogs ? [...rawLogs].sort((a, b) => {
        if (sortBy === "timestamp") return b.timestamp - a.timestamp;
        return (b[sortBy] as number) - (a[sortBy] as number);
    }) : [];

    const formatCost = (cost: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 4,
        }).format(cost);
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case "video_analysis": return "bg-blue-500 text-white border border-foreground shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
            case "bounding_boxes": return "bg-violet-500 text-white border border-foreground shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
            case "sensitive_info": return "bg-amber-500 text-white border border-foreground shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
            case "workflow": return "bg-emerald-500 text-white border border-foreground shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
            default: return "bg-zinc-500 text-white border border-foreground shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]";
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 px-3 h-9 border-2 border-foreground bg-background shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-black text-foreground">
                        {stats ? formatCost(stats.totalCost) : "$0.00"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-foreground/50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-80 p-0 shadow-hard border-2 border-foreground bg-background bg-dot-pattern overflow-hidden data-[state=open]:animate-roll-out"
            >
                <div className="p-4 bg-background">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-violet-500 border-2 border-foreground shadow-hard-sm rounded-lg">
                                <History className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="font-black text-sm uppercase tracking-tight text-foreground">Usage & Costs</h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-1 text-foreground hover:bg-muted"
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.push("/analytics");
                                }}
                            >
                                <Maximize2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex gap-1">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[85px] h-7 text-[10px] bg-background border-2 border-foreground shadow-hard-sm px-2 font-bold">
                                    <SelectValue placeholder="Cat" />
                                </SelectTrigger>
                                <SelectContent className="border-2 border-foreground">
                                    <SelectItem value="all">All Cats</SelectItem>
                                    <SelectItem value="video_analysis">Analysis</SelectItem>
                                    <SelectItem value="bounding_boxes">Boxes</SelectItem>
                                    <SelectItem value="sensitive_info">Privacy</SelectItem>
                                    <SelectItem value="workflow">Workflow</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
                                <SelectTrigger className="w-[85px] h-7 text-[10px] bg-background border-2 border-foreground shadow-hard-sm px-2 font-bold">
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent className="border-2 border-foreground">
                                    <SelectItem value="timestamp">Newest</SelectItem>
                                    <SelectItem value="cost">Cost</SelectItem>
                                    <SelectItem value="totalTokens">Tokens</SelectItem>
                                    <SelectItem value="durationMs">Duration</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-background border-2 border-foreground shadow-hard-sm">
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Total Cost</p>
                            <p className="text-xl font-black text-emerald-600 leading-none">
                                {stats ? formatCost(stats.totalCost) : "$0.00"}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-background border-2 border-foreground shadow-hard-sm">
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Total Tokens</p>
                            <p className="text-xl font-black text-violet-600 leading-none">
                                {stats ? (stats.totalTokens / 1000).toFixed(1) + "k" : "0"}
                            </p>
                        </div>
                    </div>
                </div>

                <DropdownMenuSeparator className="h-0.5 bg-foreground" />

                <ScrollArea className="h-64 bg-background/50 backdrop-blur-sm">
                    <div className="flex flex-col">
                        {logs.length === 0 && (
                            <div className="p-8 text-center">
                                <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs font-bold text-muted-foreground uppercase">No logs found</p>
                            </div>
                        )}
                        {logs.map((log) => (
                            <div
                                key={log._id}
                                className="p-3 border-b-2 border-foreground/5 hover:bg-muted/50 transition-colors last:border-0"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            {log.status === "success" ? (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                            )}
                                            <span className="text-[11px] font-black text-foreground uppercase tracking-tight truncate max-w-[120px]">
                                                {log.model}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-black tracking-tight", getCategoryColor(log.category))}>
                                            {log.category.replace("_", " ")}
                                        </Badge>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-black text-foreground bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                            {formatCost(log.cost)}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-bold font-mono mt-1">
                                            {formatDuration(log.durationMs)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px]">
                                    <div className="flex items-center gap-2 text-muted-foreground font-bold">
                                        <span className="flex items-center gap-1">
                                            <Cpu className="w-3 h-3" />
                                            {log.totalTokens.toLocaleString()}
                                        </span>
                                        <span className="opacity-50">•</span>
                                        <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="italic truncate max-w-[80px] text-muted-foreground font-medium">{log.source}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DropdownMenuSeparator className="h-0.5 bg-foreground" />
                <div className="p-2 bg-muted/20">
                    <Button
                        variant="ghost"
                        className="w-full h-9 text-xs font-black uppercase tracking-widest text-foreground hover:bg-foreground hover:text-background flex items-center justify-center gap-2 transition-all"
                        onClick={() => router.push("/analytics")}
                    >
                        View Full History
                        <ArrowUpRight className="w-4 h-4" />
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
