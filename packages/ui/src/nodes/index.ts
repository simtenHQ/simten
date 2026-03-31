/**
 * Canonical node components for circuit rendering.
 *
 * Props-driven, store-free, theme-aware via CSS custom properties.
 * Used by both the embed package and the editor (via @turing-incomplete/embed/nodes).
 */
export { BaseNode } from './BaseNode';
export type { PortConfig, BaseNodeProps } from './BaseNode';
export { InputNode } from './InputNode';
export { OutputNode } from './OutputNode';
export { LogicGateNode } from './LogicGateNode';
export { EmbedConsoleNode } from './EmbedConsoleNode';
export { EmbedScreenNode } from './EmbedScreenNode';
export { CompositeBadge } from './CompositeBadge';
export type { NodeData } from './NodeData';
