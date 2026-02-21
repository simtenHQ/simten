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
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  useInspectorStore,
  type InspectorFrame,
  type OriginRect,
} from "../stores/expansion-store";
import { useComponentLibraryStore } from "../stores/component-library-store";
import { createDrillDownViewCircuit, BOUNDARY_IN_PREFIX } from "../utils/drill-down-view";
import { performHierarchicalLayout, centerLayout } from "../utils/auto-layout";
import { projectCircuitToReactFlow, type NodeData } from "../utils/projection";
import { createSimulatorFromCircuit } from "@/core/simulator";
import type { FlatPortValueMap } from "@/core/simulator/types";

import {
  InputNode,
  OutputNode,
  LogicGateNode,
  ScreenNode,
  RasterDisplayNode,
  RegisterNode,
  RAMNode,
  ROMNode,
  ConsoleNode,
} from "./nodes";
import { NumericInputNode } from "./nodes/NumericInputNode";
import { OrthogonalEdge } from "./edges";

// ── Node/edge type registrations (mirrors Canvas.tsx) ──

const dialogNodeTypes = {
  inputNode: InputNode,
  numericInputNode: NumericInputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  screenNode: ScreenNode,
  rasterDisplayNode: RasterDisplayNode,
  registerNode: RegisterNode,
  ramNode: RAMNode,
  romNode: ROMNode,
  consoleNode: ConsoleNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as NodeTypes;

const dialogEdgeTypes = {
  orthogonal: OrthogonalEdge,
};

// ── Animation helpers ──

/** Compute the initial transform values so the dialog appears to expand from the origin node */
function getOriginTransform(origin: OriginRect | null) {
  if (!origin) return {};

  // Dialog final position: centered, with p-8 (32px) padding on each side
  // and max-w-5xl (1024px), h-[80vh]
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dialogW = Math.min(1024, vw - 64);
  const dialogH = vh * 0.8;
  const dialogX = (vw - dialogW) / 2;
  const dialogY = (vh - dialogH) / 2;

  // Scale: how much smaller the origin is relative to the dialog
  const scaleX = origin.width / dialogW;
  const scaleY = origin.height / dialogH;

  // Translate: offset from dialog center to origin center
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

// ── Inner canvas for a single inspector level ──

interface InspectorCanvasProps {
  frame: InspectorFrame;
}

function InspectorCanvas({ frame }: InspectorCanvasProps) {
  const resolveComponent = useComponentLibraryStore((s) => s.resolveComponent);
  const getAllPrimitiveNames = useComponentLibraryStore((s) => s.getAllPrimitiveNames);
  const pushLevel = useInspectorStore((s) => s.pushLevel);

  // Build the view circuit (boundary Switch/Led nodes for composite ports)
  const viewCircuit = useMemo(
    () => createDrillDownViewCircuit(frame.componentDef),
    [frame.componentDef],
  );

  // Layout
  const { metadata } = useMemo(() => {
    const rawPositions = performHierarchicalLayout(viewCircuit);
    const centeredPositions = centerLayout(rawPositions);

    const components: Record<string, { id: string; position: { x: number; y: number }; selected: boolean }> = {};
    const connections: Record<string, { id: string; selected: boolean }> = {};

    for (const [id, position] of Object.entries(centeredPositions)) {
      components[id] = { id, position, selected: false };
    }
    for (const conn of viewCircuit.connections) {
      connections[conn.id] = { id: conn.id, selected: false };
    }

    return {
      metadata: { components, connections },
    };
  }, [viewCircuit]);

  // Build a ComponentLibrary adapter for the simulator
  const library = useMemo(() => ({
    resolveComponent: (name: string) => resolveComponent(name),
    getAllPrimitiveNames: () => getAllPrimitiveNames(),
  }), [resolveComponent, getAllPrimitiveNames]);

  // Create standalone simulator and run initial combinational pass
  const simulatorRef = useRef<ReturnType<typeof createSimulatorFromCircuit> | null>(null);

  const [portValues, setPortValues] = useState<FlatPortValueMap>(new Map() as FlatPortValueMap);

  // Initialize simulator when view circuit changes
  useEffect(() => {
    try {
      const sim = createSimulatorFromCircuit(viewCircuit, library);
      const result = sim.runCombinational();
      simulatorRef.current = sim;
      setPortValues(result.portValues);
    } catch (e) {
      console.warn("[InspectorCanvas] Simulator init failed:", e);
      simulatorRef.current = null;
      setPortValues(new Map() as FlatPortValueMap);
    }
  }, [viewCircuit, library]);

  // Handle switch toggle inside the inspector
  const handleToggle = useCallback((nodeId: string) => {
    const sim = simulatorRef.current;
    if (!sim) return;

    // Read current value from portValues, toggle it
    const outKey = `${nodeId}.out`;
    const currentValue = portValues.get(outKey);
    const newValue = !currentValue;

    sim.setInput(nodeId, newValue);
    const result = sim.runCombinational();
    setPortValues(result.portValues);
  }, [portValues]);

  // Handle double-click on composite node inside the dialog
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: { data: NodeData }) => {
      const data = node.data;
      if (!data.isComposite) return;

      const componentDef = resolveComponent(data.componentRef);
      if (!componentDef || componentDef.implementation.kind !== "composite") return;

      pushLevel(data.componentRef, componentDef, data.label || data.componentRef);
    },
    [resolveComponent, pushLevel],
  );

  // Project to ReactFlow nodes/edges
  const { nodes, edges } = useMemo(() => {
    const result = projectCircuitToReactFlow(viewCircuit, metadata, portValues);

    // Attach onToggle callbacks to boundary Switch nodes
    result.nodes = result.nodes.map((n) => {
      if (n.id.startsWith(BOUNDARY_IN_PREFIX) && n.type === "inputNode") {
        return {
          ...n,
          data: {
            ...n.data,
            onToggle: () => handleToggle(n.id),
          },
          deletable: false,
        };
      }
      return { ...n, deletable: false };
    });

    result.edges = result.edges.map((e) => ({
      ...e,
      deletable: false,
      selectable: false,
    }));

    return result;
  }, [viewCircuit, metadata, portValues, handleToggle]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={dialogNodeTypes}
        edgeTypes={dialogEdgeTypes}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={false}
        deleteKeyCode={null}
        className="bg-gray-50"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

// ── Breadcrumb navigation ──

interface BreadcrumbProps {
  stack: InspectorFrame[];
  onNavigate: (index: number) => void;
}

function InspectorBreadcrumb({ stack, onNavigate }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {stack.map((frame, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-gray-400">&gt;</span>}
          {index < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(index)}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              {frame.nodeLabel} ({frame.componentName})
            </button>
          ) : (
            <span className="font-semibold text-gray-900">
              {frame.nodeLabel} ({frame.componentName})
            </span>
          )}
        </React.Fragment>
      ))}
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
              initial={
                originRect
                  ? { ...originTransform, borderRadius: 8 }
                  : { opacity: 0, scale: 0.9 }
              }
              animate={{
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                borderRadius: 8,
              }}
              exit={
                originRect
                  ? { ...originTransform, borderRadius: 8 }
                  : { opacity: 0, scale: 0.9 }
              }
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 300,
                mass: 0.8,
              }}
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
