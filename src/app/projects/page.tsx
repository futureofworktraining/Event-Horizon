"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileText, Clock, CheckCircle2, ArrowRight, Loader2, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: "Pending", className: "text-amber-600 bg-amber-50" },
    processing: { icon: Loader2, label: "Processing", className: "text-blue-600 bg-blue-50" },
    completed: { icon: CheckCircle2, label: "Completed", className: "text-emerald-600 bg-emerald-50" },
    failed: { icon: AlertCircle, label: "Failed", className: "text-red-600 bg-red-50" },
  }[status] || { icon: Clock, label: status, className: "text-gray-600 bg-gray-50" };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || undefined;

  const jobs = useQuery(api.jobs.listJobs, {
    limit: 50,
    search: searchQuery
  });
  const completedJobs = jobs?.filter(j => j.status === "completed") || [];
  const pendingJobs = jobs?.filter(j => j.status === "pending" || j.status === "processing") || [];
  const allJobs = jobs || [];

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage your process documentation projects
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allJobs.length}</p>
                <p className="text-sm text-muted-foreground">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedJobs.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingJobs.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            Click on a completed project to view its process documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs === undefined ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 rounded-lg border bg-muted/30 animate-pulse">
                  <div className="h-5 w-32 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : allJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Link href="/upload">
                <Button>Upload Your First Video</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allJobs.map(job => {
                const isCompleted = job.status === "completed" && job.processId;

                const content = (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate transition-colors ${isCompleted ? "group-hover:text-violet-600" : ""
                        }`}>
                        {job.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {formatDate(job.createdAt)}
                        </p>
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                    {isCompleted && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                );

                if (isCompleted) {
                  return (
                    <Link
                      key={job._id}
                      href={`/process/${job.processId}`}
                      className="group p-4 rounded-lg border bg-card transition-all hover:bg-muted/30 hover:border-violet-200 cursor-pointer"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={job._id}
                    className="p-4 rounded-lg border bg-card opacity-80"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
