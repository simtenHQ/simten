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
 * simulation, with breadcrumbs (`CompositeInspectorDialog`). Everything else
 * here is how it looks.
 */

import type { PeripheralValue } from '@simten/core/internal';
import { type ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { useByValue } from '../lib/useByValue';
import type { NodeData } from '../nodes';
import type { UseSimulationResult } from '../sandbox/useSimulation';
import { CanvasError } from './CanvasError';
import { CompositeInspectorDialog } from './CompositeInspectorDialog';
import { resolveDrillTarget } from './drill-target';
import { FlowCanvas } from './FlowCanvas';
import { useDetectTheme } from './hooks/useDetectTheme';
import { hasPorts, portsView, withPortParts } from './ports-view';
import type { DrawnCircuit, InspectorFrame } from './types';
import { type CanvasActions, useValueStore } from './values';

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
   * around the circuit as one box, placed by the key `circuit`.
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
   * the canvas or in a composite opened from it (an empty map to clear it),
   * with the memory's path. Loading a program starts a new run: pass the
   * contents in `useSimulation`'s `memory`.
   */
  onLoadMemory?: (path: string, contents: Map<number, number>) => void;
}

/**
 * Consoles and UARTs the canvas doesn't draw as nodes of their own, by session
 * path: nested inside a composite, or inside the box. Kept by value, so it
 * changes only when the set of consoles does, not on every update.
 */
function useHiddenConsoles(
  peripherals: ReadonlyMap<string, PeripheralValue>,
  drawn: DrawnCircuit | null,
): readonly string[] {
  const paths: string[] = [];
  const onCanvas = new Set(drawn?.nodes.map((n) => n.id));
  for (const [path, value] of peripherals) {
    if (typeof value === 'string' && !onCanvas.has(path)) paths.push(path);
  }
  return useByValue(paths);
}

export function CircuitCanvas({
  simulation,
  height = '100%',
  theme: themeProp,
  layout,
  focus,
  draggable,
  autoLayout,
  onLoadMemory,
}: CircuitCanvasProps): ReactElement {
  const { state, actions } = simulation;
  const { circuit, definitions } = state;
  const detectedTheme = useDetectTheme();
  const theme = themeProp ?? detectedTheme;

  // What's drawn: the circuit with its ports around it.
  const drawn = useMemo(
    () => (circuit && hasPorts(circuit) ? portsView(circuit) : circuit),
    [circuit],
  );
  const drawnDefinitions = useMemo(
    () => (definitions ? withPortParts(definitions) : null),
    [definitions],
  );
  const values = useValueStore(state.portValues, state.peripheralState);
  const consoles = useHiddenConsoles(state.peripheralState, drawn);

  // One identity for the canvas's life, so an update redraws only what changed.
  const loadMemoryRef = useRef(onLoadMemory);
  loadMemoryRef.current = onLoadMemory;
  const loadMemory = useCallback(
    (path: string, contents: Map<number, number>) => loadMemoryRef.current?.(path, contents),
    [],
  );
  const canvasActions = useMemo(
    (): CanvasActions => ({
      // Node paths on the canvas are the keys `set` takes: a port's switch is
      // named after the port, and a circuit without ports is drawn as it is.
      toggle: (path) => void actions.toggle(path),
      set: (path, value) => void actions.set({ [path]: value }),
      loadMemory,
    }),
    [actions, loadMemory],
  );

  // The drill-down: a stack of frames, the composite opened and each opened inside it.
  const [stack, setStack] = useState<InspectorFrame[]>([]);
  const open = useCallback(
    (node: NodeData) => {
      const frame = drawnDefinitions && resolveDrillTarget(node, drawnDefinitions);
      if (frame) setStack([frame]);
    },
    [drawnDefinitions],
  );
  const push = useCallback((frame: InspectorFrame) => setStack((s) => [...s, frame]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const navigate = useCallback((index: number) => setStack((s) => s.slice(0, index + 1)), []);

  // Inline layouts and focus lists are new objects on every render; compare them by value.
  const stableLayout = useByValue(layout);
  const stableFocus = useByValue(focus);

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
    <>
      <FlowCanvas
        circuit={drawn}
        definitions={drawnDefinitions}
        values={values}
        actions={canvasActions}
        consoles={consoles}
        onNodeDoubleClick={open}
        height={height}
        theme={theme}
        layout={stableLayout}
        focus={stableFocus}
        draggable={draggable}
        autoLayout={autoLayout}
      />
      {stack.length > 0 && drawnDefinitions && (
        // The dialog is fixed over the page; the theme attribute gives it the canvas's styles.
        <div data-embed-theme={theme}>
          <CompositeInspectorDialog
            stack={stack}
            definitions={drawnDefinitions}
            simulation={simulation}
            values={values}
            loadMemory={loadMemory}
            theme={theme}
            onClose={close}
            onPopLevel={pop}
            onPushLevel={push}
            onNavigate={navigate}
          />
        </div>
      )}
    </>
  );
}
