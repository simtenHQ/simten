/**
 * CompositeInspectorDialog
 *
 * Modal dialog that shows the internals of a composite component with its own
 * canvas and independent simulation engine. Supports nested drill-down — double-
 * clicking a composite inside the dialog pushes another level onto the stack.
 *
 * The dialog animates out from the clicked node using Framer Motion.
 * Only one simulation level is active at a time (the top of the stack).
 */

"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  useInspectorStore,
  type InspectorFrame,
  type OriginRect,
} from "../stores/expansion-store";
import { useComponentLibraryStore } from "../stores/component-library-store";
import { createDrillDownViewCircuit } from "../utils/drill-down-view";
import { createSimulatorFromCircuit, PRIMITIVE_DEFINITIONS } from "@turing-incomplete/core/simulator";
import type { FlatPortValueMap, FlatSequentialState, SimulatorSnapshot } from "@turing-incomplete/core/simulator";
import type { Circuit } from "../types/circuit";
import {
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { CircuitCanvas, NODE_TYPES, EDGE_TYPES } from "../../canvas";

// ── Animation helpers ──

/** Compute the initial transform values so the dialog appears to expand from the origin node */
function getOriginTransform(origin: OriginRect | null) {
  if (!origin) return {};

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dialogW = Math.min(1024, vw - 64);
  const dialogH = vh * 0.8;
  const dialogX = (vw - dialogW) / 2;
  const dialogY = (vh - dialogH) / 2;

  const scaleX = origin.width / dialogW;
  const scaleY = origin.height / dialogH;

  const originCenterX = origin.x + origin.width / 2;
  const originCenterY = origin.y + origin.height / 2;
  const dialogCenterX = dialogX + dialogW / 2;
  const dialogCenterY = dialogY + dialogH / 2;

  return {
    x: originCenterX - dialogCenterX,
    y: originCenterY - dialogCenterY,
    scaleX,
    scaleY,
    opacity: 0,
  };
}

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
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-1.5 shadow-md">
        {/* Simulation controls */}
        <button
          onClick={onStep}
          disabled={isRunning || isViewingPast}
          className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          title="Step (one clock cycle)"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        {isRunning ? (
          <button
            onClick={onPause}
            className="rounded p-1 text-gray-600 hover:bg-gray-100"
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={isViewingPast}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            title="Run continuously"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={onReset}
          className="rounded p-1 text-gray-600 hover:bg-gray-100"
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Cycle counter */}
        <div className="border-l border-gray-200 pl-1.5 ml-0.5">
          <span className="text-[11px] text-gray-500">
            Cycle <span className="font-mono font-semibold text-gray-700">{cycle}</span>
          </span>
        </div>

        {/* Time-travel */}
        <div className="flex items-center gap-0.5 border-l border-gray-200 pl-1.5 ml-0.5">
          <button
            onClick={onStepBack}
            disabled={historyIndex <= 0 || isRunning}
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            title="Step back"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="min-w-[40px] text-center text-[11px] text-gray-500">
            {isViewingPast ? (
              <span className="font-mono text-amber-600">
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
            className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
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
}

function InspectorCanvas({ frame }: InspectorCanvasProps) {
  const resolveComponent = useComponentLibraryStore((s) => s.resolveComponent);
  const getAllPrimitiveNames = useComponentLibraryStore((s) => s.getAllPrimitiveNames);

  // Build the view circuit (boundary Switch/Led nodes for composite ports)
  const viewCircuit = useMemo(
    () => createDrillDownViewCircuit(frame.componentDef),
    [frame.componentDef],
  );

  // Detect if this circuit is sequential
  const isSequential = useMemo(
    () => hasSequentialComponents(viewCircuit, resolveComponent),
    [viewCircuit, resolveComponent],
  );

  // Build a ComponentLibrary adapter for the simulator
  const library = useMemo(() => ({
    resolveComponent: (name: string) => resolveComponent(name),
    getAllPrimitiveNames: () => getAllPrimitiveNames(),
  }), [resolveComponent, getAllPrimitiveNames]);

  // ── Simulator state ──
  const simulatorRef = useRef<ReturnType<typeof createSimulatorFromCircuit> | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap>(new Map() as FlatPortValueMap);
  const [seqState, setSeqState] = useState<FlatSequentialState | null>(null);

  /** Single update path: always sync both portValues and seqState from the simulator */
  const syncFromSimulator = useCallback((newPortValues: FlatPortValueMap) => {
    setPortValues(newPortValues);
    setSeqState(simulatorRef.current?.getState() ?? null);
  }, []);

  // Sequential-only state
  const [cycle, setCycle] = useState(0);
  const [history, setHistory] = useState<SimulatorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isViewingPast = historyIndex >= 0 && historyIndex < history.length - 1;

  // Initialize simulator
  useEffect(() => {
    try {
      const sim = createSimulatorFromCircuit(viewCircuit, library);
      const result = sim.runCombinational();
      simulatorRef.current = sim;
      syncFromSimulator(result.portValues);
      setCycle(0);

      // Save initial snapshot for sequential circuits
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
  }, [viewCircuit, library, isSequential, syncFromSimulator]);

  // Handle switch toggle (Bit inputs)
  const handleToggle = useCallback((nodeId: string) => {
    const sim = simulatorRef.current;
    if (!sim) return;

    const outKey = `${nodeId}.out`;
    const currentValue = portValues.get(outKey);
    sim.setInput(nodeId, !currentValue);
    const result = sim.runCombinational();
    syncFromSimulator(result.portValues);
  }, [portValues, syncFromSimulator]);

  // Handle numeric value change (Bus inputs)
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

  // Run loop
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
      {/* Sequential clock controls — floating above canvas */}
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
        componentLibrary={library}
        portValues={portValues}
        sequentialState={seqState}
        onToggleNode={handleToggle}
        onSetNodeValue={handleNumericChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        theme="light"
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
}

function InspectorBreadcrumb({ stack, onNavigate }: BreadcrumbProps) {
  const topFrame = stack[stack.length - 1];
  const description = topFrame?.componentDef.metadata?.description
    ?? PRIMITIVE_DEFINITIONS[topFrame?.componentName]?.referenceCircuit?.description;
  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {stack.map((frame, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-gray-400 shrink-0">&gt;</span>}
          {index < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(index)}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium shrink-0"
            >
              {frame.nodeLabel} ({frame.componentName})
            </button>
          ) : (
            <span className="font-semibold text-gray-900 shrink-0">
              {frame.nodeLabel} ({frame.componentName})
            </span>
          )}
        </React.Fragment>
      ))}
      {description && (
        <>
          <span className="text-gray-300 shrink-0">—</span>
          <span className="text-gray-500 text-xs italic truncate">{description}</span>
        </>
      )}
    </div>
  );
}

// ── Level transition direction ──

/** Track whether we're drilling in (deeper) or out (shallower) for animation direction */
type Direction = "in" | "out";

const levelVariants = {
  enterIn: { opacity: 0, scale: 1.08 },
  enterOut: { opacity: 0, scale: 0.92 },
  center: { opacity: 1, scale: 1 },
  exitIn: { opacity: 0, scale: 0.92 },
  exitOut: { opacity: 0, scale: 1.08 },
};

// ── Main dialog component ──

export function CompositeInspectorDialog() {
  const stack = useInspectorStore((s) => s.stack);
  const originRect = useInspectorStore((s) => s.originRect);
  const close = useInspectorStore((s) => s.close);
  const popLevel = useInspectorStore((s) => s.popLevel);

  const isOpen = stack.length > 0;

  // Track direction of level navigation
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

  const handleNavigate = useCallback(
    (index: number) => {
      const popCount = stack.length - 1 - index;
      for (let i = 0; i < popCount; i++) {
        popLevel();
      }
    },
    [stack.length, popLevel],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (stack.length > 1) {
          popLevel();
        } else {
          close();
        }
      }
    },
    [stack.length, popLevel, close],
  );

  const topFrame = isOpen ? stack[stack.length - 1] : null;

  // Compute initial animation values from the origin node rect
  const originTransform = useMemo(() => getOriginTransform(originRect), [originRect]);

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
              className="flex h-[80vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl pointer-events-auto overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <InspectorBreadcrumb stack={stack} onNavigate={handleNavigate} />
                <button
                  onClick={close}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    <InspectorCanvas frame={topFrame} />
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
