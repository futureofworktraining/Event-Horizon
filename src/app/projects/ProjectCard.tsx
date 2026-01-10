import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, ArrowRight, Loader2, AlertCircle, Trash2 } from "lucide-react";
import Link from "next/link";

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
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

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

            <div className="flex items-center gap-2">
                {isCompleted && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 -mr-2"
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
        </div>
    );

    if (isCompleted) {
        return (
            <Link
                href={`/process/${job.processId}`}
                className="group p-4 rounded-lg border bg-card transition-all hover:bg-muted/30 hover:border-violet-200 cursor-pointer block"
            >
                {content}
            </Link>
        );
    }

    return (
        <div className="p-4 rounded-lg border bg-card opacity-80">
            {content}
        </div>
    );
}
