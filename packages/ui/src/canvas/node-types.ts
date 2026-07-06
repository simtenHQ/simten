import { type EdgeTypes, type NodeTypes, SmoothStepEdge } from '@xyflow/react';

import {
  ConsoleNode,
  EthFrameInputNode,
  InputNode,
  LogicGateNode,
  NicFifoNode,
  NumericInputNode,
  OutputNode,
  RAMNode,
  RasterDisplayNode,
  RegisterNode,
  ROMNode,
  RV32IInstrMemNode,
  ScreenNode,
  UartTxNode,
} from '../nodes';

/**
 * Default node type map — all rich components, no fallbacks.
 */
export const NODE_TYPES: NodeTypes = {
  inputNode: InputNode,
  numericInputNode: NumericInputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  registerNode: RegisterNode,
  ramNode: RAMNode,
  romNode: ROMNode,
  rv32iInstrMemNode: RV32IInstrMemNode,
  ethFrameInputNode: EthFrameInputNode,
  consoleNode: ConsoleNode,
  uartTxNode: UartTxNode,
  nicFifoNode: NicFifoNode,
  screenNode: ScreenNode,
  rasterDisplayNode: RasterDisplayNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/**
 * Edge type map.
 */
export const EDGE_TYPES: EdgeTypes = {
  orthogonal: SmoothStepEdge,
};
