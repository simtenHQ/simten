"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { useCircuitSimulator, type UseCircuitSimulatorOptions } from "./hooks/useCircuitSimulator";
import { CircuitCanvas } from "@turing-incomplete/ui/canvas";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { generateHarnessAppended } from "@turing-incomplete/core/dsl";
import type { FlatPortValueMap, FlatSequentialState } from "@turing-incomplete/core/simulator";

export interface CircuitEmbedProps {
  dsl: string;
  initialMemory?: Map<string, Map<number, number>>;
  height?: number | string;
  showControls?: boolean;
  showCode?: boolean;
  displayDsl?: string;
  autoRunSpeed?: number;
  title?: string;
  description?: string;
  focus?: string | string[];
  nodePositions?: Record<string, { x: number; y: number }>;
  showPortLabels?: boolean;
  onPortClick?: (nodeLabel: string, portName: string, portType: 'input' | 'output') => void;
  glowUnconnected?: boolean;
  autoHarness?: boolean;
  /** Theme for the embed. Defaults to "dark". The embed owns its own theme, independent of the host page. */
  theme?: "light" | "dark";
}

export interface CheckSpec {
  description?: string;
  node: string;
  port: string;
  expected: number;
  inputs?: [string, number][];
  ticks?: number;
}

export interface CheckResult {
  passed: boolean;
  actual: number | boolean | undefined;
  description?: string;
  expected: number;
}

export interface CircuitEmbedHandle {
  runChecks(checks: CheckSpec[]): CheckResult[];
}

