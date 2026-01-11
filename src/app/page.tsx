/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import {
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Trash2,
} from "lucide-react";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: "Pending", className: "bg-chart-1 text-black border-2 border-black font-bold" },
    processing: { icon: Loader2, label: "Processing", className: "bg-chart-5 text-white border-2 border-black font-bold" },
    completed: { icon: CheckCircle2, label: "Completed", className: "bg-chart-2 text-black border-2 border-black font-bold" },
    failed: { icon: AlertCircle, label: "Failed", className: "bg-destructive text-white border-2 border-black font-bold" },
  }[status] || { icon: Clock, label: status, className: "bg-muted text-foreground border-2 border-black font-bold" };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || undefined;

  const jobs = useQuery(api.jobs.listJobs, {
    limit: 5,
    search: searchQuery
  });

  const stats = {
    total: jobs?.length ?? 0,
    completed: jobs?.filter(j => j.status === "completed").length ?? 0,
    processing: jobs?.filter(j => j.status === "processing").length ?? 0,
    pending: jobs?.filter(j => j.status === "pending").length ?? 0,
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to Event Horizon AI. Transform your screen recordings into detailed process documentation.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Analyses</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-hard-sm border-2 border-black">
                <Layers className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-chart-2 flex items-center justify-center shadow-hard-sm border-2 border-black">
                <CheckCircle2 className="w-6 h-6 text-black" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-3xl font-bold text-blue-600">{stats.processing}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-chart-5 flex items-center justify-center shadow-hard-sm border-2 border-black">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-chart-1 flex items-center justify-center shadow-hard-sm border-2 border-black">
                <Clock className="w-6 h-6 text-black" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest video analysis jobs</CardDescription>
              </div>
              <Link href="/upload">
                <Button variant="outline" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {jobs === undefined ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 animate-pulse">
                      <div className="w-10 h-10 rounded-lg bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-48 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground mb-4">No analyses yet</p>
                  <Link href="/upload">
                    <Button className="gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Your First Video
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map(job => (
                    <RecentActivityItem key={job._id} job={job} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/upload" className="block">
                <Button className="w-full justify-start gap-3 h-12" variant="default">
                  <Upload className="w-5 h-5" />
                  Upload New Video
                </Button>
              </Link>
              <Link href="/projects" className="block">
                <Button className="w-full justify-start gap-3 h-12" variant="outline">
                  <FileText className="w-5 h-5" />
                  Browse Projects
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* How it Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 border-2 border-black shadow-hard-sm">
                    <span className="text-sm font-bold text-primary-foreground">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Upload Video</p>
                    <p className="text-xs text-muted-foreground">Record your process and upload the video file</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 border-2 border-black shadow-hard-sm">
                    <span className="text-sm font-bold text-primary-foreground">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">AI Analysis</p>
                    <p className="text-xs text-muted-foreground">Our AI extracts steps, UI elements, and actions</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 border-2 border-black shadow-hard-sm">
                    <span className="text-sm font-bold text-primary-foreground">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Export PDD</p>
                    <p className="text-xs text-muted-foreground">Download structured documentation for RPA</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecentActivityItem({ job }: { job: any }) {
  const deleteJob = useMutation(api.jobs.deleteJob);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteJob({ jobId: job._id });
    } catch (error) {
      console.error("Failed to delete job:", error);
      alert("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-background border-2 border-black shadow-hard-sm flex items-center justify-center">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{job.fileName}</p>
        <p className="text-sm text-muted-foreground">{formatDate(job.createdAt)}</p>
      </div>
      <StatusBadge status={job.status} />
      {job.status === "completed" && job.processId && (
        <Link href={`/process/${job.processId}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
