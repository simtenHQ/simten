/**
 * CircuitViewer — the single "render an interactive circuit" component.
 *
 * Takes a Circuit, simulates it in the sandbox (`useSimulation`), and renders
 * CircuitCanvas + ClockControls. Pure props, no stores. CircuitEmbed wraps it;
 * `<circuit-embed>` simulates its source text and renders `SimulationView`.
 */

import type { Circuit } from '@simten/core/circuit';
import type { FlatPortValueMap } from '@simten/core/internal';
import type { CircuitLayout } from '@simten/ui/canvas';
import { CircuitCanvas, ClockControls, useDetectTheme } from '@simten/ui/canvas';
import { type UseSimulationResult, useSimulation } from '@simten/ui/sandbox';
import { type ReactElement, type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { ErrorDisplay } from './components/ErrorDisplay';

/**
 * Type-level model of what `autoHarness` produces at runtime: it wraps the
 * original circuit `C` as a single `dut` node and adds one Switch per input
 * and one Led per output. The placeable nodes therefore become the input
 * names ∪ output names ∪ `'dut'`. CircuitLayout<HarnessedCircuit<C>>
 * resolves to exactly that key set.
 */
type HarnessedCircuit<C extends Circuit> =
  C extends Circuit<infer Ins, infer Outs, Record<string, unknown>>
    ? Circuit<
        Ins,
        Outs,
        { [K in keyof Ins]: Circuit } & { [K in keyof Outs]: Circuit } & { dut: C }
      >
    : never;

/** Strictly-keyed layout for an autoHarness-wrapped circuit. */
export type HarnessedLayout<C extends Circuit> = CircuitLayout<HarnessedCircuit<C>>;

export interface CircuitViewerProps<C extends Circuit = Circuit> {
  /** The circuit to display (result of circuit()) */
  circuit: C;
  /** Container height */
  height?: number | string;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /** Auto-wrap with Switch/Led nodes for bare circuits */
  autoHarness?: boolean;
  /** Initial values for auto-harnessed input nodes */
  initialInputs?: Record<string, number>;
  /**
   * Pre-computed node positions. Keys are constrained at compile time.
   * Accepts either the raw circuit's layout shape (when autoHarness is
   * off) or the harnessed layout shape (when autoHarness is on, with
   * keys = input names ∪ output names ∪ 'dut').
   */
  layout?: CircuitLayout<C> | HarnessedLayout<C>;
  /** Theme */
  theme?: 'light' | 'dark';
  /** Focus on specific node(s) */
  focus?: string | string[];
  /** Show port labels on nodes. @default true */
  showPortLabels?: boolean;
  /** Callback when a port is clicked */
  onPortClick?: (nodeLabel: string, portName: string, portType: 'input' | 'output') => void;
  /** Highlight unconnected ports */
  glowUnconnected?: boolean;
  /** Auto-run speed (ms between ticks) */
  autoRunSpeed?: number;
  /** Render custom content when no circuit is compiled */
  renderEmptyState?: () => React.ReactNode;
  /** Render custom overlay on top of the canvas */
  renderOverlay?: () => React.ReactNode;
  /**
   * Called when the simulator's port values settle. Fires once on first
   * settled state (after the circuit compiles and propagates) and on every
   * subsequent settled change (e.g. when the user toggles a switch). Use
   * this to drive sibling UI that needs to react to live simulator state
   * — a truth-table highlight, an external value readout, etc.
   *
   * Firing semantics:
   *   - Does NOT fire before `ready` or while `portValues` is empty.
   *   - Fires only on settled (post-propagation) states; the simulator
   *     never exposes intermediate propagation states.
   *   - The map reference is NOT guaranteed stable across no-op ticks
   *     (sequential auto-run loops can produce new Map instances with
   *     unchanged contents). Memoize derived state if perf matters.
   *
   * The callback is captured in a ref internally so inline functions
   * (e.g. `onPortValuesChange={(pv) => setX(pv)}`) don't cause spurious
   * re-fires — pass whatever shape is convenient for the caller.
   */
  onPortValuesChange?: (portValues: FlatPortValueMap) => void;
}

export interface CircuitViewerHandle {
  tick: () => void;
  reset: () => void;
  /** Set a Switch or Input node. Other nodes are rejected: the page only flips inputs. */
  setNodeValue: (nodeId: string, value: number) => void;
  /** Start auto-run in the sandbox. Equivalent to clicking the play button;
   *  called before the circuit has opened, it starts once it does. */
  startAutoRun: (ticksPerSecond: number) => void;
  /** Stop auto-run. */
  stopAutoRun: () => void;
}

export function CircuitViewer<C extends Circuit = Circuit>({
  circuit,
  autoHarness = false,
  initialInputs,
  ...view
}: CircuitViewerProps<C> & { ref?: Ref<CircuitViewerHandle> }): ReactElement {
  const simulation = useSimulation(circuit, { harness: autoHarness, initialInputs });
  return <SimulationView simulation={simulation} {...view} />;
}

/** What `SimulationView` draws, apart from the simulation itself. */
type SimulationViewProps = Omit<CircuitViewerProps, 'circuit' | 'autoHarness' | 'initialInputs'> & {
  simulation: UseSimulationResult;
  ref?: Ref<CircuitViewerHandle>;
};

/** The canvas and clock controls for a simulation that's already running. */
export function SimulationView({
  simulation,
  height = 300,
  showControls = true,
  layout,
  theme,
  focus,
  showPortLabels,
  onPortClick,
  glowUnconnected,
  renderEmptyState,
  renderOverlay,
  onPortValuesChange,
  ref,
}: SimulationViewProps): ReactElement {
  const { compileError, state, history, actions } = simulation;
  const detectedTheme = useDetectTheme();
  const resolvedTheme = theme ?? detectedTheme;

  // Capture the callback in a ref so inline functions don't cause the
  // firing effect below to re-run on every parent render. The effect
  // depends only on [state.ready, state.portValues], not on the callback
  // identity, so passing `onPortValuesChange={(pv) => setX(pv)}` is
  // safe even though it creates a new function reference each render.
  const onPortValuesChangeRef = useRef(onPortValuesChange);
  useEffect(() => {
    onPortValuesChangeRef.current = onPortValuesChange;
  });

  // Fire once the simulation is ready and port values have first settled;
  // then on every settled change. The sandbox only reports settled states.
  useEffect(() => {
    if (!state.ready || !state.portValues || state.portValues.size === 0) return;
    onPortValuesChangeRef.current?.(state.portValues);
  }, [state.ready, state.portValues]);

  useImperativeHandle(
    ref,
    () => ({
      tick: () => void actions.tick(),
      reset: () => void actions.reset(),
      setNodeValue: (nodeId, value) => void actions.setInput(nodeId, value),
      startAutoRun: (ticksPerSecond) => void actions.run(ticksPerSecond),
      stopAutoRun: () => void actions.pause(),
    }),
    [actions],
  );

  // A compile error only matters while there's nothing to show: once a
  // circuit is running, the last good one stays up.
  const error = state.error ?? (state.ready ? null : (compileError?.message ?? null));
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

  const controlHeight = state.isSequential && showControls ? 40 : 0;
  const canvasHeight = typeof height === 'number' ? height - controlHeight : height;

  return (
    <div style={{ height }} className="flex flex-col" data-embed-theme={resolvedTheme}>
      <div className="flex-1 min-h-0">
        <CircuitCanvas
          circuit={state.circuit}
          definitions={state.definitions ?? undefined}
          portValues={state.portValues}
          peripheralState={state.peripheralState}
          simulation={simulation}
          onToggleNode={actions.toggleNode}
          onSetNodeValue={actions.setInput}
          height={canvasHeight}
          focus={focus}
          showPortLabels={showPortLabels}
          onPortClick={onPortClick}
          glowUnconnected={glowUnconnected}
          renderEmptyState={renderEmptyState}
          renderOverlay={renderOverlay}
          {...(layout ? { layout } : {})}
          {...(theme ? { theme } : {})}
        />
      </div>
      {state.isSequential && showControls && (
        <ClockControls
          cycle={state.cycle}
          historyLength={history.length}
          historyIndex={history.index}
          isRunning={state.isRunning}
          isViewingPast={history.isViewingPast}
          onStep={() => void actions.tick()}
          onRun={() => void actions.run(15)}
          onPause={() => void actions.pause()}
          onReset={() => void actions.reset()}
          onStepBack={() => void actions.stepBack()}
          onStepForward={() => {
            if (history.isViewingPast) void actions.stepForward();
            else void actions.tick();
          }}
          speed={5}
        />
      )}
    </div>
  );
}
