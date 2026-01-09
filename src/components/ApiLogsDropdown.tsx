"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    Clock,
    CreditCard,
    History,
    ChevronDown,
    Info,
    Cpu,
    CheckCircle2,
    XCircle,
    ArrowUpDown
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

export function ApiLogsDropdown() {
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
            case "video_analysis": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "bounding_boxes": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
            case "sensitive_info": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "workflow": return "bg-green-500/10 text-green-500 border-green-500/20";
            default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-3 h-9 border border-border/50 bg-card/30 hover:bg-card/50 transition-all">
                    <CreditCard className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium">
                        {stats ? formatCost(stats.totalCost) : "$0.00"}
                    </span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-border/50 overflow-hidden">
                <div className="p-4 bg-gradient-to-br from-violet-500/10 via-background to-background">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-violet-500" />
                            <h3 className="font-semibold text-sm">AI Usage & Costs</h3>
                        </div>
                        <div className="flex gap-1">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-[85px] h-7 text-[9px] bg-background/50 border-border/40 px-2">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cats</SelectItem>
                                    <SelectItem value="video_analysis">Analysis</SelectItem>
                                    <SelectItem value="bounding_boxes">Boxes</SelectItem>
                                    <SelectItem value="sensitive_info">Privacy</SelectItem>
                                    <SelectItem value="workflow">Workflow</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sortBy} onValueChange={(val) => setSortBy(val as any)}>
                                <SelectTrigger className="w-[85px] h-7 text-[9px] bg-background/50 border-border/40 px-2">
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="timestamp">Newest</SelectItem>
                                    <SelectItem value="cost">Cost</SelectItem>
                                    <SelectItem value="totalTokens">Tokens</SelectItem>
                                    <SelectItem value="durationMs">Duration</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-card border border-border/40 shadow-sm">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Cost</p>
                            <p className="text-lg font-bold text-violet-500 leading-none">
                                {stats ? formatCost(stats.totalCost) : "$0.00"}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border/40 shadow-sm">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Tokens</p>
                            <p className="text-lg font-bold text-indigo-500 leading-none">
                                {stats ? (stats.totalTokens / 1000).toFixed(1) + "k" : "0"}
                            </p>
                        </div>
                    </div>
                </div>

                <DropdownMenuSeparator className="m-0" />

                <ScrollArea className="h-64">
                    <div className="flex flex-col">
                        {logs.length === 0 && (
                            <div className="p-8 text-center">
                                <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">No logs found</p>
                            </div>
                        )}
                        {logs.map((log) => (
                            <div
                                key={log._id}
                                className="p-3 border-b border-border/30 hover:bg-muted/30 transition-colors last:border-0"
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            {log.status === "success" ? (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <XCircle className="w-3 h-3 text-rose-500" />
                                            )}
                                            <span className="text-[11px] font-semibold truncate max-w-[120px]">
                                                {log.model}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-normal ${getCategoryColor(log.category)}`}>
                                            {log.category.replace("_", " ")}
                                        </Badge>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-foreground">
                                            {formatCost(log.cost)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {formatDuration(log.durationMs)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1">
                                            <Cpu className="w-2.5 h-2.5" />
                                            {log.totalTokens} tokens
                                        </span>
                                        <span>•</span>
                                        <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="italic truncate max-w-[80px]">{log.source}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DropdownMenuSeparator className="m-0" />
                <div className="p-2 bg-muted/20">
                    <Button variant="ghost" className="w-full h-8 text-[10px] text-muted-foreground hover:text-primary">
                        View All Billing History
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
