import { SmoothStepEdge, type NodeTypes, type EdgeTypes } from '@xyflow/react';

import {
  InputNode,
  NumericInputNode,
  OutputNode,
  LogicGateNode,
  ConsoleNode,
  ScreenNode,
  RasterDisplayNode,
  RegisterNode,
  RAMNode,
  ROMNode,
  UartTxNode,
  NicFifoNode,
  RV32IInstrMemNode,
  EthFrameInputNode,
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
