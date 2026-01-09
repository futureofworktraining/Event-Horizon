"use client";

import { ChevronRight, Home, Workflow } from "lucide-react";
import Link from "next/link";
import { getProcessColor } from "@/lib/processColors";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  _id: string;
  processName: string;
  colorIndex?: number;
}

interface ProcessBreadcrumbsProps {
  path: BreadcrumbItem[];
  onNavigate: (processId: string) => void;
  className?: string;
}

export default function ProcessBreadcrumbs({
  path,
  onNavigate,
  className = "",
}: ProcessBreadcrumbsProps) {
  if (!path || path.length === 0) {
    return null;
  }

  return (
    <nav className={cn("flex items-center gap-1 flex-wrap", className)}>
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Projects
      </Link>
      <span className="text-muted-foreground">/</span>

      {/* Home/root icon */}
      <button
        onClick={() => onNavigate(path[0]._id)}
        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
        title="Go to main process"
      >
        <Home className="w-4 h-4 text-gray-500" />
      </button>

      {path.map((item, index) => {
        const isLast = index === path.length - 1;
        const color = getProcessColor(item.colorIndex);

        return (
          <div key={item._id} className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-gray-300" />

            {isLast ? (
              // Current process - not clickable
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded",
                  color.bgLight
                )}
              >
                <Workflow className={cn("w-3.5 h-3.5", color.text)} />
                <span className={cn("text-sm font-medium", color.text)}>
                  {item.processName}
                </span>
              </div>
            ) : (
              // Parent process - clickable
              <button
                onClick={() => onNavigate(item._id)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded",
                  "hover:bg-gray-100 transition-colors"
                )}
              >
                <Workflow className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-sm text-gray-600 hover:text-gray-800">
                  {item.processName}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
