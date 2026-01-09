import StartNode from "./StartNode";
import EndNode from "./EndNode";
import ActionNode from "./ActionNode";
import DecisionNode from "./DecisionNode";
import SwitchNode from "./SwitchNode";
import MergeNode from "./MergeNode";
import SubprocessNode from "./SubprocessNode";
import LoopBackNode from "./LoopBackNode";

export {
  StartNode,
  EndNode,
  ActionNode,
  DecisionNode,
  SwitchNode,
  MergeNode,
  SubprocessNode,
  LoopBackNode,
};

// Node types registry for React Flow
export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  decision: DecisionNode,
  switch: SwitchNode,
  merge: MergeNode,
  subprocess: SubprocessNode,
  loop_back: LoopBackNode,
};

// Re-export data types
export type { StartNodeData } from "./StartNode";
export type { EndNodeData } from "./EndNode";
export type { ActionNodeData } from "./ActionNode";
export type { DecisionNodeData } from "./DecisionNode";
export type { SwitchNodeData } from "./SwitchNode";
export type { MergeNodeData } from "./MergeNode";
export type { SubprocessNodeData } from "./SubprocessNode";
export type { LoopBackNodeData } from "./LoopBackNode";
