import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";

export interface StartNodeData {
  label?: string;
}

function StartNode({ data }: NodeProps) {
  const nodeData = data as StartNodeData;

  return (
    <div className="flex flex-col items-center relative">
      <div
        className="w-16 h-16 rounded-full bg-green-500 border-2 border-green-600
                   flex items-center justify-center shadow-md
                   hover:shadow-lg transition-shadow"
      >
        <Play className="w-8 h-8 text-white" />
      </div>
      <span className="mt-2 text-sm font-medium text-gray-700">
        {nodeData.label || "Start"}
      </span>
      {/* Bottom handle for TB layout */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-600"
      />
      {/* Right handle for LR layout */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-green-500 !border-2 !border-green-600"
        style={{ top: "32px" }}
      />
    </div>
  );
}

export default memo(StartNode);
