/**
 * Canonical node components for circuit rendering.
 *
 * Props-driven, store-free, theme-aware via CSS custom properties.
 * Single source of truth — used by embed, editor, and blog.
 */

export type { BaseNodeProps, PortConfig } from './BaseNode';
// Base
export { BaseNode } from './BaseNode';
export { CompositeBadge } from './CompositeBadge';
export { ConsoleNode } from './ConsoleNode';
// Lightweight embed variants (legacy aliases)
export { EmbedConsoleNode } from './EmbedConsoleNode';
export { EmbedScreenNode } from './EmbedScreenNode';
export { EthFrameInputNode } from './EthFrameInputNode';
// Input nodes
export { InputNode } from './InputNode';
// Logic / structural
export { LogicGateNode } from './LogicGateNode';
export { NicFifoNode } from './NicFifoNode';
export type { NodeData } from './NodeData';
export { NumericInputNode } from './NumericInputNode';
// Output / display nodes
export { OutputNode } from './OutputNode';
export { RAMNode } from './RAMNode';
export { RasterDisplayNode } from './RasterDisplayNode';
export { RegisterNode } from './RegisterNode';
export { ROMNode } from './ROMNode';
export { RV32IInstrMemNode } from './RV32IInstrMemNode';
export { ScreenNode } from './ScreenNode';
export { UartTxNode } from './UartTxNode';
