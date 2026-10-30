import type { EdgeTypes, NodeTypes } from '@xyflow/react';

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
import { WireEdge } from './WireEdge';

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
};

/** Wires, coloured by their value. */
export const EDGE_TYPES: EdgeTypes = {
  wire: WireEdge,
};
