/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExportButton } from "./ExportButton";
import { RawResponseViewer } from "./RawResponseViewer";
import { Id } from "../../../convex/_generated/dataModel";

interface ProcessHeaderProps {
  processName: string;
  processDescription: string;
  recordingDurationSeconds: number;
  totalSteps: number;
  status?: string;
  processData: any;
  jobId?: Id<"jobs">;
  rootProcessName?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function ProcessHeader({
  processName,
  processDescription,
  recordingDurationSeconds,
  totalSteps,
  status,
  processData,
  jobId,
  rootProcessName,
}: ProcessHeaderProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteVideo, setDeleteVideo] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(processName);
  const [editDescription, setEditDescription] = useState(processDescription);
  const [editBusinessRules, setEditBusinessRules] = useState(
    processData.businessRulesObserved?.join("\n") || ""
  );
  const [editExceptions, setEditExceptions] = useState(
    processData.exceptionsNoted?.join("\n") || ""
  );

  const updateProcess = useMutation(api.processes.updateProcess);
  const deleteProcess = useMutation(api.processes.deleteProcess);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProcess({
        processId: processData._id,
        processName: editName,
        processDescription: editDescription,
        businessRulesObserved: editBusinessRules
          .split("\n")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
        exceptionsNoted: editExceptions
          .split("\n")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0),
      });
      setIsEditOpen(false);
    } catch (error) {
      console.error("Failed to update process:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProcess({
        processId: processData._id,
        deleteVideo,
      });
      router.push("/projects");
    } catch (error) {
      console.error("Failed to delete process:", error);
      setIsDeleting(false);
    }
  };

  const resetEditForm = () => {
    setEditName(processName);
    setEditDescription(processDescription);
    setEditBusinessRules(processData.businessRulesObserved?.join("\n") || "");
    setEditExceptions(processData.exceptionsNoted?.join("\n") || "");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-2xl">{processName}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              {processDescription}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Edit Button */}
            <Dialog open={isEditOpen} onOpenChange={(open) => {
              setIsEditOpen(open);
              if (open) resetEditForm();
            }}>
              <DialogTrigger asChild>
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
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Process</DialogTitle>
                  <DialogDescription>
                    Update the process name, description, and other details.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Process Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Process name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Process description"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Business Rules Observed
                      <span className="text-muted-foreground font-normal ml-1">
                        (one per line)
                      </span>
                    </label>
                    <Textarea
                      value={editBusinessRules}
                      onChange={(e) => setEditBusinessRules(e.target.value)}
                      placeholder="Enter business rules, one per line"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Exceptions Noted
                      <span className="text-muted-foreground font-normal ml-1">
                        (one per line)
                      </span>
                    </label>
                    <Textarea
                      value={editExceptions}
                      onChange={(e) => setEditExceptions(e.target.value)}
                      placeholder="Enter exceptions, one per line"
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Button */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600">Delete Process</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this process? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="font-medium">{processName}</p>
                    <p className="text-sm text-muted-foreground">
                      {totalSteps} steps will be deleted along with all screenshots.
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteVideo}
                        onChange={(e) => setDeleteVideo(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">
                        Also delete the source video file
                      </span>
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete Process"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ExportButton
              processData={processData}
              processName={rootProcessName || processName}
              jobId={jobId}
            />
            {jobId && <RawResponseViewer jobId={jobId} processData={processData} />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Duration:</span>{" "}
            <span className="font-medium">{formatDuration(recordingDurationSeconds)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Steps:</span>{" "}
            <span className="font-medium">{totalSteps}</span>
          </div>
          {status && (
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className={`font-medium ${status === "completed" ? "text-green-600" : ""}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
