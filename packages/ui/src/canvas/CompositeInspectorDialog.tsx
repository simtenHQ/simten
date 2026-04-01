/**
 * CompositeInspectorDialog (Store-Free)
 *
 * Modal dialog that shows the internals of a composite component with its own
 * canvas and independent simulation engine. Supports nested drill-down — double-
 * clicking a composite inside the dialog pushes another level onto the stack.
 *
 * This version is fully props-driven with no Zustand store dependencies,
 * so it can be used anywhere a CircuitCanvas renders (editor, embeds, blog, etc.).
 */

"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { InspectorFrame } from "./types";
import { createDrillDownViewCircuit } from "./drill-down-view";
import { createMutableLibraryForRef } from "./utils";
import {
  createSimulatorFromCircuit,
  PRIMITIVE_DEFINITIONS,
  getReferenceCircuit,
} from "@turing-incomplete/core/simulator";
import type {
  ComponentLibrary,
  FlatPortValueMap,
  FlatSequentialState,
  SimulatorSnapshot,
} from "@turing-incomplete/core/simulator";
import type { Circuit } from "@turing-incomplete/core/dsl";
import { compileDSL } from "@turing-incomplete/core/dsl";
import {
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { CircuitCanvas } from "./CircuitCanvas";
import { NODE_TYPES, EDGE_TYPES } from "./node-types";
import type { NodeData } from "../nodes";

// ── Sequential detection ──

function hasSequentialComponents(
  circuit: Circuit | null,
  resolveComponent: (name: string) => Circuit | undefined,
  visited: Set<string> = new Set(),
): boolean {
  if (!circuit) return false;
  if (visited.has(circuit.name)) return false;
  visited.add(circuit.name);
  for (const node of circuit.nodes) {
    const componentDef = resolveComponent(node.componentRef);
    if (!componentDef) continue;
    if (componentDef.clocks.length > 0 || componentDef.state.length > 0) return true;
    if (componentDef.implementation.kind === "composite") {
      if (hasSequentialComponents(componentDef, resolveComponent, visited)) return true;
    }
  }
  return false;
}

// ── Inspector clock controls (floating, compact) ──

interface InspectorClockControlsProps {
  cycle: number;
  historyLength: number;
  historyIndex: number;
  isRunning: boolean;
  isViewingPast: boolean;
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

function InspectorClockControls({
  cycle,
  historyLength,
  historyIndex,
  isRunning,
  isViewingPast,
  onStep,
  onRun,
  onPause,
  onReset,
  onStepBack,
  onStepForward,
}: InspectorClockControlsProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-1.5 shadow-md dark:border-gray-700 dark:bg-gray-800/95">
        <button
          onClick={onStep}
          disabled={isRunning || isViewingPast}
          className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Step (one clock cycle)"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        {isRunning ? (
          <button
            onClick={onPause}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={isViewingPast}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Run continuously"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={onReset}
          className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <div className="border-l border-gray-200 dark:border-gray-600 pl-1.5 ml-0.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Cycle <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{cycle}</span>
          </span>
        </div>

        <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-600 pl-1.5 ml-0.5">
          <button
            onClick={onStepBack}
            disabled={historyIndex <= 0 || isRunning}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Step back"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="min-w-[40px] text-center text-[11px] text-gray-500 dark:text-gray-400">
            {isViewingPast ? (
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {historyIndex + 1}/{historyLength}
              </span>
            ) : (
              <span className="font-mono">
                {historyLength}/{historyLength}
              </span>
            )}
          </span>

          <button
            onClick={onStepForward}
            disabled={!isViewingPast || isRunning}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Step forward"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inner canvas for a single inspector level ──

interface InspectorCanvasProps {
  frame: InspectorFrame;
  componentLibrary: ComponentLibrary;
  onPushLevel: (name: string, def: Circuit, label: string) => void;
  theme?: "light" | "dark";
}

function InspectorCanvas({ frame, componentLibrary, onPushLevel, theme = "dark" }: InspectorCanvasProps) {
  const viewCircuit = useMemo(
    () => createDrillDownViewCircuit(frame.componentDef),
    [frame.componentDef],
  );

  const isSequential = useMemo(
    () => hasSequentialComponents(viewCircuit, componentLibrary.resolveComponent),
    [viewCircuit, componentLibrary],
  );

  const handleNodeDoubleClick = useCallback((nodeData: NodeData) => {
    if (!nodeData.isComposite) return;
    const componentDef = componentLibrary.resolveComponent(nodeData.componentRef);
    if (!componentDef) return;

    if (componentDef.implementation.kind === "composite" && componentDef.nodes.length > 0) {
      onPushLevel(nodeData.componentRef, componentDef, nodeData.label ?? nodeData.componentRef);
      return;
    }

    const params: Record<string, number> = {};
    if (nodeData.arguments) {
      for (const [k, v] of Object.entries(nodeData.arguments)) {
        if (typeof v === "number") params[k] = v;
      }
    }
    const refSource = getReferenceCircuit(nodeData.componentRef, params);
    if (refSource) {
      try {
        const refLib = createMutableLibraryForRef();
        const result = compileDSL(refSource, refLib, `ref-${nodeData.componentRef}.dsl`);
        if (result.circuits.length > 0) {
          const refCircuit = result.circuits[result.circuits.length - 1];
          onPushLevel(nodeData.componentRef, refCircuit, nodeData.label ?? nodeData.componentRef);
        }
      } catch { /* can't drill into this primitive */ }
    }
  }, [componentLibrary, onPushLevel]);

  // ── Simulator state ──
  const simulatorRef = useRef<ReturnType<typeof createSimulatorFromCircuit> | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap>(new Map() as FlatPortValueMap);
  const [seqState, setSeqState] = useState<FlatSequentialState | null>(null);

  const syncFromSimulator = useCallback((newPortValues: FlatPortValueMap) => {
    setPortValues(newPortValues);
    setSeqState(simulatorRef.current?.getState() ?? null);
  }, []);

  const [cycle, setCycle] = useState(0);
  const [history, setHistory] = useState<SimulatorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isViewingPast = historyIndex >= 0 && historyIndex < history.length - 1;

  useEffect(() => {
    try {
      const sim = createSimulatorFromCircuit(viewCircuit, componentLibrary);
      const result = sim.runCombinational();
      simulatorRef.current = sim;
      syncFromSimulator(result.portValues);
      setCycle(0);

      if (isSequential) {
        const snap = sim.snapshot();
        setHistory([snap]);
        setHistoryIndex(0);
      }
    } catch (e) {
      console.warn("[InspectorCanvas] Simulator init failed:", e);
      simulatorRef.current = null;
      syncFromSimulator(new Map() as FlatPortValueMap);
    }

    return () => {
      if (runIntervalRef.current) clearInterval(runIntervalRef.current);
    };
  }, [viewCircuit, componentLibrary, isSequential, syncFromSimulator]);

  const handleToggle = useCallback((nodeId: string) => {
    const sim = simulatorRef.current;
    if (!sim) return;

    const outKey = `${nodeId}.out`;
    const currentValue = portValues.get(outKey);
    sim.setInput(nodeId, !currentValue);
    const result = sim.runCombinational();
    syncFromSimulator(result.portValues);
  }, [portValues, syncFromSimulator]);

  const handleNumericChange = useCallback((nodeId: string, newValue: number) => {
    const sim = simulatorRef.current;
    if (!sim) return;

    sim.setInput(nodeId, newValue);
    const result = sim.runCombinational();
    syncFromSimulator(result.portValues);
  }, [syncFromSimulator]);

  // ── Sequential controls ──

  const handleStep = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;

    const result = sim.tick();
    syncFromSimulator(result.portValues);
    setCycle((c) => c + 1);

    const snap = sim.snapshot();
    setHistory((prev) => {
      const next = [...prev, snap];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [syncFromSimulator]);

  const handleRun = useCallback(() => setIsRunning(true), []);
  const handlePause = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    handlePause();
    const sim = simulatorRef.current;
    if (!sim) return;

    sim.reset();
    const result = sim.runCombinational();
    syncFromSimulator(result.portValues);
    setCycle(0);

    const snap = sim.snapshot();
    setHistory([snap]);
    setHistoryIndex(0);
  }, [handlePause, syncFromSimulator]);

  const handleStepBack = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim || historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    sim.restore(history[newIndex]);
    syncFromSimulator(sim.getPortValues() as FlatPortValueMap);
    setCycle(history[newIndex].cycleCount);
    setHistoryIndex(newIndex);
  }, [historyIndex, history, syncFromSimulator]);

  const handleStepForward = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim || historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    sim.restore(history[newIndex]);
    syncFromSimulator(sim.getPortValues() as FlatPortValueMap);
    setCycle(history[newIndex].cycleCount);
    setHistoryIndex(newIndex);
  }, [historyIndex, history, syncFromSimulator]);

  useEffect(() => {
    if (!isRunning || !isSequential) return;

    runIntervalRef.current = setInterval(() => {
      handleStep();
    }, 200);

    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current);
        runIntervalRef.current = null;
      }
    };
  }, [isRunning, isSequential, handleStep]);

  return (
    <div className="relative h-full w-full">
      {isSequential && (
        <InspectorClockControls
          cycle={cycle}
          historyLength={history.length}
          historyIndex={historyIndex}
          isRunning={isRunning}
          isViewingPast={isViewingPast}
          onStep={handleStep}
          onRun={handleRun}
          onPause={handlePause}
          onReset={handleReset}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
        />
      )}

      <CircuitCanvas
        circuit={viewCircuit}
        componentLibrary={componentLibrary}
        portValues={portValues}
        sequentialState={seqState}
        onToggleNode={handleToggle}
        onSetNodeValue={handleNumericChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        theme={theme}
        showControls
        height="100%"
      />
    </div>
  );
}

