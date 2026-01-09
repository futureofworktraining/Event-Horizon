import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { RotateCcw } from "lucide-react";

export interface LoopBackNodeData {
  label?: string;
  targetNodeId?: string;
}

function LoopBackNode({ data }: NodeProps) {
  const nodeData = data as LoopBackNodeData;

  return (
    <div className="flex flex-col items-center relative">
      {/* Top target for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-emerald-500 !border-2 !border-emerald-600"
      />
      {/* Left target for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-emerald-500 !border-2 !border-emerald-600"
        style={{ top: "28px" }}
      />

      {/* Circular node with loop icon */}
      <div
        className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500
                   flex items-center justify-center shadow-md
                   hover:shadow-lg transition-shadow"
      >
        <RotateCcw className="w-6 h-6 text-emerald-600" />
      </div>

      <span className="mt-1 text-xs font-medium text-emerald-700">
        {nodeData.label || "Loop"}
      </span>

      {/* Loop back source - left for TB, top for LR */}
      <Handle
        type="source"
        position={Position.Left}
        id="loop-left"
        className="w-3 h-3 !bg-emerald-500 !border-2 !border-emerald-600"
        style={{ top: "50px" }}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="loop-top"
        className="w-3 h-3 !bg-emerald-500 !border-2 !border-emerald-600"
        style={{ left: "20%" }}
      />
    </div>
  );
}

export default memo(LoopBackNode);
