/**
 * @simten/react/embed
 *
 * A circuit on a page, ready to use: `CircuitEmbed` (a card with a canvas,
 * clock controls and Fork), `CircuitViewer` (the same without the card) and
 * `SimulationView` (the canvas and controls for a `useSimulation` result,
 * for source text such as the embed page's).
 */

export type { FlatPortValueMap } from '@simten/core/internal';
export type { CircuitEmbedHandle, CircuitEmbedProps } from './CircuitEmbed';
export { CircuitEmbed } from './CircuitEmbed';
export type {
  CircuitViewerHandle,
  CircuitViewerProps,
  SimulationViewProps,
} from './CircuitViewer';
export { CircuitViewer, SimulationView } from './CircuitViewer';
export { ErrorBoundary } from './ErrorBoundary';
export type { SimulatorError } from './ErrorDisplay';
export { ErrorDisplay } from './ErrorDisplay';
export { type ShareCircuitFn, ShareCircuitProvider, useShareCircuit } from './share-context';