export const CircuitEmbed = forwardRef<CircuitEmbedHandle, CircuitEmbedProps>(function CircuitEmbed({
  dsl,
  initialMemory,
  height = 300,
  showControls = true,
  showCode = false,
  displayDsl,
  autoRunSpeed = 500,
  title,
  description,
  focus,
  nodePositions,
  showPortLabels,
  onPortClick,
  glowUnconnected,
  autoHarness = false,
  theme,
}, ref) {
  const options: UseCircuitSimulatorOptions | undefined = initialMemory
    ? { initialMemory }
    : undefined;

  const effectiveDsl = useMemo(
    () => autoHarness ? generateHarnessAppended(dsl) : dsl,
    [dsl, autoHarness],
  );

  // Reactively detect page theme from <html> class when no explicit theme is given
  const [detectedTheme, setDetectedTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light"
  );
  useEffect(() => {
    if (theme) return; // explicit prop — no need to observe
    const el = document.documentElement;
    const sync = () => setDetectedTheme(el.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [theme]);
  const resolvedTheme = theme ?? detectedTheme;

  const sim = useCircuitSimulator(effectiveDsl, options);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [codeVisible, setCodeVisible] = useState(showCode);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAutoRunning && sim.ready && sim.isSequential) {
      intervalRef.current = setInterval(() => { tickWithHistory(); }, autoRunSpeed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoRunning, sim.ready, sim.isSequential, autoRunSpeed, tickWithHistory]);

  // Imperative handle for behavioral checks
  useImperativeHandle(ref, () => ({
    runChecks(checks: CheckSpec[]): CheckResult[] {
      // Access simulator internals for checks — not exposed in public API
      const simAny = sim as unknown as { getSimulator?: () => SimulatorEngineInternal | null };
      const simulator = simAny.getSimulator?.();
      if (!simulator) return checks.map(c => ({ passed: false, actual: undefined, description: c.description, expected: c.expected }));

      const results: CheckResult[] = [];
      for (const check of checks) {
        simulator.reset();

        if (check.inputs) {
          const portValues = simulator.getPortValues();
          for (const [name, value] of check.inputs) {
            simulator.setInput(name, value);
            const segment = `_${name}_`;
            for (const key of portValues.keys()) {
              if (key.includes(segment) && key.endsWith('.out')) {
                const nodeId = key.slice(0, key.lastIndexOf('.'));
                simulator.setInput(nodeId, value);
                break;
              }
            }
          }
        }

        simulator.runCombinational();
        if (check.ticks && check.ticks > 0) {
          for (let t = 0; t < check.ticks; t++) simulator.tick();
          simulator.runCombinational();
        }

        const portSuffix = `.${check.port}`;
        const labelSegment = `_${check.node}_`;
        let actual: number | boolean | undefined;
        for (const [key, val] of simulator.getPortValues()) {
          if (key.endsWith(portSuffix) && key.includes(labelSegment)) {
            actual = val;
            break;
          }
        }
        results.push({ passed: actual === check.expected, actual, description: check.description, expected: check.expected });
      }

      simulator.reset();
      return results;
    }
  }), [sim]);

  // ── Time-travel: snapshot history for sequential circuits ──
  type Snapshot = { portValues: FlatPortValueMap; sequentialState: FlatSequentialState | null; cycleCount: number };
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isViewingPast = historyIndex >= 0 && historyIndex < history.length - 1;

  // Save initial snapshot when circuit first compiles
  useEffect(() => {
    if (sim.ready && sim.isSequential) {
      const engine = sim.getSimulator();
      if (engine) {
        try {
          const snap = engine.snapshot();
          setHistory([{ portValues: snap.portValues, sequentialState: snap.sequentialState, cycleCount: 0 }]);
          setHistoryIndex(0);
        } catch {
          setHistory([]);
          setHistoryIndex(-1);
        }
      }
    } else {
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [sim.ready, sim.isSequential]);

  // Wrap tick to record snapshots
  const tickWithHistory = useCallback(() => {
    sim.tick();
    const engine = sim.getSimulator();
    if (engine && sim.isSequential) {
      try {
        const snap = engine.snapshot();
        setHistory((prev) => {
          const next = [...prev, { portValues: snap.portValues, sequentialState: snap.sequentialState, cycleCount: sim.cycleCount + 1 }];
          setHistoryIndex(next.length - 1);
          return next;
        });
      } catch { /* non-sequential, ignore */ }
    }
  }, [sim]);

  const stepBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const engine = sim.getSimulator();
    if (!engine) return;
    const newIndex = historyIndex - 1;
    engine.restore(history[newIndex] as any);
    // Force re-render with restored state
    const pv = engine.getPortValues() as FlatPortValueMap;
    // Trigger sim state update via a combinational pass
    engine.runCombinational();
    setHistoryIndex(newIndex);
  }, [historyIndex, history, sim]);

  const stepForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const engine = sim.getSimulator();
    if (!engine) return;
    const newIndex = historyIndex + 1;
    engine.restore(history[newIndex] as any);
    engine.runCombinational();
    setHistoryIndex(newIndex);
  }, [historyIndex, history, sim]);

  const handleReset = useCallback(() => {
    setIsAutoRunning(false);
    sim.reset();
    const engine = sim.getSimulator();
    if (engine && sim.isSequential) {
      try {
        const snap = engine.snapshot();
        setHistory([{ portValues: snap.portValues, sequentialState: snap.sequentialState, cycleCount: 0 }]);
        setHistoryIndex(0);
      } catch { /* ignore */ }
    }
  }, [sim]);

  if (sim.error) {
    return <ErrorDisplay error={sim.error} title="Compilation Error" />;
  }

  if (!sim.ready) {
    return <LoadingSkeleton height={height} />;
  }

  const fillParent = typeof height === "string";

  return (
    <ErrorBoundary title="Circuit Render Error">
    <div
      data-embed-theme={resolvedTheme}
      className={`rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-surface-80)] overflow-hidden${fillParent ? " flex flex-col" : ""}`}
      style={fillParent ? { height } : undefined}
      role="application"
      aria-label={title || "Interactive circuit simulator"}
      aria-busy={!sim.ready}
    >
      {(title || description) && (
        <div className="px-4 py-3 border-b border-[var(--embed-border)] shrink-0">
          {title && <h3 className="text-sm font-semibold text-[var(--embed-text-primary)]">{title}</h3>}
          {description && <p className="text-xs text-[var(--embed-text-secondary)] mt-0.5">{description}</p>}
        </div>
      )}

      <CircuitCanvas
        circuit={sim.circuit}
        componentLibrary={sim.componentLibrary ?? undefined}
        portValues={sim.portValues}
        sequentialState={sim.sequentialState}
        onToggleNode={sim.toggleNode}
        onSetNodeValue={sim.setNodeValue}
        height={fillParent ? "100%" : height}
        className={fillParent ? "flex-1 min-h-0" : undefined}
        focus={focus}
        {...(nodePositions ? { nodePositions, autoLayout: false } : {})}
        showPortLabels={showPortLabels}
        onPortClick={onPortClick}
        glowUnconnected={glowUnconnected}
        theme={resolvedTheme}
      />

      {showControls && sim.isSequential && (
        <div className="px-3 py-2 border-t border-[var(--embed-border)] flex items-center gap-2 bg-[var(--embed-bg-surface)]">
          <button
            onClick={tickWithHistory}
            disabled={isViewingPast || isAutoRunning}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
          >
            Tick
          </button>
          <button
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            disabled={isViewingPast}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 ${
              isAutoRunning
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-primary)]"
            }`}
          >
            {isAutoRunning ? "Pause" : "Auto"}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-primary)] transition-colors"
          >
            Reset
          </button>

          {/* Time-travel controls */}
          {history.length > 1 && (
            <>
              <div className="w-px h-4 bg-[var(--embed-border)] mx-1" />
              <button
                onClick={stepBack}
                disabled={historyIndex <= 0 || isAutoRunning}
                className="px-1.5 py-1 text-xs font-medium rounded-md bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-primary)] transition-colors disabled:opacity-30"
                title="Step back"
              >
                ◀
              </button>
              <span className="text-[10px] text-[var(--embed-text-secondary)] font-mono tabular-nums min-w-[40px] text-center">
                {isViewingPast ? (
                  <span className="text-amber-500">{historyIndex + 1}/{history.length}</span>
                ) : (
                  <span>{history.length}/{history.length}</span>
                )}
              </span>
              <button
                onClick={stepForward}
                disabled={!isViewingPast || isAutoRunning}
                className="px-1.5 py-1 text-xs font-medium rounded-md bg-[var(--embed-bg-tertiary)] hover:opacity-80 text-[var(--embed-text-primary)] transition-colors disabled:opacity-30"
                title="Step forward"
              >
                ▶
              </button>
            </>
          )}

          <span className="ml-auto text-xs text-[var(--embed-text-secondary)] font-mono tabular-nums">
            Cycle {isViewingPast ? history[historyIndex]?.cycleCount ?? 0 : sim.cycleCount}
          </span>
        </div>
      )}

      {displayDsl && (
        <div className="border-t border-[var(--embed-border)]">
          <button
            onClick={() => setCodeVisible(!codeVisible)}
            className="w-full px-3 py-2 text-xs text-[var(--embed-text-secondary)] hover:text-[var(--embed-text-primary)] hover:bg-[var(--embed-bg-tertiary)]/50 transition-colors text-left flex items-center gap-1.5"
          >
            <svg
              className={`w-3 h-3 transition-transform ${codeVisible ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            View DSL
          </button>
          {codeVisible && (
            <pre className="px-4 pb-3 text-xs font-mono text-[var(--embed-text-secondary)] overflow-x-auto leading-relaxed">
              {displayDsl}
            </pre>
          )}
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
});

// Internal type for runChecks — not part of public API
interface SimulatorEngineInternal {
  reset(): void;
  setInput(name: string, value: boolean | number): void;
  runCombinational(): { error?: string };
  tick(): unknown;
  getPortValues(): ReadonlyMap<string, boolean | number>;
}
