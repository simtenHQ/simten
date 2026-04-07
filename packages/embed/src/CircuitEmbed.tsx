
import { useState, useCallback, forwardRef, useImperativeHandle, useEffect } from "react";
import { useCircuitSimulator } from "./hooks/useCircuitSimulator";
import type { BuiltCircuit } from "@turing-incomplete/core/circuit";
import { CircuitCanvas, ClockControls } from "@turing-incomplete/ui/canvas";

export interface CircuitEmbedProps {
  /** The circuit to display (result of circuit()) */
  circuit: BuiltCircuit;
  /** Container height */
  height?: number | string;
  /** Show clock controls for sequential circuits */
  showControls?: boolean;
  /** Fixed node positions */
  nodePositions?: Record<string, { x: number; y: number }>;
  /** Theme */
  theme?: "light" | "dark";
  /** Title shown in bottom bar */
  title?: string;
  /** Subtitle shown next to title */
  subtitle?: string;
  /** Description shown below title */
  description?: string;
  /** Link target for the card */
  href?: string;
  /** Focus on specific node(s) */
  focus?: string | string[];
  /** Show port labels on nodes */
  showPortLabels?: boolean;
  /** Callback when a port is clicked */
  onPortClick?: (nodeLabel: string, portName: string, portType: 'input' | 'output') => void;
  /** Highlight unconnected ports */
  glowUnconnected?: boolean;
  /** Auto-run speed (ms between ticks) */
  autoRunSpeed?: number;
  /** Display code in collapsible panel */
  displayCode?: string;
  /** Initial values for input ports (set on harness Switch/Input nodes) */
  initialInputs?: Record<string, number | boolean>;
}

export interface CircuitEmbedHandle {
  tick: () => void;
  reset: () => void;
  setNodeValue: (nodeId: string, value: number | boolean | Map<number, number>) => void;
}

export const CircuitEmbed = forwardRef<CircuitEmbedHandle, CircuitEmbedProps>(
  function CircuitEmbed({ circuit, height = 300, showControls = true, nodePositions, theme, title, subtitle, description, href, focus, showPortLabels, onPortClick, glowUnconnected, autoRunSpeed = 500, displayCode, initialInputs }, ref) {
    const sim = useCircuitSimulator(circuit, { autoHarness: true, initialInputs });
    const [tickCount, setTickCount] = useState(0);
    const [codeVisible, setCodeVisible] = useState(false);

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

    const hasInfoBar = title || description;

    return (
      <div style={hasInfoBar ? undefined : { height }} className={`flex flex-col ${hasInfoBar ? 'rounded-lg border border-border overflow-hidden bg-card' : ''}`}>
        <div style={{ height: typeof height === 'number' ? height : undefined }} className="flex-1 min-h-0 flex flex-col">
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
        {displayCode && (
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
              View Code
            </button>
            {codeVisible && (
              <pre className="px-4 pb-3 text-xs font-mono text-[var(--embed-text-secondary)] overflow-x-auto leading-relaxed">
                {displayCode}
              </pre>
            )}
          </div>
        )}
        {hasInfoBar && (
          <div className="border-t border-border px-4 py-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold text-foreground">{title}</div>
              {subtitle && <div className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">{subtitle}</div>}
              {description && <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{description}</div>}
            </div>
            {href && (
              <a href={href} className="shrink-0 px-3 py-1.5 rounded border border-border text-[11px] text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors">
                Open →
              </a>
            )}
          </div>
        )}
      </div>
    );
  }
);
