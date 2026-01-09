// Color palette for subprocess visual identification
// Each color has bg (background), border, text, and hover variants

export interface ProcessColor {
  bg: string;
  bgLight: string;
  border: string;
  text: string;
  hover: string;
  ring: string;
}

export const PROCESS_COLORS: ProcessColor[] = [
  {
    // Blue - Main process
    bg: "bg-blue-500",
    bgLight: "bg-blue-50",
    border: "border-blue-500",
    text: "text-blue-700",
    hover: "hover:bg-blue-100",
    ring: "ring-blue-500",
  },
  {
    // Green
    bg: "bg-green-500",
    bgLight: "bg-green-50",
    border: "border-green-500",
    text: "text-green-700",
    hover: "hover:bg-green-100",
    ring: "ring-green-500",
  },
  {
    // Purple
    bg: "bg-purple-500",
    bgLight: "bg-purple-50",
    border: "border-purple-500",
    text: "text-purple-700",
    hover: "hover:bg-purple-100",
    ring: "ring-purple-500",
  },
  {
    // Orange
    bg: "bg-orange-500",
    bgLight: "bg-orange-50",
    border: "border-orange-500",
    text: "text-orange-700",
    hover: "hover:bg-orange-100",
    ring: "ring-orange-500",
  },
  {
    // Teal
    bg: "bg-teal-500",
    bgLight: "bg-teal-50",
    border: "border-teal-500",
    text: "text-teal-700",
    hover: "hover:bg-teal-100",
    ring: "ring-teal-500",
  },
  {
    // Pink
    bg: "bg-pink-500",
    bgLight: "bg-pink-50",
    border: "border-pink-500",
    text: "text-pink-700",
    hover: "hover:bg-pink-100",
    ring: "ring-pink-500",
  },
  {
    // Indigo
    bg: "bg-indigo-500",
    bgLight: "bg-indigo-50",
    border: "border-indigo-500",
    text: "text-indigo-700",
    hover: "hover:bg-indigo-100",
    ring: "ring-indigo-500",
  },
  {
    // Amber
    bg: "bg-amber-500",
    bgLight: "bg-amber-50",
    border: "border-amber-500",
    text: "text-amber-700",
    hover: "hover:bg-amber-100",
    ring: "ring-amber-500",
  },
];

export function getProcessColor(colorIndex: number | undefined): ProcessColor {
  const index = (colorIndex ?? 0) % PROCESS_COLORS.length;
  return PROCESS_COLORS[index];
}

// Hex colors for React Flow styling
export const PROCESS_COLORS_HEX = [
  { main: "#3B82F6", light: "#EFF6FF", border: "#3B82F6" }, // blue
  { main: "#22C55E", light: "#F0FDF4", border: "#22C55E" }, // green
  { main: "#A855F7", light: "#FAF5FF", border: "#A855F7" }, // purple
  { main: "#F97316", light: "#FFF7ED", border: "#F97316" }, // orange
  { main: "#14B8A6", light: "#F0FDFA", border: "#14B8A6" }, // teal
  { main: "#EC4899", light: "#FDF2F8", border: "#EC4899" }, // pink
  { main: "#6366F1", light: "#EEF2FF", border: "#6366F1" }, // indigo
  { main: "#F59E0B", light: "#FFFBEB", border: "#F59E0B" }, // amber
];

export function getProcessColorHex(colorIndex: number | undefined) {
  const index = (colorIndex ?? 0) % PROCESS_COLORS_HEX.length;
  return PROCESS_COLORS_HEX[index];
}

// Node type colors
export const NODE_TYPE_COLORS = {
  start: { bg: "#22C55E", border: "#16A34A", text: "#FFFFFF" },
  end: {
    success: { bg: "#22C55E", border: "#16A34A", text: "#FFFFFF" },
    failure: { bg: "#EF4444", border: "#DC2626", text: "#FFFFFF" },
    cancelled: { bg: "#6B7280", border: "#4B5563", text: "#FFFFFF" },
    exception: { bg: "#F97316", border: "#EA580C", text: "#FFFFFF" },
  },
  action: { bg: "#FFFFFF", border: "#D1D5DB", text: "#374151" },
  decision: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" },
  switch: { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" },
  merge: { bg: "#E0E7FF", border: "#6366F1", text: "#3730A3" },
  subprocess: { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8" },
  loop_back: { bg: "#ECFDF5", border: "#10B981", text: "#065F46" },
};

// Edge type styles
export const EDGE_TYPE_STYLES: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  normal: { stroke: "#9CA3AF", strokeWidth: 2 },
  exception: { stroke: "#EF4444", strokeWidth: 2, strokeDasharray: "5,5" },
  timeout: { stroke: "#F97316", strokeWidth: 2, strokeDasharray: "3,3" },
  loop: { stroke: "#10B981", strokeWidth: 2, strokeDasharray: "8,4" },
};
