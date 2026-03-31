/**
 * Canonical node components for circuit rendering.
 *
 * Props-driven, store-free, theme-aware via CSS custom properties.
 * Single source of truth — used by embed, editor, and blog.
 */

// Base
export { BaseNode } from './BaseNode';
export type { PortConfig, BaseNodeProps } from './BaseNode';
export { CompositeBadge } from './CompositeBadge';
export type { NodeData } from './NodeData';

// Input nodes
export { InputNode } from './InputNode';
export { NumericInputNode } from './NumericInputNode';
export { EthFrameInputNode } from './EthFrameInputNode';

// Output / display nodes
export { OutputNode } from './OutputNode';
export { ScreenNode } from './ScreenNode';
export { RasterDisplayNode } from './RasterDisplayNode';
export { ConsoleNode } from './ConsoleNode';
export { UartTxNode } from './UartTxNode';

// Lightweight embed variants (legacy aliases)
export { EmbedConsoleNode } from './EmbedConsoleNode';
export { EmbedScreenNode } from './EmbedScreenNode';

// Logic / structural
export { LogicGateNode } from './LogicGateNode';
export { RegisterNode } from './RegisterNode';
export { RAMNode } from './RAMNode';
export { ROMNode } from './ROMNode';
export { NicFifoNode } from './NicFifoNode';
export { RV32IInstrMemNode } from './RV32IInstrMemNode';
