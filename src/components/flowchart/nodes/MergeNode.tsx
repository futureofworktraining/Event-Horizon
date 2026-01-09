import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Merge } from "lucide-react";

export interface MergeNodeData {
  label?: string;
}

function MergeNode({ data }: NodeProps) {
  const nodeData = data as MergeNodeData;

  return (
    <div className="flex flex-col items-center relative">
      {/* Multiple input handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-indigo-500 !border-2 !border-indigo-600"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-indigo-500 !border-2 !border-indigo-600"
        style={{ top: "50%" }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-3 h-3 !bg-indigo-500 !border-2 !border-indigo-600"
        style={{ top: "50%" }}
      />

      {/* Circle for merge point */}
      <div
        className="w-12 h-12 rounded-full bg-indigo-100 border-2 border-indigo-500
                   flex items-center justify-center shadow-md
                   hover:shadow-lg transition-shadow"
      >
        <Merge className="w-6 h-6 text-indigo-600" />
      </div>

      {nodeData.label && (
        <span className="mt-1 text-xs text-gray-500">{nodeData.label}</span>
      )}

      {/* Bottom source for TB layout */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-indigo-500 !border-2 !border-indigo-600"
      />
      {/* Right source for LR layout */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-indigo-500 !border-2 !border-indigo-600"
        style={{ top: "24px" }}
      />
    </div>
  );
}

export default memo(MergeNode);
