/**
 * CircuitViewer — the single "render an interactive circuit" component.
 *
 * Takes a BuiltCircuit, wires up simulation, and renders CircuitCanvas + ClockControls.
 * Pure props — no stores. Everything else (CircuitEmbed, EditorWorkspace, <circuit-embed>)
 * is a thin wrapper around this.
 */

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useCircuitSimulator } from "./hooks/useCircuitSimulator";
import type { BuiltCircuit } from "@simten/core/circuit";
import { CircuitCanvas, ClockControls } from "@simten/ui/canvas";

/** Detect theme from <html> class, reactive via MutationObserver. */
function useDetectTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" ? (document.documentElement.classList.contains("dark") ? "dark" : "light") : "dark"
  );
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(el.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export interface CircuitViewerProps {
  /** The circuit to display (result of circuit()) */
  circuit: BuiltCircuit;
  /** Container height */
  height?: number | string;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /** Auto-wrap with Switch/Led nodes for bare circuits */
  autoHarness?: boolean;
  /** Initial values for auto-harnessed input nodes */
  initialInputs?: Record<string, number | boolean>;
  /** Fixed node positions (disables auto-layout) */
  nodePositions?: Record<string, { x: number; y: number }>;
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
}

export interface CircuitViewerHandle {
  tick: () => void;
  reset: () => void;
  setNodeValue: (nodeId: string, value: number | boolean | Map<number, number>) => void;
}

export const CircuitViewer = forwardRef<CircuitViewerHandle, CircuitViewerProps>(
  function CircuitViewer({
    circuit,
    height = 300,
    showControls = true,
    autoHarness = false,
    initialInputs,
    nodePositions,
    theme,
    focus,
    showPortLabels,
    onPortClick,
    glowUnconnected,
    autoRunSpeed = 500,
    renderEmptyState,
    renderOverlay,
  }, ref) {
    const sim = useCircuitSimulator(circuit, { autoHarness, initialInputs });
    const detectedTheme = useDetectTheme();
    const resolvedTheme = theme ?? detectedTheme;
    const [tickCount, setTickCount] = useState(0);

    const handleTick = useCallback(() => {
      sim.tick();
      setTickCount(c => c + 1);
    }, [sim.tick]);

    const handleReset = useCallback(() => {
      sim.reset();
      setTickCount(0);
    }, [sim.reset]);

    useImperativeHandle(ref, () => ({
      tick: handleTick,
      reset: handleReset,
      setNodeValue: sim.setNodeValue,
    }), [handleTick, handleReset, sim.setNodeValue]);

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
            {...(nodePositions ? { nodePositions, autoLayout: false } : {})}
            {...(theme ? { theme } : {})}
          />
        </div>
        {sim.isSequential && showControls && (
          <ClockControls
            cycle={tickCount}
            historyLength={sim.history?.length ?? 0}
            historyIndex={sim.historyIndex ?? -1}
            isRunning={sim.isRunning}
            isViewingPast={sim.isViewingPast ?? false}
            onStep={handleTick}
            onRun={() => sim.startAutoRun(5)}
            onPause={() => sim.stopAutoRun()}
            onReset={handleReset}
            onStepBack={() => { sim.stepBack(); setTickCount(Math.max(0, tickCount - 1)); }}
            onStepForward={() => {
              if (sim.isViewingPast) {
                sim.stepForward();
                setTickCount(c => c + 1);
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
