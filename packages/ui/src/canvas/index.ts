/**
 * @turing-incomplete/ui/canvas
 *
 * Unified circuit canvas — props-driven, store-free.
 * Used by both the embed package and the editor.
 */
export { CircuitCanvas } from "./CircuitCanvas";
export type { CircuitCanvasProps } from "./CircuitCanvas";
export { NODE_TYPES, EDGE_TYPES } from "./node-types";
export { projectCircuitToReactFlow } from "./projection";
export { useElkLayout } from "./useElkLayout";
export { createDrillDownViewCircuit, scopePortValues } from "./drill-down-view";
export { CompositeInspectorDialog } from "./CompositeInspectorDialog";
export type { CompositeInspectorDialogProps } from "./CompositeInspectorDialog";
export type { MetadataState, InspectorFrame, OriginRect } from "./types";
export { useSimulationSession } from "./hooks/useSimulationSession";
export { useCircuitSession } from "./hooks/useCircuitSession";
export type { UseSimulationSessionResult } from "./hooks/useSimulationSession";
export { ClockControls } from "./ClockControls";
export type { ClockControlsProps } from "./ClockControls";
