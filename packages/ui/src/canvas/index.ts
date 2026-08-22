/**
 * @simten/ui/canvas
 *
 * Unified circuit canvas — props-driven, store-free.
 * Used by both the embed package and the editor.
 */

export type { CircuitCanvasProps } from './CircuitCanvas';
export { CircuitCanvas } from './CircuitCanvas';
export type { ClockControlsProps } from './ClockControls';
export { ClockControls, DEFAULT_SPEED, MAX_SPEED } from './ClockControls';
export type { CompositeInspectorDialogProps } from './CompositeInspectorDialog';
export { CompositeInspectorDialog } from './CompositeInspectorDialog';
export { computeDagreLayout } from './dagre-layout';
export { createDrillDownViewCircuit, scopePortValues } from './drill-down-view';
export { useDetectTheme } from './hooks/useDetectTheme';
export type { UseSimulationSessionResult } from './hooks/useSimulationSession';
export { useSimulationSession } from './hooks/useSimulationSession';
export { EDGE_TYPES, NODE_TYPES } from './node-types';
export { projectCircuitToReactFlow } from './projection';
export type { CircuitLayout, InspectorFrame, MetadataState, OriginRect } from './types';
export { useLayout } from './useLayout';
