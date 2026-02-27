"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCircuitSimulator, type UseCircuitSimulatorOptions } from "./useCircuitSimulator";
import { CircuitCanvas } from "../shared/CircuitCanvas";
import { TooltipProvider } from "../primitives/tooltip";

interface CircuitEmbedProps {
  dsl: string;
  initialMemory?: Map<string, Map<number, number>>;
  height?: number | string;
  showControls?: boolean;
  showCode?: boolean;
  displayDsl?: string;
  autoRunSpeed?: number; // ms between ticks when auto-running
  title?: string;
  description?: string;
  /** Show only specific nodes at full opacity; others are dimmed. Simulation still runs on the full circuit. */
  focus?: string | string[];
}

/**
 * All-in-one embeddable circuit simulator.
 * Takes a DSL string, compiles and simulates it, renders interactive canvas with controls.
 */
export function CircuitEmbed({
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
}: CircuitEmbedProps) {
  const options: UseCircuitSimulatorOptions | undefined = initialMemory
    ? { initialMemory }
    : undefined;

  const sim = useCircuitSimulator(dsl, options);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [codeVisible, setCodeVisible] = useState(showCode);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-run for sequential circuits
  useEffect(() => {
    if (isAutoRunning && sim.ready && sim.isSequential) {
      intervalRef.current = setInterval(() => {
        sim.tick();
      }, autoRunSpeed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoRunning, sim.ready, sim.isSequential, autoRunSpeed, sim.tick]);

  const handleReset = useCallback(() => {
    setIsAutoRunning(false);
    sim.reset();
  }, [sim.reset]);

  if (sim.error) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-4">
        <div className="text-red-400 text-sm font-mono">{sim.error}</div>
      </div>
    );
  }

  if (!sim.ready) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 p-6">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <span className="text-sm">Compiling circuit...</span>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden">
      {/* Header */}
      {(title || description) && (
        <div className="px-4 py-3 border-b border-gray-700/50">
          {title && (
            <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          )}
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      )}

      {/* Canvas */}
      <CircuitCanvas
        circuit={sim.circuit}
        portValues={sim.portValues}
        sequentialState={sim.sequentialState}
        onToggleNode={sim.toggleNode}
        onSetNodeValue={sim.setNodeValue}
        height={height}
        focus={focus}
      />

      {/* Controls bar */}
      {showControls && sim.isSequential && (
        <div className="px-3 py-2 border-t border-gray-700/50 flex items-center gap-2 bg-gray-900/90">
          {/* Tick button */}
          <button
            onClick={sim.tick}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            title="Advance one clock cycle"
          >
            Tick
          </button>

          {/* Auto-run toggle */}
          <button
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isAutoRunning
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            {isAutoRunning ? "Pause" : "Auto"}
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            Reset
          </button>

          {/* Cycle counter */}
          <span className="ml-auto text-xs text-gray-400 font-mono tabular-nums">
            Cycle {sim.cycleCount}
          </span>
        </div>
      )}

      {/* Code toggle + display */}
      {displayDsl && (
        <div className="border-t border-gray-700/50">
          <button
            onClick={() => setCodeVisible(!codeVisible)}
            className="w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors text-left flex items-center gap-1.5"
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
            <pre className="px-4 pb-3 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
              {displayDsl}
            </pre>
          )}
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
