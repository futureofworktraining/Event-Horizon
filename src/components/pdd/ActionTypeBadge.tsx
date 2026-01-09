"use client";

interface ActionTypeBadgeProps {
  actionType: string;
  specificAction?: string;
}

const actionTypeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ui_interaction: {
    label: "UI",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  navigation: {
    label: "Nav",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  data_transfer: {
    label: "Data",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  explanation: {
    label: "Note",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  wait: {
    label: "Wait",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  validation: {
    label: "Verify",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
};

export function ActionTypeBadge({ actionType, specificAction }: ActionTypeBadgeProps) {
  const config = actionTypeConfig[actionType] || {
    label: actionType,
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}
      >
        {config.label}
      </span>
      {specificAction && (
        <span className="text-xs text-muted-foreground">
          {specificAction.replace(/_/g, " ")}
        </span>
      )}
    </div>
  );
}
