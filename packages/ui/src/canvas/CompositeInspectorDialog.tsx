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

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { InspectorFrame } from "./types";
import { createDrillDownViewCircuit } from "./drill-down-view";
import type { CircuitLibrary, SimulatorEngine } from "@simten/core/simulator";
import { createSimulatorFromCircuit } from "@simten/core/simulator";
import type { Circuit, BitValue, BusValue } from "@simten/core";
import { isSequentialCircuit } from "@simten/core/circuit";

import { CircuitCanvas } from "./CircuitCanvas";
import { ClockControls } from "./ClockControls";
import { NODE_TYPES, EDGE_TYPES } from "./node-types";
import type { NodeData } from "../nodes";
import { useSandboxContext } from "../sandbox/SandboxProvider";

// ── Inner canvas for a single inspector level ──

interface InspectorCanvasProps {
  frame: InspectorFrame;
  componentLibrary: CircuitLibrary;
  onPushLevel: (name: string, def: Circuit, label: string) => void;
  theme?: "light" | "dark";
}

function InspectorCanvas({
  frame,
  componentLibrary,
  onPushLevel,
  theme = "dark",
}: InspectorCanvasProps) {
  const viewCircuit = useMemo(
    () => createDrillDownViewCircuit(frame.componentDef),
    [frame.componentDef],
  );

  const isSequential = useMemo(
    () => isSequentialCircuit(viewCircuit, componentLibrary.resolveCircuit),
    [viewCircuit, componentLibrary],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeData: NodeData) => {
      if (!nodeData.isComposite) return;
      const componentDef = componentLibrary.resolveCircuit(
        nodeData.componentRef,
      );
      if (!componentDef) return;

      if (
        componentDef.implementation.kind === "composite" &&
        componentDef.nodes.length > 0
      ) {
        onPushLevel(
          nodeData.componentRef,
          componentDef,
          nodeData.label ?? nodeData.componentRef,
        );
      }
    },
    [componentLibrary, onPushLevel],
  );

  // ── Simulation: prefer sandbox, fall back to local simulator ──
  const sandbox = useSandboxContext();
  const [portValues, setPortValues] = useState<Map<string, BitValue | BusValue>>(new Map());
  const [useSandbox, setUseSandbox] = useState(false);
  const localEngineRef = useRef<SimulatorEngine | null>(null);
  // Clock-control state — minimal time-travel via sandbox snapshots, scoped
  // to this drill-down's slot.
  const [cycle, setCycle] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const historyRef = useRef<{ snapshotId: number; cycle: number }[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Unique slot ID per drill-down instance (supports nested drill-downs)
  const slotIdRef = useRef<string>('');
  if (!slotIdRef.current) {
    slotIdRef.current = `drill-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
  }
  const slotId = slotIdRef.current;

  // Cleanup slot on unmount
  useEffect(() => {
    return () => {
      if (useSandbox) sandbox.dispose(slotId).catch(() => {});
    };
  }, [sandbox, slotId, useSandbox]);

  useEffect(() => {
    // Send the drill-down view circuit to the sandbox for simulation.
    // The sandbox already has eval functions from the source compile.
    // Include every circuit the view references (primitives AND composites,
    // recursively) — without composite defs, the sandbox can't simulate
    // composite children and their outputs stay stuck.
    const allLib: Circuit[] = [];
    const seen = new Set<string>();
    for (const name of componentLibrary.getAllPrimitiveNames()) {
      const c = componentLibrary.resolveCircuit(name);
      if (c && !seen.has(name)) { seen.add(name); allLib.push(c); }
    }
    const walk = (c: Circuit) => {
      for (const node of c.nodes) {
        if (seen.has(node.componentRef)) continue;
        const resolved = componentLibrary.resolveCircuit(node.componentRef);
        if (!resolved) continue;
        seen.add(node.componentRef);
        allLib.push(resolved);
        if (resolved.implementation.kind === 'composite') walk(resolved);
      }
    };
    walk(viewCircuit);

    sandbox.compileIR(viewCircuit, allLib, slotId, { snapshot: isSequential }).then(result => {
      if ('error' in result) {
        // Fall back to local simulator (for embed contexts where no source was compiled)
        try {
          const engine = createSimulatorFromCircuit(viewCircuit, componentLibrary);
          engine.runCombinational();
          localEngineRef.current = engine;
          setUseSandbox(false);
          const pvMap = new Map<string, BitValue | BusValue>();
          for (const [k, v] of engine.getPortValues()) {
            pvMap.set(k, v);
          }
          setPortValues(pvMap);
        } catch (e) {
          console.warn("[InspectorCanvas] Both sandbox and local failed:", e);
        }
        return;
      }
      setUseSandbox(true);
      const pvMap = new Map<string, BitValue | BusValue>();
      for (const [k, v] of Object.entries(result.portValues)) {
        pvMap.set(k, v);
      }
      setPortValues(pvMap);
      // Seed history with the initial snapshot (sequential circuits only).
      historyRef.current = result.snapshotId !== undefined
        ? [{ snapshotId: result.snapshotId, cycle: 0 }]
        : [];
      setHistoryLen(historyRef.current.length);
      setHistoryIndex(historyRef.current.length === 0 ? -1 : 0);
      setCycle(0);
    });
  }, [viewCircuit, componentLibrary, sandbox, slotId, isSequential]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      const outKey = `${nodeId}.out`;
      const currentValue = portValues.get(outKey);
      sandbox.setNode(nodeId, !currentValue as number | boolean, slotId).then(result => {
        if ('error' in result) return;
        const pvMap = new Map<string, BitValue | BusValue>();
        for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
        setPortValues(pvMap);
      });
    },
    [sandbox, portValues],
  );

  const handleNumericChange = useCallback(
    (nodeId: string, newValue: number) => {
      sandbox.setNode(nodeId, newValue, slotId).then(result => {
        if ('error' in result) return;
        const pvMap = new Map<string, BitValue | BusValue>();
        for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
        setPortValues(pvMap);
      });
    },
    [sandbox],
  );

  // ── Clock controls ─────────────────────────────────────────────────────
  // Tick the sandbox slot, capture a snapshot, and record it in history.
  // If we're currently viewing the past, ticking truncates future entries
  // (mirrors the embed's history semantics).
  const handleTick = useCallback(() => {
    sandbox.tick(undefined, slotId, { snapshot: isSequential }).then(result => {
      if ('error' in result) return;
      const pvMap = new Map<string, BitValue | BusValue>();
      for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
      setPortValues(pvMap);
      setCycle(result.cycle);
      if (result.snapshotId !== undefined) {
        const truncated = historyRef.current.slice(0, historyIndex + 1);
        truncated.push({ snapshotId: result.snapshotId, cycle: result.cycle });
        historyRef.current = truncated;
        setHistoryLen(truncated.length);
        setHistoryIndex(truncated.length - 1);
      }
    });
  }, [sandbox, slotId, isSequential, historyIndex]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    sandbox.reset(slotId).then(result => {
      if ('error' in result) return;
      const pvMap = new Map<string, BitValue | BusValue>();
      for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
      setPortValues(pvMap);
      setCycle(0);
      // Reset clears all history; if the slot is sequential, take a fresh
      // snapshot of the post-reset state to seed history again.
      historyRef.current = [];
      setHistoryLen(0);
      setHistoryIndex(-1);
      if (isSequential) {
        sandbox.snapshot(slotId).then(snap => {
          if ('error' in snap || snap.snapshotId === undefined) return;
          historyRef.current = [{ snapshotId: snap.snapshotId, cycle: 0 }];
          setHistoryLen(1);
          setHistoryIndex(0);
        });
      }
    });
  }, [sandbox, slotId, isSequential]);

  const restoreTo = useCallback((index: number) => {
    const entry = historyRef.current[index];
    if (!entry) return;
    sandbox.restore(entry.snapshotId, slotId).then(result => {
      if ('error' in result) return;
      const pvMap = new Map<string, BitValue | BusValue>();
      for (const [k, v] of Object.entries(result.portValues)) pvMap.set(k, v);
      setPortValues(pvMap);
      setCycle(entry.cycle);
      setHistoryIndex(index);
    });
  }, [sandbox, slotId]);

  const handleStepBack = useCallback(() => {
    setIsRunning(false);
    if (historyIndex > 0) restoreTo(historyIndex - 1);
  }, [historyIndex, restoreTo]);

  const handleStepForward = useCallback(() => {
    if (historyIndex < historyLen - 1) restoreTo(historyIndex + 1);
    else handleTick();
  }, [historyIndex, historyLen, restoreTo, handleTick]);

  // Auto-run loop while isRunning.
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => { handleTick(); }, 200);
    return () => window.clearInterval(id);
  }, [isRunning, handleTick]);

  return (
    <div className="relative h-full w-full">
      {isSequential && (
        <ClockControls
          floating
          cycle={cycle}
          historyLength={historyLen}
          historyIndex={historyIndex}
          isRunning={isRunning}
          isViewingPast={historyIndex >= 0 && historyIndex < historyLen - 1}
          onStep={handleTick}
          onRun={() => setIsRunning(true)}
          onPause={() => setIsRunning(false)}
          onReset={handleReset}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
        />
      )}

      <CircuitCanvas
        circuit={viewCircuit}
        componentLibrary={componentLibrary}
        portValues={portValues as Map<string, boolean | number>}
        sequentialState={null}
        onToggleNode={handleToggle}
        onSetNodeValue={handleNumericChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        theme={theme}
        showControls
        height="100%"
        panOnMobile
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

function InspectorBreadcrumb({
  stack,
  onNavigate,
  theme = "dark",
}: BreadcrumbProps) {
  const topFrame = stack[stack.length - 1];
  const description = topFrame?.componentDef.metadata?.description;
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {stack.map((frame, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span
              className={`${dark ? "text-gray-500" : "text-gray-400"} shrink-0`}
            >
              &gt;
            </span>
          )}
          {index < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(index)}
              className={`${
                dark
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-blue-600 hover:text-blue-800"
              } hover:underline font-medium shrink-0`}
            >
              {frame.nodeLabel} ({frame.componentName})
            </button>
          ) : (
            <span
              className={`font-semibold shrink-0 ${
                dark ? "text-gray-100" : "text-gray-900"
              }`}
            >
              {frame.nodeLabel} ({frame.componentName})
            </span>
          )}
        </React.Fragment>
      ))}
      {description && (
        <>
          <span
            className={`${dark ? "text-gray-600" : "text-gray-300"} shrink-0`}
          >
            —
          </span>
          <span
            className={`${
              dark ? "text-gray-400" : "text-gray-500"
            } text-xs italic truncate`}
          >
            {description}
          </span>
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
  componentLibrary: CircuitLibrary;
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

  // Lock body scroll while the inspector is open. This is a hand-rolled modal
  // (motion.div + fixed positioning), so the browser doesn't lock scroll for
  // us the way native <dialog> would. Without this, swiping the modal scrolls
  // the page underneath. Tracked for proper Radix Dialog refactor in #84.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

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
              <div
                className={`flex items-center justify-between border-b px-4 py-3 ${
                  theme === "dark" ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <InspectorBreadcrumb
                  stack={stack}
                  onNavigate={onNavigate}
                  theme={theme}
                />
                <button
                  onClick={onClose}
                  className={`rounded p-1 ${
                    theme === "dark"
                      ? "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                  aria-label="Close inspector"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
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
