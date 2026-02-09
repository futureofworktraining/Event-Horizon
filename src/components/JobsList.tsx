/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type JobStatus = "pending" | "processing" | "completed" | "failed";

const statusConfig: Record<
  JobStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  processing: {
    label: "Processing",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  completed: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Job {
  _id: string;
  fileName: string;
  fileSize: number;
  status: string;
  progress?: number;
  errorMessage?: string;
  processId?: string;
  createdAt: number;
}

function ElapsedTime({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startTime) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-mono">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

function JobRow({ job, onDelete, onEdit }: { job: Job; onDelete: (id: string) => void; onEdit: (job: Job) => void }) {
  const status = statusConfig[job.status as JobStatus];
  const canView = job.status === "completed" && job.processId;

  return (
    <div className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Video icon */}
      <div className="flex-shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-muted-foreground"
        >
          <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
          <rect x="2" y="6" width="14" height="12" rx="2" />
        </svg>
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{job.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(job.fileSize)} &bull; {formatDate(job.createdAt)}
        </p>
        {job.status === "processing" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <svg
                className="animate-spin h-3.5 w-3.5 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-xs text-muted-foreground">
                Analyzing video...
              </span>
            </div>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <ElapsedTime startTime={job.createdAt} />
            </span>
          </div>
        )}
        {job.status === "failed" && job.errorMessage && (
          <p className="mt-1 text-xs text-red-600 line-clamp-2">
            {job.errorMessage}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color} ${status.bgColor}`}
        >
          {status.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {canView && (
          <Link href={`/process/${job.processId}`}>
            <Button variant="outline" size="sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 mr-1"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View
            </Button>
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(job)}
          className="text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(job._id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

export function JobsList() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || undefined;

  const jobs = useQuery(api.jobs.listJobs, {
    limit: 20,
    search: searchQuery
  });
  const deleteJobMutation = useMutation(api.jobs.deleteJob);
  const updateJobMutation = useMutation(api.jobs.updateJob);

  // Track failed jobs to avoid duplicate toasts
  const notifiedFailureRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Monitor for failed jobs and show toast
  useEffect(() => {
    if (!jobs) return;

    if (isFirstLoadRef.current) {
      // On first load, mark existing failed jobs as notified to avoid spamming
      jobs.forEach((job) => {
        if (job.status === "failed") {
          notifiedFailureRef.current.add(job._id);
        }
      });
      isFirstLoadRef.current = false;
      return;
    }

    // Check for new failures
    jobs.forEach((job) => {
      if (job.status === "failed" && !notifiedFailureRef.current.has(job._id)) {
        const isApiKeyError = job.errorMessage?.toLowerCase().includes("gemini api key not configured");
        if (isApiKeyError) {
          toast.error("Gemini API key not configured", {
            description: "Get your free API key at aistudio.google.com/apikey, then add it in Settings.",
            duration: 10000,
            action: {
              label: "Open Settings",
              onClick: () => window.location.href = "/settings",
            },
          });
        } else {
          toast.error(`Analysis failed: ${job.errorMessage || "Unknown error"}`, {
            description: `File: ${job.fileName}`,
            duration: 5000,
          });
        }
        notifiedFailureRef.current.add(job._id);
      }
    });
  }, [jobs]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);
  const [editFileName, setEditFileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteClick = (jobId: string) => {
    const job = jobs?.find((j) => j._id === jobId);
    if (job) {
      setJobToDelete(job as Job);
      setDeleteDialogOpen(true);
    }
  };

  const handleEditClick = (job: Job) => {
    setJobToEdit(job);
    setEditFileName(job.fileName);
    setEditDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await deleteJobMutation({ jobId: jobToDelete._id as any });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error) {
      console.error("Failed to delete job:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!jobToEdit || !editFileName.trim()) return;
    setIsSaving(true);
    try {
      await updateJobMutation({
        jobId: jobToEdit._id as any,
        fileName: editFileName.trim(),
      });
      setEditDialogOpen(false);
      setJobToEdit(null);
    } catch (error) {
      console.error("Failed to update job:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (jobs === undefined) {
    return (
      <div className="animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
            <div className="h-6 w-6 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4"
        >
          <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
          <rect x="2" y="6" width="14" height="12" rx="2" />
        </svg>
        <p>No jobs yet. Upload a video to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/20 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
        <div className="w-6 flex-shrink-0" /> {/* Icon spacer */}
        <div className="flex-1">File Details</div>
        <div className="w-32 text-center">Status</div>
        <div className="w-[150px] text-right pr-2">Actions</div>
      </div>
      <div>
        {jobs.map((job) => (
          <JobRow
            key={job._id}
            job={job as Job}
            onDelete={handleDeleteClick}
            onEdit={handleEditClick}
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this job? This will permanently delete:
            </DialogDescription>
          </DialogHeader>
          {jobToDelete && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="font-medium text-sm">{jobToDelete.fileName}</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>The uploaded video file</li>
                  {jobToDelete.processId && (
                    <>
                      <li>The generated process document</li>
                      <li>All screenshots and analysis data</li>
                    </>
                  )}
                </ul>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>
              Change the display name for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">File Name</label>
              <Input
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                placeholder="Enter file name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editFileName.trim()}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
