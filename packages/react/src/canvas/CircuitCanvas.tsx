/**
 * CircuitCanvas: draws a running circuit.
 *
 *   const sim = useSimulation(HalfAdder);
 *   <CircuitCanvas simulation={sim} />
 *
 * It shows its own loading and error states. A circuit with ports is drawn
 * with a switch or number input on each input port and a lamp or display on
 * each output, around the circuit as one box (`ports-view.ts`). Clicking a
 * switch, or typing into a number input, calls the simulation's actions.
 * Double-clicking a composite opens its insides as a live view of the same
 * simulation, with breadcrumbs. Everything else here is how it looks.
 */

import { type ReactElement, useCallback, useMemo } from 'react';
import type { UseSimulationResult } from '../sandbox/useSimulation';
import { CanvasError } from './CanvasError';
import { FlowCanvas } from './FlowCanvas';
import { hasPorts, portsView, portsViewValues, withPortParts } from './ports-view';

export interface CircuitCanvasProps {
  /** What `useSimulation` returned. */
  simulation: UseSimulationResult;
  /** @default '100%' */
  height?: number | string;
  /** Defaults to the page's (`html.dark`). */
  theme?: 'light' | 'dark';
  /**
   * Node positions by label (or id), to skip the layout engine. A circuit with
   * ports is drawn with its ports' switches and lamps named after the ports,
   * and the circuit itself as the node `dut`.
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
  const { circuit, definitions, portValues } = state;
  // What's drawn: the circuit with its ports around it, read in the same terms.
  const drawn = useMemo(
    () => (circuit && hasPorts(circuit) ? portsView(circuit) : circuit),
    [circuit],
  );
  const drawnValues = useMemo(
    () =>
      circuit && portValues && hasPorts(circuit)
        ? portsViewValues(circuit, portValues)
        : portValues,
    [circuit, portValues],
  );
  const drawnDefinitions = useMemo(
    () => (definitions ? withPortParts(definitions) : undefined),
    [definitions],
  );
  // The drill-down reads the drawing's values too, so `dut` opens on its insides.
  const viewed = useMemo(
    () => ({ ...simulation, state: { ...state, portValues: drawnValues } }),
    [simulation, state, drawnValues],
  );
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
        <CanvasError error={error} />
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
      circuit={drawn}
      definitions={drawnDefinitions}
      portValues={drawnValues}
      peripheralState={state.peripheralState}
      simulation={viewed}
      // Top-level node ids are the keys `set` takes: a port's switch is named
      // after the port, and a circuit without ports is drawn as it is.
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
