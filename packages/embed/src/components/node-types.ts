import { SmoothStepEdge, type NodeTypes, type EdgeTypes } from "@xyflow/react";

import { InputNode, OutputNode, LogicGateNode, EmbedConsoleNode, EmbedScreenNode } from "@turing-incomplete/ui/nodes";

/**
 * Node type map for embed contexts.
 * Maps complex node types (RAM, ROM, Register, etc.) to LogicGateNode fallbacks.
 * Screen/Console use lightweight embed variants.
 */
export const EMBED_NODE_TYPES: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  numericInputNode: InputNode,
  registerNode: LogicGateNode,
  ramNode: LogicGateNode,
  romNode: LogicGateNode,
  rv32iInstrMemNode: LogicGateNode,
  ethFrameInputNode: LogicGateNode,
  consoleNode: EmbedConsoleNode,
  uartTxNode: EmbedConsoleNode,
  nicFifoNode: LogicGateNode,
  screenNode: EmbedScreenNode,
  rasterDisplayNode: EmbedScreenNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/**
 * Edge type map for embed contexts.
 */
export const EDGE_TYPES: EdgeTypes = {
  orthogonal: SmoothStepEdge,
};
