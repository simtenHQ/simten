/**
 * CircuitViewer — the single "render an interactive circuit" component.
 *
 * Takes a BuiltCircuit, wires up simulation, and renders CircuitCanvas + ClockControls.
 * Pure props — no stores. Everything else (CircuitEmbed, EditorWorkspace, <circuit-embed>)
 * is a thin wrapper around this.
 */

import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle, type ForwardedRef, type ReactElement } from "react";
import { useCircuitSimulator } from "./hooks/useCircuitSimulator";
import type { BuiltCircuit } from "@simten/core/circuit";
import { CircuitCanvas, ClockControls, useDetectTheme } from "@simten/ui/canvas";
import type { CircuitLayout } from "@simten/ui/canvas";
import type { FlatPortValueMap } from "@simten/core/simulator";

/**
 * Type-level model of what `autoHarness` produces at runtime: it wraps the
 * original circuit `C` as a single `dut` node and adds one Switch per input
 * and one Led per output. The placeable nodes therefore become the input
 * names ∪ output names ∪ `'dut'`. CircuitLayout<HarnessedCircuit<C>>
 * resolves to exactly that key set.
 */
export type HarnessedCircuit<C extends BuiltCircuit> =
  C extends BuiltCircuit<infer Ins, infer Outs, any>
    ? BuiltCircuit<
        Ins,
        Outs,
        & { [K in keyof Ins]: BuiltCircuit }
        & { [K in keyof Outs]: BuiltCircuit }
        & { dut: C }
      >
    : never;

/** Strictly-keyed layout for an autoHarness-wrapped circuit. */
export type HarnessedLayout<C extends BuiltCircuit> = CircuitLayout<HarnessedCircuit<C>>;

export interface CircuitViewerProps<C extends BuiltCircuit = BuiltCircuit> {
  /** The circuit to display (result of circuit()) */
  circuit: C;
  /** Container height */
  height?: number | string;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /** Auto-wrap with Switch/Led nodes for bare circuits */
  autoHarness?: boolean;
  /** Initial values for auto-harnessed input nodes */
  initialInputs?: Record<string, number | boolean>;
  /**
   * Pre-computed node positions. Keys are constrained at compile time.
   * Accepts either the raw circuit's layout shape (when autoHarness is
   * off) or the harnessed layout shape (when autoHarness is on, with
   * keys = input names ∪ output names ∪ 'dut').
   */
  layout?: CircuitLayout<C> | HarnessedLayout<C>;
  /** Theme */
  theme?: "light" | "dark";
  /** Focus on specific node(s) */
  focus?: string | string[];
  /** Show port labels on nodes */
  showPortLabels?: boolean;
  /** Callback when a port is clicked */
  onPortClick?: (nodeLabel: string, portName: string, portType: "input" | "output") => void;
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
  setNodeValue: (nodeId: string, value: number | boolean | Map<number, number>) => void;
  /** Start the simulator's internal auto-run loop. Equivalent to clicking the
   *  in-canvas play button — the play/pause control will stop it normally. */
  startAutoRun: (ticksPerSecond: number) => void;
  /** Stop the simulator's internal auto-run loop. */
  stopAutoRun: () => void;
}

const CircuitViewerImpl = forwardRef<CircuitViewerHandle, CircuitViewerProps>(
  function CircuitViewer({
    circuit,
    height = 300,
    showControls = true,
    autoHarness = false,
    initialInputs,
    layout,
    theme,
    focus,
    showPortLabels,
    onPortClick,
    glowUnconnected,
    renderEmptyState,
    renderOverlay,
    onPortValuesChange,
  }, ref) {
    const sim = useCircuitSimulator(circuit, { autoHarness, initialInputs });
    const detectedTheme = useDetectTheme();
    const resolvedTheme = theme ?? detectedTheme;

    // Capture the callback in a ref so inline functions don't cause the
    // firing effect below to re-run on every parent render. The effect
    // depends only on [sim.ready, sim.portValues], not on the callback
    // identity, so passing `onPortValuesChange={(pv) => setX(pv)}` is
    // safe even though it creates a new function reference each render.
    const onPortValuesChangeRef = useRef(onPortValuesChange);
    useEffect(() => {
      onPortValuesChangeRef.current = onPortValuesChange;
    });

    // Fire once the sim is ready and port values have first settled; then
    // fire on every subsequent settled change. The empty-map guard avoids
    // a spurious fire during the initial compile-but-not-yet-propagated
    // window. The hook only exposes settled states, so no debouncing is
    // needed for intermediate propagation steps.
    useEffect(() => {
      if (!sim.ready || !sim.portValues || sim.portValues.size === 0) return;
      onPortValuesChangeRef.current?.(sim.portValues);
    }, [sim.ready, sim.portValues]);

    const handleTick = useCallback(() => {
      sim.tick();
    }, [sim.tick]);

    const handleReset = useCallback(() => {
      sim.reset();
    }, [sim.reset]);

    useImperativeHandle(ref, () => ({
      tick: handleTick,
      reset: handleReset,
      setNodeValue: sim.setNodeValue,
      startAutoRun: sim.startAutoRun,
      stopAutoRun: sim.stopAutoRun,
    }), [handleTick, handleReset, sim.setNodeValue, sim.startAutoRun, sim.stopAutoRun]);

    if (sim.error) {
      return (
        <div style={{ height }} className="flex items-center justify-center p-4">
          <div className="text-sm text-red-400 bg-red-500/10 rounded p-3 border border-red-500/20">
            <div className="font-medium mb-1">Compilation Error</div>
            <div className="font-mono text-xs">{sim.error}</div>
          </div>
        </div>
      );
    }

    if (!sim.ready) {
      return (
        <div style={{ height }} className="flex items-center justify-center text-muted-foreground/60 text-sm">
          Compiling...
        </div>
      );
    }

    const controlHeight = sim.isSequential && showControls ? 40 : 0;
    const canvasHeight = typeof height === "number" ? height - controlHeight : height;

    return (
      <div style={{ height }} className="flex flex-col" data-embed-theme={resolvedTheme}>
        <div className="flex-1 min-h-0">
          <CircuitCanvas
            circuit={sim.circuit}
            componentLibrary={sim.componentLibrary ?? undefined}
            portValues={sim.portValues}
            sequentialState={sim.sequentialState}
            onToggleNode={sim.toggleNode}
            onSetNodeValue={sim.setNodeValue}
            onLoadMemory={(nodeId, memData) => {
              const engine = sim.getSimulator();
              if (engine) {
                engine.setNode(nodeId, memData);
                sim.runCombinational();
              }
            }}
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
        {sim.isSequential && showControls && (
          <ClockControls
            cycle={sim.cycleCount}
            historyLength={sim.history?.length ?? 0}
            historyIndex={sim.historyIndex ?? -1}
            isRunning={sim.isRunning}
            isViewingPast={sim.isViewingPast ?? false}
            onStep={handleTick}
            onRun={() => sim.startAutoRun(5)}
            onPause={() => sim.stopAutoRun()}
            onReset={handleReset}
            onStepBack={() => sim.stepBack()}
            onStepForward={() => {
              if (sim.isViewingPast) {
                sim.stepForward();
              } else {
                handleTick();
              }
            }}
            speed={5}
          />
        )}
      </div>
    );
  }
);

/**
 * CircuitViewer with generic inference over the circuit type.
 * Cast preserves the generic so `layout` keys are constrained at compile time.
 */
export const CircuitViewer = CircuitViewerImpl as <C extends BuiltCircuit>(
  props: CircuitViewerProps<C> & { ref?: ForwardedRef<CircuitViewerHandle> },
) => ReactElement;
