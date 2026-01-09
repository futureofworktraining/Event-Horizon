"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Workflow,
  FileText,
  Circle,
} from "lucide-react";
import { getProcessColor } from "@/lib/processColors";
import { cn } from "@/lib/utils";

interface ProcessTreeNode {
  _id: string;
  processName: string;
  colorIndex?: number;
  totalSteps?: number;
  hierarchyLevel?: number;
  subprocesses?: ProcessTreeNode[];
}

interface ProcessNavigatorProps {
  processes: ProcessTreeNode[];
  selectedProcessId?: string;
  onProcessSelect: (processId: string) => void;
  className?: string;
}

interface TreeItemProps {
  process: ProcessTreeNode;
  selectedProcessId?: string;
  onProcessSelect: (processId: string) => void;
  level?: number;
}

function TreeItem({
  process,
  selectedProcessId,
  onProcessSelect,
  level = 0,
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = process.subprocesses && process.subprocesses.length > 0;
  const isSelected = selectedProcessId === process._id;
  const color = getProcessColor(process.colorIndex);

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors",
          isSelected
            ? `${color.bgLight} ${color.border} border`
            : "hover:bg-gray-100"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onProcessSelect(process._id)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <Circle className={cn("w-2 h-2", color.text)} fill="currentColor" />
          </div>
        )}

        {/* Process icon */}
        <Workflow className={cn("w-4 h-4", color.text)} />

        {/* Process name */}
        <span
          className={cn(
            "text-sm font-medium truncate flex-1",
            isSelected ? color.text : "text-gray-700"
          )}
        >
          {process.processName}
        </span>

        {/* Step count badge */}
        {process.totalSteps !== undefined && (
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {process.totalSteps}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {process.subprocesses!.map((child) => (
            <TreeItem
              key={child._id}
              process={child}
              selectedProcessId={selectedProcessId}
              onProcessSelect={onProcessSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProcessNavigator({
  processes,
  selectedProcessId,
  onProcessSelect,
  className = "",
}: ProcessNavigatorProps) {
  if (!processes || processes.length === 0) {
    return (
      <div className={cn("p-4 text-sm text-gray-500", className)}>
        No processes available
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg border p-2", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b mb-2">
        <FileText className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">
          Process Navigator
        </span>
      </div>

      {/* Tree */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {processes.map((process) => (
          <TreeItem
            key={process._id}
            process={process}
            selectedProcessId={selectedProcessId}
            onProcessSelect={onProcessSelect}
          />
        ))}
      </div>
    </div>
  );
}
