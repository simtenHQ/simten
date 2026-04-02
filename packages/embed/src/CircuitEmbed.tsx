"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { useCircuitSimulator, type UseCircuitSimulatorOptions } from "./hooks/useCircuitSimulator";
import { CircuitCanvas, ClockControls } from "@turing-incomplete/ui/canvas";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { generateHarnessAppended } from "@turing-incomplete/core/dsl";

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
  /** Theme for the embed. Defaults to detecting from page. */
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
    if (theme) return;
    const el = document.documentElement;
    const sync = () => setDetectedTheme(el.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [theme]);
  const resolvedTheme = theme ?? detectedTheme;

  const sim = useCircuitSimulator(effectiveDsl, options);
  const [codeVisible, setCodeVisible] = useState(showCode);

  // Imperative handle for behavioral checks
  useImperativeHandle(ref, () => ({
    runChecks(checks: CheckSpec[]): CheckResult[] {
      const simulator = sim.getSimulator();
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

  const handleReset = useCallback(() => {
    sim.reset();
  }, [sim.reset]);

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
        onLoadMemory={(nodeId, memData) => {
          const engine = sim.getSimulator();
          if (engine) {
            engine.setNode(nodeId, memData);
            sim.runCombinational();
          }
        }}
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
        <ClockControls
          cycle={sim.cycleCount}
          historyLength={sim.history.length}
          historyIndex={sim.historyIndex}
          isRunning={sim.isRunning}
          isViewingPast={sim.isViewingPast}
          speed={sim.isRunning ? (1000 / autoRunSpeed) : 5}
          maxSpeed={100}
          onStep={sim.tick}
          onRun={() => sim.startAutoRun(1000 / autoRunSpeed, { displayRate: 30 })}
          onPause={sim.stopAutoRun}
          onReset={handleReset}
          onStepBack={sim.stepBack}
          onStepForward={sim.stepForward}
          onSpeedChange={(speed) => {
            if (sim.isRunning) {
              sim.stopAutoRun();
              sim.startAutoRun(speed, { displayRate: 30 });
            }
          }}
        />
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