// ── Breadcrumb navigation ──

interface BreadcrumbProps {
  stack: InspectorFrame[];
  onNavigate: (index: number) => void;
  theme?: "light" | "dark";
}

function InspectorBreadcrumb({ stack, onNavigate, theme = "dark" }: BreadcrumbProps) {
  const topFrame = stack[stack.length - 1];
  const description = topFrame?.componentDef.metadata?.description
    ?? PRIMITIVE_DEFINITIONS[topFrame?.componentName]?.referenceCircuit?.description;
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {stack.map((frame, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className={`${dark ? "text-gray-500" : "text-gray-400"} shrink-0`}>&gt;</span>}
          {index < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(index)}
              className={`${dark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"} hover:underline font-medium shrink-0`}
            >
              {frame.nodeLabel} ({frame.componentName})
            </button>
          ) : (
            <span className={`font-semibold shrink-0 ${dark ? "text-gray-100" : "text-gray-900"}`}>
              {frame.nodeLabel} ({frame.componentName})
            </span>
          )}
        </React.Fragment>
      ))}
      {description && (
        <>
          <span className={`${dark ? "text-gray-600" : "text-gray-300"} shrink-0`}>—</span>
          <span className={`${dark ? "text-gray-400" : "text-gray-500"} text-xs italic truncate`}>{description}</span>
        </>
      )}
    </div>
  );
}

