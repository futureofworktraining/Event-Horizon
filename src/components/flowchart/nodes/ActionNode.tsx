import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { getProcessColorHex } from "@/lib/processColors";

export interface ActionNodeData {
  label?: string;
  stepNumber?: number;
  description?: string;
  application?: string;
  colorIndex?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as ActionNodeData;
  const color = getProcessColorHex(nodeData.colorIndex);
  const isSelected = nodeData.isSelected || selected;

  return (
    <div className="flex flex-col items-center relative">
      {/* Top handle for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-gray-500"
      />
      {/* Left handle for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-gray-500"
        style={{ top: "50%" }}
      />
      <div
        onClick={nodeData.onClick}
        className={`
          min-w-[180px] max-w-[240px] px-4 py-3
          bg-white rounded-lg border-2
          shadow-md hover:shadow-lg transition-all
          ${isSelected ? "ring-2 ring-offset-2" : ""}
          ${nodeData.onClick ? "cursor-pointer" : ""}
        `}
        style={{
          borderColor: color.border,
          ...(isSelected ? { boxShadow: `0 0 0 3px ${color.light}` } : {}),
        }}
      >
        {/* Step number badge */}
        {nodeData.stepNumber && (
          <div
            className="absolute -top-3 -left-3 w-7 h-7 rounded-full
                       flex items-center justify-center text-white text-xs font-bold shadow"
            style={{ backgroundColor: color.main }}
          >
            {nodeData.stepNumber}
          </div>
        )}

        {/* Application badge */}
        {nodeData.application && (
          <div className="text-xs text-gray-500 mb-1 truncate">
            {nodeData.application}
          </div>
        )}

        {/* Main label */}
        <div className="text-sm font-medium text-gray-800 line-clamp-2">
          {nodeData.label || `Step ${nodeData.stepNumber || "?"}`}
        </div>

        {/* Description */}
        {nodeData.description && (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {nodeData.description}
          </div>
        )}
      </div>
      {/* Bottom handle for TB layout */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-gray-500"
      />
      {/* Right handle for LR layout */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-gray-500"
        style={{ top: "50%" }}
      />
    </div>
  );
}

export default memo(ActionNode);
