export { CircuitEmbed } from "./CircuitEmbed";
export type { CircuitEmbedProps, CircuitEmbedHandle, CheckSpec, CheckResult } from "./CircuitEmbed";
export { useCircuitSimulator } from "./useCircuitSimulator";
export type { SimulatorState, SimulatorActions, UseCircuitSimulatorOptions } from "./useCircuitSimulator";

// Re-export CircuitCanvas from shared (replaces EmbedCanvas)
export { CircuitCanvas } from "../shared/CircuitCanvas";
export type { CircuitCanvasProps } from "../shared/CircuitCanvas";

/** @deprecated Use CircuitCanvas instead */
export { CircuitCanvas as EmbedCanvas } from "../shared/CircuitCanvas";
