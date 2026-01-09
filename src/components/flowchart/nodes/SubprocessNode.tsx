import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Workflow, ChevronRight, ChevronDown } from "lucide-react";
import { getProcessColorHex } from "@/lib/processColors";

export interface SubprocessNodeData {
  label?: string;
  subprocessId?: string;
  subprocessName?: string;
  colorIndex?: number;
  isCollapsed?: boolean;
  stepCount?: number;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

function SubprocessNode({ data }: NodeProps) {
  const nodeData = data as SubprocessNodeData;
  const color = getProcessColorHex(nodeData.colorIndex);

  return (
    <div className="flex flex-col items-center relative">
      {/* Top target for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3"
        style={{ backgroundColor: color.main, borderColor: color.border }}
      />
      {/* Left target for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3"
        style={{ backgroundColor: color.main, borderColor: color.border, top: "50%" }}
      />

      {/* Double-bordered rectangle for subprocess */}
      <div
        className="min-w-[200px] bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer"
        style={{
          border: `3px double ${color.main}`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onNavigate?.();
        }}
      >
        {/* Header with color */}
        <div
          className="px-3 py-2 rounded-t-md flex items-center justify-between"
          style={{ backgroundColor: color.light }}
        >
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4" style={{ color: color.main }} />
            <span className="text-sm font-medium" style={{ color: color.main }}>
              Subprocess
            </span>
          </div>

          {/* Collapse toggle */}
          {nodeData.onToggleCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onToggleCollapse?.();
              }}
              className="p-1 rounded hover:bg-white/50 transition-colors"
            >
              {nodeData.isCollapsed ? (
                <ChevronRight className="w-4 h-4" style={{ color: color.main }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: color.main }} />
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-gray-800">
            {nodeData.subprocessName || nodeData.label || "Unnamed Subprocess"}
          </div>

          {nodeData.stepCount !== undefined && (
            <div className="text-xs text-gray-500 mt-1">
              {nodeData.stepCount} steps
            </div>
          )}
        </div>

        {/* Visual indicator for subprocess content */}
        <div
          className="h-1 rounded-b-md"
          style={{ backgroundColor: color.main }}
        />
      </div>

      {/* Bottom source for TB layout */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3"
        style={{ backgroundColor: color.main, borderColor: color.border }}
      />
      {/* Right source for LR layout */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3"
        style={{ backgroundColor: color.main, borderColor: color.border, top: "50%" }}
      />
    </div>
  );
}

export default memo(SubprocessNode);
