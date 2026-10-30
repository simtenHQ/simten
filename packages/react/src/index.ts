/**
 * @simten/react: data, input and output for Simten circuits in React.
 *
 *   import { CircuitCanvas, ClockControls, useSimulation } from '@simten/react';
 *   import '@simten/react/styles.css';
 *
 *   function Demo() {
 *     const sim = useSimulation(HalfAdder);
 *     return (
 *       <>
 *         <CircuitCanvas simulation={sim} height={300} />
 *         <ClockControls simulation={sim} />
 *       </>
 *     );
 *   }
 *
 * `useSimulation` compiles and runs a circuit in the sandbox and returns
 * `{ state, actions }`. `CircuitCanvas` and `ClockControls` each take that
 * simulation. Circuits on a page share one sandbox unless a
 * `SandboxProvider` says otherwise. The code editor is `@simten/react/code-editor`.
 */

export { CircuitCanvas, type CircuitCanvasProps } from './canvas/CircuitCanvas';
export { ClockControls, type ClockControlsProps } from './canvas/ClockControls';
export {
  SandboxProvider,
  type SandboxProviderProps,
  useSandboxClient,
} from './sandbox/SandboxProvider';
export {
  type CompileDiagnostic,
  type SimulationActions,
  type SimulationSource,
  type SimulationState,
  type SourceText,
  type UseSimulationOptions,
  type UseSimulationResult,
  useSimulation,
} from './sandbox/useSimulation';
