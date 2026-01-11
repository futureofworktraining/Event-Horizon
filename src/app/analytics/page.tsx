/* eslint-disable react-hooks/preserve-manual-memoization */
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import {
  Search,
  CreditCard,
  Cpu,
  Activity,
  Filter,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const data = useQuery(api.apiLogs.getExtendedLogStats, { limit: 1000 });
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isTableOnly, setIsTableOnly] = useState<boolean>(false);

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(cost);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };


  const filteredLogs = useMemo(() => {
    if (!data?.logs) return [];
    return data.logs.filter(log => {
      const matchesProject = projectFilter === "all" || (log.processId || "unknown") === projectFilter;
      const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
      const matchesSearch = searchQuery === "" ||
        log.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.processName || "").toLowerCase().includes(searchQuery.toLowerCase());

      return matchesProject && matchesCategory && matchesSearch;
    });
  }, [data?.logs, projectFilter, categoryFilter, searchQuery]);

  const uniqueProjects = useMemo(() => {
    if (!data?.byProject) return [];
    return Object.entries(data.byProject).map(([id, info]) => ({
      id,
      name: info.name
    }));
  }, [data?.byProject]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin shadow-hard-sm" />
          <p className="font-black uppercase tracking-widest text-xs animate-pulse">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const maxProjectCost = Math.max(...Object.values(data.byProject).map(p => p.cost), 0.0001);
  const maxCategoryCost = Math.max(...Object.values(data.byCategory).map(c => c.cost), 0.0001);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "video_analysis": return "bg-blue-500 text-white border-2 border-blue-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]";
      case "bounding_boxes": return "bg-violet-500 text-white border-2 border-violet-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]";
      case "sensitive_info": return "bg-amber-500 text-white border-2 border-amber-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]";
      case "workflow": return "bg-emerald-500 text-white border-2 border-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]";
      default: return "bg-zinc-500 text-white border-2 border-zinc-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-background bg-dot-pattern overflow-hidden">
      {/* Page Header */}
      <header className="p-6 border-b-2 border-foreground bg-background/80 backdrop-blur-md shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-violet-500 border-2 border-foreground shadow-hard rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase italic">AI Usage & Cost Center</h1>
              <p className="text-muted-foreground font-bold text-sm tracking-tight">
                Real-time breakdown of API costs, resource consumption, and activity logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="default"
              onClick={() => setIsTableOnly(!isTableOnly)}
              className="hidden md:flex items-center gap-2 border-2 border-foreground shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {isTableOnly ? (
                <>
                  <Minimize2 className="w-5 h-5" />
                  <span className="font-black uppercase text-xs">Show Analytics</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-5 h-5" />
                  <span className="font-black uppercase text-xs">Table Focus</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Side Panels (Stats) */}
        {!isTableOnly && (
          <aside className="w-1/4 min-w-[380px] border-r-2 border-foreground bg-muted/30 backdrop-blur-sm overflow-y-auto hidden lg:block">
            <div className="p-8 space-y-10">
              {/* Key Performance Indicators */}
              <div className="grid grid-cols-1 gap-6">
                <div className="p-6 rounded-2xl bg-background border-2 border-foreground shadow-hard">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Gross API Cost</p>
                  <div className="text-4xl font-black text-emerald-600 flex items-center gap-3">
                    <CreditCard className="w-8 h-8" />
                    {formatCost(data.totalCost)}
                  </div>
                  <div className="mt-4 pt-4 border-t border-foreground/10 flex justify-between items-center whitespace-nowrap">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Estimated Monthly</span>
                    <span className="text-xs font-black text-foreground">{formatCost(data.totalCost * 30)}</span>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-background border-2 border-foreground shadow-hard">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Total Tokens Used</p>
                  <div className="text-4xl font-black text-violet-600 flex items-center gap-3">
                    <Cpu className="w-8 h-8" />
                    {(data.totalTokens / 1000).toFixed(1)}K
                  </div>
                  <div className="mt-4 pt-4 border-t border-foreground/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Avg per Action</span>
                    <span className="text-xs font-black text-foreground">{(data.totalTokens / (data.logs.length || 1)).toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown Sections */}
              <div className="space-y-8">
                <section className="p-6 rounded-2xl bg-background border-2 border-foreground shadow-hard">
                  <h3 className="text-sm font-black text-foreground mb-8 flex items-center gap-2 uppercase tracking-tight">
                    <span className="w-2 h-5 bg-emerald-500 border-2 border-foreground"></span>
                    Portfolio Distribution
                  </h3>
                  <div className="space-y-6">
                    {Object.entries(data.byProject)
                      .sort(([, a], [, b]) => b.cost - a.cost)
                      .slice(0, 8)
                      .map(([id, info]) => (
                        <div key={id} className="group">
                          <div className="flex justify-between text-[11px] mb-2 font-black uppercase tracking-tight">
                            <span className="text-foreground truncate max-w-[200px] border-b-2 border-transparent group-hover:border-emerald-500 transition-all">
                              {info.name}
                            </span>
                            <span className="text-emerald-600">{formatCost(info.cost)}</span>
                          </div>
                          <div className="h-4 w-full bg-muted border-2 border-foreground rounded-none overflow-hidden hover:scale-[1.02] transition-transform">
                            <div
                              className="h-full bg-emerald-500 border-r-2 border-foreground"
                              style={{ width: `${(info.cost / (data.totalCost || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </section>

                <section className="p-6 rounded-2xl bg-background border-2 border-foreground shadow-hard">
                  <h3 className="text-sm font-black text-foreground mb-8 flex items-center gap-2 uppercase tracking-tight">
                    <span className="w-2 h-5 bg-amber-500 border-2 border-foreground"></span>
                    Resource Allocation
                  </h3>
                  <div className="space-y-6">
                    {Object.entries(data.byCategory)
                      .sort(([, a], [, b]) => b.cost - a.cost)
                      .map(([cat, info]) => (
                        <div key={cat} className="group">
                          <div className="flex justify-between text-[11px] mb-2 font-black uppercase tracking-tight">
                            <span className="text-foreground border-b-2 border-transparent group-hover:border-amber-500 transition-all">
                              {cat.replace("_", " ")}
                            </span>
                            <span className="text-amber-600">{formatCost(info.cost)}</span>
                          </div>
                          <div className="h-4 w-full bg-muted border-2 border-foreground rounded-none overflow-hidden hover:scale-[1.02] transition-transform">
                            <div
                              className="h-full bg-amber-500 border-r-2 border-foreground"
                              style={{ width: `${(info.cost / (data.totalCost || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area (Logs Table) */}
        <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
          {/* Filter Bar */}
          <div className="p-6 border-b-2 border-foreground flex gap-6 items-center flex-wrap bg-background/90 backdrop-blur-xl sticky top-0 z-10">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground opacity-30" />
              <Input
                placeholder="Filter by project, process or AI model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-background border-2 border-foreground shadow-hard-sm text-sm font-bold focus-visible:ring-0 focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-none placeholder:text-muted-foreground/40 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[220px] h-12 bg-background border-2 border-foreground shadow-hard-sm text-sm font-black uppercase tracking-tight">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Project Filter" />
                </SelectTrigger>
                <SelectContent className="border-2 border-foreground shadow-hard">
                  <SelectItem value="all" className="font-black uppercase text-xs">All Projects</SelectItem>
                  {uniqueProjects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-12 bg-background border-2 border-foreground shadow-hard-sm text-sm font-black uppercase tracking-tight">
                  <Activity className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="border-2 border-foreground shadow-hard">
                  <SelectItem value="all" className="font-black uppercase text-xs">All Categories</SelectItem>
                  {Object.keys(data.byCategory).map(cat => (
                    <SelectItem key={cat} value={cat} className="font-bold text-xs capitalize">{cat.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 relative overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 z-10 border-b-2 border-foreground">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="w-[200px] text-foreground text-xs uppercase tracking-[0.1em] font-black pl-8">Event Timestamp</TableHead>
                    <TableHead className="text-foreground text-xs uppercase tracking-[0.1em] font-black">Process Context</TableHead>
                    <TableHead className="w-[180px] text-foreground text-xs uppercase tracking-[0.1em] font-black">Activity Domain</TableHead>
                    <TableHead className="w-[150px] text-foreground text-xs uppercase tracking-[0.1em] font-black">Model Instance</TableHead>
                    <TableHead className="w-[120px] text-right text-foreground text-xs uppercase tracking-[0.1em] font-black">Token Count</TableHead>
                    <TableHead className="w-[150px] text-right text-foreground text-xs uppercase tracking-[0.1em] font-black pr-8">Billing (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log._id} className="border-b-2 border-foreground/5 hover:bg-muted/30 transition-all group">
                      <TableCell className="text-[11px] text-muted-foreground font-black font-mono pl-8">
                        {formatDate(log.timestamp)}
                      </TableCell>
                      <TableCell className="font-black text-sm text-foreground uppercase tracking-tight">
                        {log.processName || "Global / Internal"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] px-3 py-1 h-auto font-black uppercase tracking-tighter border-2", getCategoryColor(log.category))}>
                          {log.category.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-black uppercase italic">
                        {log.model}
                      </TableCell>
                      <TableCell className="text-[12px] text-right text-foreground font-black font-mono">
                        {log.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="text-sm font-black text-emerald-600 font-mono bg-emerald-500/10 px-3 py-1 border-2 border-emerald-500/20 rounded-lg">
                          {formatCost(log.cost)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-40 text-muted-foreground">
                  <div className="p-8 bg-muted border-2 border-dashed border-foreground/20 rounded-full mb-6">
                    <Search className="w-16 h-16 opacity-10" />
                  </div>
                  <h3 className="font-black uppercase text-xl tracking-widest text-foreground/20 italic">No Matching Sessions</h3>
                  <p className="text-xs font-bold tracking-tight mt-2 uppercase opacity-40">Try resetting your data filters</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </main>
      </div>
    </div>
  );
}
