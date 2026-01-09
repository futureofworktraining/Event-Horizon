import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";

export interface SwitchNodeData {
  label?: string;
  condition?: string;
  conditionDescription?: string;
  cases?: string[];
}

function SwitchNode({ data }: NodeProps) {
  const nodeData = data as SwitchNodeData;
  const cases = nodeData.cases || [];

  return (
    <div className="flex flex-col items-center relative">
      {/* Top target for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-red-400 !border-2 !border-red-500"
      />
      {/* Left target for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-red-400 !border-2 !border-red-500"
        style={{ top: "50%" }}
      />

      {/* Hexagon-like shape for switch */}
      <div
        className="min-w-[140px] px-4 py-3 bg-red-50 border-2 border-red-400
                   rounded-lg shadow-md hover:shadow-lg transition-shadow"
        style={{
          clipPath:
            "polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)",
          padding: "16px 24px",
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <GitBranch className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {nodeData.label || "Switch"}
          </span>
        </div>
        {nodeData.condition && (
          <div className="text-xs text-red-600 text-center mt-1">
            {nodeData.condition}
          </div>
        )}
      </div>

      {/* Description */}
      {nodeData.conditionDescription && (
        <div className="mt-1 text-xs text-gray-500 text-center max-w-[140px] line-clamp-2">
          {nodeData.conditionDescription}
        </div>
      )}

      {/* Multiple output handles for cases */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="w-3 h-3 !bg-gray-500 !border-2 !border-gray-600"
      />

      {/* Right side for case 1 */}
      <Handle
        type="source"
        position={Position.Right}
        id="case1"
        className="w-3 h-3 !bg-red-400 !border-2 !border-red-500"
        style={{ top: "30%" }}
      />

      {/* Right side for case 2 */}
      <Handle
        type="source"
        position={Position.Right}
        id="case2"
        className="w-3 h-3 !bg-red-400 !border-2 !border-red-500"
        style={{ top: "70%" }}
      />

      {/* Left side for case 3 */}
      <Handle
        type="source"
        position={Position.Left}
        id="case3"
        className="w-3 h-3 !bg-red-400 !border-2 !border-red-500"
        style={{ top: "50%" }}
      />
    </div>
  );
}

export default memo(SwitchNode);
