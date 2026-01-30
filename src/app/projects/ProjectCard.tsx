/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Clock, CheckCircle2, ArrowRight, Loader2, AlertCircle, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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

export function ProjectCard({ job, isCompleted }: { job: any, isCompleted: boolean }) {
    const deleteJob = useMutation(api.jobs.deleteJob);
    const updateJob = useMutation(api.jobs.updateJob);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [newName, setNewName] = useState(job.fileName);
    const [isRenaming, setIsRenaming] = useState(false);

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            setIsDeleteDialogOpen(false);
            await deleteJob({ jobId: job._id });
        } catch (error) {
            console.error("Failed to delete job:", error);
            alert("Failed to delete project");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === job.fileName) {
            setIsRenameDialogOpen(false);
            return;
        }
        try {
            setIsRenaming(true);
            await updateJob({ jobId: job._id, fileName: newName.trim() });
            setIsRenameDialogOpen(false);
        } catch (error) {
            console.error("Failed to rename project:", error);
            alert("Failed to rename project");
        } finally {
            setIsRenaming(false);
        }
    };

    const handleOpenDeleteDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDeleteDialogOpen(true);
    };

    const handleOpenRenameDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setNewName(job.fileName);
        setIsRenameDialogOpen(true);
    };

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

            <div className="flex items-center gap-1">
                {isCompleted && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-1" />
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-violet-600 hover:bg-violet-50"
                    onClick={handleOpenRenameDialog}
                    title="Rename project"
                >
                    <Pencil className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    onClick={handleOpenDeleteDialog}
                    disabled={isDeleting}
                    title="Delete project"
                >
                    {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                </Button>
            </div>
        </div>
    );

    const renameDialog = (
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-violet-600" />
                        Rename Project
                    </DialogTitle>
                    <DialogDescription className="py-2">
                        Enter a new name for this project.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Project name"
                        className="w-full"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && newName.trim()) {
                                handleRename();
                            }
                        }}
                    />
                </div>
                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setIsRenameDialogOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRename}
                        disabled={!newName.trim() || isRenaming}
                    >
                        {isRenaming ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Renaming...
                            </>
                        ) : (
                            "Rename"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (isCompleted) {
        return (
            <>
                <Link
                    href={`/process/${job.processId}`}
                    className="group p-4 rounded-lg border bg-card transition-all hover:bg-muted/30 hover:border-violet-200 cursor-pointer block"
                >
                    {content}
                </Link>
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-destructive">
                                <Trash2 className="w-5 h-5" />
                                Delete Project
                            </DialogTitle>
                            <DialogDescription className="py-2">
                                Are you sure you want to delete this project? This action cannot be undone and all associated documents will be lost.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-4 bg-muted/50 rounded-lg mb-4">
                            <p className="font-medium text-sm truncate">{job.fileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">Created on {formatDate(job.createdAt)}</p>
                        </div>
                        <DialogFooter className="gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsDeleteDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                            >
                                Delete Project
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {renameDialog}
            </>
        );
    }

    return (
        <>
            <div className="p-4 rounded-lg border bg-card opacity-80">
                {content}
            </div>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="w-5 h-5" />
                            Delete Project
                        </DialogTitle>
                        <DialogDescription className="py-2">
                            Are you sure you want to delete this project? This action cannot be undone and all associated documents will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-muted/50 rounded-lg mb-4">
                        <p className="font-medium text-sm truncate">{job.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-1">Created on {formatDate(job.createdAt)}</p>
                    </div>
                    <DialogFooter className="gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                        >
                            Delete Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {renameDialog}
        </>
    );
}