// ── Level transition direction ──

type Direction = "in" | "out";

const levelVariants = {
  enterIn: { opacity: 0 },
  enterOut: { opacity: 0 },
  center: { opacity: 1 },
  exitIn: { opacity: 0 },
  exitOut: { opacity: 0 },
};

// ── Main dialog component (props-driven) ──

export interface CompositeInspectorDialogProps {
  stack: InspectorFrame[];
  componentLibrary: ComponentLibrary;
  theme?: "light" | "dark";
  onClose: () => void;
  onPopLevel: () => void;
  onPushLevel: (name: string, def: Circuit, label: string) => void;
  onNavigate: (index: number) => void;
}

export function CompositeInspectorDialog({
  stack,
  componentLibrary,
  theme = "dark",
  onClose,
  onPopLevel,
  onPushLevel,
  onNavigate,
}: CompositeInspectorDialogProps) {
  const isOpen = stack.length > 0;

  const prevDepthRef = useRef(0);
  const [direction, setDirection] = useState<Direction>("in");

  useEffect(() => {
    if (stack.length > prevDepthRef.current) {
      setDirection("in");
    } else if (stack.length < prevDepthRef.current) {
      setDirection("out");
    }
    prevDepthRef.current = stack.length;
  }, [stack.length]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (stack.length > 1) {
          onPopLevel();
        } else {
          onClose();
        }
      }
    },
    [stack.length, onPopLevel, onClose],
  );

  const topFrame = isOpen ? stack[stack.length - 1] : null;

  return (
    <AnimatePresence>
      {isOpen && topFrame && (
        <>
          {/* Backdrop */}
          <motion.div
            key="inspector-backdrop"
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          />

          {/* Dialog panel */}
          <motion.div
            key="inspector-dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
          >
            <motion.div
              className={`flex h-[80vh] w-full max-w-5xl flex-col rounded-lg shadow-xl pointer-events-auto overflow-hidden ${
                theme === "dark" ? "bg-gray-900" : "bg-white"
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <div className={`flex items-center justify-between border-b px-4 py-3 ${
                theme === "dark" ? "border-gray-700" : "border-gray-200"
              }`}>
                <InspectorBreadcrumb stack={stack} onNavigate={onNavigate} theme={theme} />
                <button
                  onClick={onClose}
                  className={`rounded p-1 ${
                    theme === "dark"
                      ? "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                  aria-label="Close inspector"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Canvas body — animated level transitions */}
              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${stack.length}-${topFrame.componentName}`}
                    className="absolute inset-0"
                    initial={direction === "in" ? "enterIn" : "enterOut"}
                    animate="center"
                    exit={direction === "in" ? "exitIn" : "exitOut"}
                    variants={levelVariants}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <InspectorCanvas
                      frame={topFrame}
                      componentLibrary={componentLibrary}
                      onPushLevel={onPushLevel}
                      theme={theme}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
