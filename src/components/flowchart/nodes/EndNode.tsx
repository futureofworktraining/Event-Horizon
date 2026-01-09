import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Square, XCircle, AlertTriangle, Ban } from "lucide-react";

export interface EndNodeData {
  label?: string;
  endType?: "success" | "failure" | "cancelled" | "exception";
}

const endTypeConfig = {
  success: {
    bg: "bg-green-500",
    border: "border-green-600",
    icon: Square,
    label: "End",
  },
  failure: {
    bg: "bg-red-500",
    border: "border-red-600",
    icon: XCircle,
    label: "Failure",
  },
  cancelled: {
    bg: "bg-gray-500",
    border: "border-gray-600",
    icon: Ban,
    label: "Cancelled",
  },
  exception: {
    bg: "bg-orange-500",
    border: "border-orange-600",
    icon: AlertTriangle,
    label: "Exception",
  },
};

function EndNode({ data }: NodeProps) {
  const nodeData = data as EndNodeData;
  const endType = nodeData.endType || "success";
  const config = endTypeConfig[endType];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center relative">
      {/* Top handle for TB layout */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`w-3 h-3 !${config.bg} !border-2 !${config.border}`}
      />
      {/* Left handle for LR layout */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={`w-3 h-3 !${config.bg} !border-2 !${config.border}`}
        style={{ top: "32px" }}
      />
      <div
        className={`w-16 h-16 rounded-full ${config.bg} border-2 ${config.border}
                   flex items-center justify-center shadow-md
                   hover:shadow-lg transition-shadow`}
      >
        <Icon className="w-8 h-8 text-white" />
      </div>
      <span className="mt-2 text-sm font-medium text-gray-700">
        {nodeData.label || config.label}
      </span>
    </div>
  );
}

export default memo(EndNode);
