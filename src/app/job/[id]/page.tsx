/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Database, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function JobPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isValidId = rawId && /^[a-zA-Z0-9]+$/.test(rawId) && rawId.length > 15;
  const jobId = isValidId ? (rawId as Id<"jobs">) : null;

  // Core job data
  const job = useQuery(api.jobs.getJob, jobId ? { jobId } : "skip");

  // Session data for state display
  const session = useQuery(api.agentSessions.getSessionForJob, jobId ? { jobId } : "skip");

  // Watch for process creation - redirect as soon as process exists
  const processData = useQuery(
    api.processes.getProcessByJobId,
    jobId ? { jobId } : "skip"
  );

  // Redirect to process page as soon as process is created
  useEffect(() => {
    if (processData?._id) {
      router.replace(`/process/${processData._id}`);
    }
  }, [processData?._id, router]);

  // Also redirect if job is completed with processId (fallback)
  useEffect(() => {
    if (job?.status === "completed" && job.processId) {
      router.replace(`/process/${job.processId}`);
    }
  }, [job?.status, job?.processId, router]);

  // Loading
  if (!jobId || job === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (job === null) {
    return (
      <div className="p-8 text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Job Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The analysis job does not exist or has been deleted.
        </p>
        <Link href="/upload">
          <Button>Upload Video</Button>
        </Link>
      </div>
    );
  }

  // Failed
  if (job.status === "failed") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h3 className="text-lg font-semibold text-destructive">Analysis Failed</h3>
          <p className="text-sm text-muted-foreground">
            {job.errorMessage || "An error occurred during video analysis"}
          </p>
          <Link href="/upload">
            <Button>Try Again</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Completed but waiting for redirect
  if (job.status === "completed") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to process page...</p>
        </div>
      </div>
    );
  }

  // Pending / Processing - minimal waiting room
  const sessionState = session?.state || "idle";

  const stateIcon = (() => {
    switch (sessionState) {
      case "uploading": return <Upload className="w-10 h-10 text-blue-500 animate-pulse" />;
      case "caching":   return <Database className="w-10 h-10 text-purple-500 animate-pulse" />;
      default:          return <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />;
    }
  })();

  const stateText = (() => {
    switch (sessionState) {
      case "uploading": return "Uploading video to AI for analysis...";
      case "caching":   return "Creating context cache for efficient analysis...";
      case "analyzing": return "AI agent is starting analysis...";
      default:          return "Preparing video analysis...";
    }
  })();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="flex justify-center">{stateIcon}</div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Processing Video</h3>
            <p className="text-sm text-muted-foreground">{stateText}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll be redirected automatically once analysis begins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
