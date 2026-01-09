import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { HelpCircle } from "lucide-react";

export interface DecisionNodeData {
  label?: string;
  condition?: string;
  conditionDescription?: string;
  colorIndex?: number;
}

function DecisionNode({ data }: NodeProps) {
  const nodeData = data as DecisionNodeData;

  return (
    <div className="flex flex-col items-center relative">
      {/* Top target handle for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-amber-500 !border-2 !border-amber-600"
      />
      {/* Left target handle for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-amber-500 !border-2 !border-amber-600"
        style={{ top: "56px" }}
      />

      {/* Diamond shape container */}
      <div className="relative w-28 h-28">
        {/* Diamond background */}
        <div
          className="absolute inset-0 bg-amber-100 border-2 border-amber-500
                     transform rotate-45 shadow-md hover:shadow-lg transition-shadow"
          style={{ top: "14px", left: "14px", width: "80px", height: "80px" }}
        />

        {/* Content overlay (not rotated) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <HelpCircle className="w-5 h-5 text-amber-600 mb-1" />
          <span className="text-xs font-medium text-amber-800 text-center px-2 line-clamp-2">
            {nodeData.label || nodeData.condition || "?"}
          </span>
        </div>
      </div>

      {/* Condition description */}
      {nodeData.conditionDescription && (
        <div className="mt-1 text-xs text-gray-500 text-center max-w-[120px] line-clamp-2">
          {nodeData.conditionDescription}
        </div>
      )}

      {/* Yes branch - bottom for TB, right for LR */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="yes-right"
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-600"
        style={{ top: "40px" }}
      />

      {/* No branch - right for TB, bottom for LR */}
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        className="w-3 h-3 !bg-red-500 !border-2 !border-red-600"
        style={{ top: "72px" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no-bottom"
        className="w-3 h-3 !bg-red-500 !border-2 !border-red-600"
        style={{ left: "70%" }}
      />
    </div>
  );
}

export default memo(DecisionNode);
