/**
 * CircuitCanvas: draws a running circuit.
 *
 *   const sim = useSimulation(HalfAdder);
 *   <CircuitCanvas simulation={sim} />
 *
 * It shows its own loading and error states. Clicking a switch, or typing into
 * a number input, calls the simulation's actions. Double-clicking a composite
 * opens its insides as a live view of the same simulation, with breadcrumbs.
 * Everything else here is how it looks.
 */

import { type ReactElement, useCallback } from 'react';
import type { UseSimulationResult } from '../sandbox/useSimulation';
import { ErrorDisplay } from './ErrorDisplay';
import { FlowCanvas } from './FlowCanvas';

export interface CircuitCanvasProps {
  /** What `useSimulation` returned. */
  simulation: UseSimulationResult;
  /** @default '100%' */
  height?: number | string;
  /** Defaults to the page's (`html.dark`). */
  theme?: 'light' | 'dark';
  /**
   * Node positions by label (or id), to skip the layout engine. A circuit with
   * ports is drawn inside a harness: its ports' switches and lamps are named
   * after the ports, and the circuit itself is the node `dut`.
   */
  layout?: Record<string, { x: number; y: number }>;
  /** Dim every node but these, by label. */
  focus?: string | string[];
  /** Let people drag nodes. @default true */
  draggable?: boolean;
  /**
   * Lay the circuit out again on every change, instead of only when nodes are
   * added or removed, so a new wire between existing nodes gets a fresh layout.
   * @default false
   */
  autoLayout?: boolean;
  /**
   * Called when someone loads a program onto an instruction memory or ROM on
   * the canvas (an empty map to clear it), with the node's path. Loading a
   * program starts a new run: pass the contents in `useSimulation`'s `memory`.
   */
  onLoadMemory?: (path: string, contents: Map<number, number>) => void;
}

export function CircuitCanvas({
  simulation,
  height = '100%',
  theme,
  layout,
  focus,
  draggable,
  autoLayout,
  onLoadMemory,
}: CircuitCanvasProps): ReactElement {
  const { state, actions } = simulation;
  // Stable, so the canvas doesn't redraw every node on each render.
  const toggle = useCallback((path: string) => void actions.toggle(path), [actions]);
  const setValue = useCallback(
    (path: string, value: number) => void actions.set({ [path]: value }),
    [actions],
  );

  // A compile error only matters while there's nothing to show: once a
  // circuit is running, the last good one stays up.
  const error = state.error ?? (state.ready ? null : (state.compileError?.message ?? null));
  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center p-4">
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!state.ready) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-muted-foreground/60 text-sm"
      >
        Compiling...
      </div>
    );
  }

  return (
    <FlowCanvas
      circuit={state.circuit}
      definitions={state.definitions ?? undefined}
      portValues={state.portValues}
      peripheralState={state.peripheralState}
      simulation={simulation}
      // Node ids on the canvas are the keys `set` takes: a port's switch is
      // named after the port, and a circuit without ports isn't wrapped.
      onToggleNode={toggle}
      onSetNodeValue={setValue}
      onLoadMemory={onLoadMemory}
      height={height}
      theme={theme}
      layout={layout}
      focus={focus}
      draggable={draggable}
      autoLayout={autoLayout}
    />
  );
}
