/**
 * Canvas Component (IR v0.1)
 *
 * Main ReactFlow canvas for the visual editor using Circuit (IR v0.1) format.
 * Handles node/edge rendering, drag-and-drop, connections, and interactions.
 *
 * Key changes from legacy Canvas:
 * - Uses CircuitStore instead of IRStore
 * - Uses name-based ports (PortPath) instead of index-based ports
 * - Cleaner component resolution via ComponentLibrary
 * - New simulator (simulator-v0.1.ts) for Circuit format
 *
 * Features:
 * - Single-click to select individual nodes
 * - Shift+click for multi-select
 * - Drag on canvas for box/area selection
 * - Delete/Backspace keys to remove selected nodes
 * - Visual feedback for selected nodes (blue border)
 * - Selection info panel showing count and shortcuts
 * - Keyboard shortcuts guide panel
 * - Drag selected nodes to move them together
 */

"use client";

import React, { useCallback, useMemo, useEffect, useState } from "react";
import type { Circuit } from "../types/ir-v0.1";
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  Connection,
  NodeTypes,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCircuitStore } from "../stores/circuit-store";
import { useMetadataStore } from "../stores";
import { useSequentialStateStore } from "../stores/sequential-state-store";
import { usePortValuesStore } from "../stores/port-values-store";
import { useDSLPreviewStore } from "../stores/dsl-preview-store";
import { projectCircuitToReactFlow } from "../utils/projection";
import {
  InputNode,
  OutputNode,
  LogicGateNode,
  ScreenNode,
  RasterDisplayNode,
  RegisterNode,
  RAMNode,
} from "./nodes";
import { NumericInputNode } from "./nodes/NumericInputNode";
import { OrthogonalEdge } from "./edges";

// Define custom node types
const nodeTypes = {
  inputNode: InputNode,
  numericInputNode: NumericInputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  screenNode: ScreenNode,
  rasterDisplayNode: RasterDisplayNode,
  registerNode: RegisterNode,
  ramNode: RAMNode,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as NodeTypes;

// Define custom edge types
const edgeTypes = {
  orthogonal: OrthogonalEdge,
};

/**
 * SelectionInfo Component
 * Displays information about selected nodes and helpful shortcuts
 */
function SelectionInfo({ selectedCount }: { selectedCount: number }) {
  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="bg-white border-2 border-blue-400 rounded-lg shadow-lg px-4 py-2.5 min-w-[280px]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-semibold text-sm">
            {selectedCount}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              {selectedCount} component{selectedCount !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-gray-600">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                Delete
              </kbd>{" "}
              or{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                ⌫
              </kbd>{" "}
              to remove
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * KeyboardShortcutsInfo Component
 * Displays helpful keyboard shortcuts when no nodes are selected
 */
function KeyboardShortcutsInfo({ show }: { show: boolean }) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!show || !isVisible) return null;

  return (
    <div className="absolute top-6 right-6 z-10">
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 max-w-xs">
        <div className="flex items-start justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">
            Keyboard Shortcuts
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center justify-between gap-4">
            <span>Click node</span>
            <span className="text-gray-400">Select</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">
                Shift
              </kbd>{" "}
              + Click
            </span>
            <span className="text-gray-400">Multi-select</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Drag on canvas</span>
            <span className="text-gray-400">Box select</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">
                Delete
              </kbd>{" "}
              /{" "}
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">
                ⌫
              </kbd>
            </span>
            <span className="text-gray-400">Delete selected</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Hover node</span>
            <span className="text-gray-400">Show dependencies</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNodeCount, setSelectedNodeCount] = useState(0);

  // Subscribe to stores
  const circuit = useCircuitStore((state) => state.circuit);
  const metadataComponents = useMetadataStore((state) => state.components);
  const metadataConnections = useMetadataStore((state) => state.connections);
  const updateComponentPosition = useMetadataStore(
    (state) => state.updateComponentPosition,
  );
  const setComponentSelected = useMetadataStore(
    (state) => state.setComponentSelected,
  );
  const setConnectionSelected = useMetadataStore(
    (state) => state.setConnectionSelected,
  );
  const addConnection = useCircuitStore((state) => state.addConnection);
  const removeConnection = useCircuitStore((state) => state.removeConnection);
  const addNode = useCircuitStore((state) => state.addNode);
  const removeNode = useCircuitStore((state) => state.removeNode);
  const setComponentMetadata = useMetadataStore(
    (state) => state.setComponentMetadata,
  );
  const removeComponentMetadata = useMetadataStore(
    (state) => state.removeComponentMetadata,
  );

  // Get simulation state from stores (updated by controller)
  const seqState = useSequentialStateStore((state) => state.seqState);
  const portValues = usePortValuesStore((state) => state.portValues);

  const saveCurrentPositions = useDSLPreviewStore(
    (state) => state.saveCurrentPositions,
  );

  /**
   * ARCHITECTURE: Canvas is a VIEWER, not a SIMULATOR
   *
   * Canvas NEVER runs simulation. It only reads results from stores:
   * - usePortValuesStore: Wire values computed by orchestrator
   * - useSequentialStateStore: Register/RAM state computed by orchestrator
   *
   * The orchestrator (simulation/orchestrator.ts) is the ONLY place that executes simulation.
   *
   * This matches how real HDL simulators work:
   * - ModelSim/Verilator: Compute signals once
   * - GTKWave/Canvas: Read signals, never recompute
   */

  // Project Circuit + Metadata + Port Values to ReactFlow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const metadataState = {
      components: metadataComponents,
      connections: metadataConnections,
    };
    return projectCircuitToReactFlow(
      circuit,
      metadataState,
      portValues,
      seqState ?? undefined,
    );
  }, [circuit, metadataComponents, metadataConnections, portValues, seqState]);

  // Handle node position changes (drag), selection, and deletion
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          // Update position during drag for smooth visual feedback
          updateComponentPosition(change.id, change.position);
        } else if (change.type === "select") {
          // Update selection state in metadata store
          setComponentSelected(change.id, change.selected);
        } else if (change.type === "remove") {
          // Remove node from both stores
          removeNode(change.id);
          removeComponentMetadata(change.id);
        }
      });
    },
    [
      updateComponentPosition,
      setComponentSelected,
      removeNode,
      removeComponentMetadata,
    ],
  );

  // Update selection count whenever nodes change
  useEffect(() => {
    const count = nodes.filter((node) => node.selected).length;
    setSelectedNodeCount(count);
  }, [nodes]);

  // Keyboard input handling - Latching Scan Code Register
  // Models a hardware keyboard buffer register (like 8042 keyboard controller output buffer)
  //
  // Hardware behavior:
  // - Controller generates scan code on key press
  // - Scan code written to memory-mapped register (Input node)
  // - Register latches value until next key press (no automatic clear)
  // - CPU polls register to read current scan code
  //
  // This is architecturally honest because:
  // - Real keyboard controllers store last scan code in buffer
  // - No magic state tracking - just write-on-press
  // - Circuit reads scan code via Input node (memory-mapped I/O)
  // - Example: IBM PC/AT 8042 controller, C64 keyboard buffer
  useEffect(() => {
    if (!circuit) return;

    // Virtual keyboard scan codes (single-byte values)
    // Based on PC/AT scan codes but simplified
    const SCAN_CODES: Record<string, number> = {
      // Arrow keys (extended keys in real hardware, simplified here)
      ArrowUp: 0x48,
      ArrowDown: 0x50,
      ArrowLeft: 0x4b,
      ArrowRight: 0x4d,

      // Common keys
      Space: 0x39,
      Enter: 0x1c,
      Escape: 0x01,

      // Letters (physical key positions)
      KeyA: 0x1e,
      KeyB: 0x30,
      KeyC: 0x2e,
      KeyD: 0x20,
      KeyE: 0x12,
      KeyF: 0x21,
      KeyG: 0x22,
      KeyH: 0x23,
      KeyI: 0x17,
      KeyJ: 0x24,
      KeyK: 0x25,
      KeyL: 0x26,
      KeyM: 0x32,
      KeyN: 0x31,
      KeyO: 0x18,
      KeyP: 0x19,
      KeyQ: 0x10,
      KeyR: 0x13,
      KeyS: 0x1f,
      KeyT: 0x14,
      KeyU: 0x16,
      KeyV: 0x2f,
      KeyW: 0x11,
      KeyX: 0x2d,
      KeyY: 0x15,
      KeyZ: 0x2c,

      // Numbers (top row)
      Digit0: 0x0b,
      Digit1: 0x02,
      Digit2: 0x03,
      Digit3: 0x04,
      Digit4: 0x05,
      Digit5: 0x06,
      Digit6: 0x07,
      Digit7: 0x08,
      Digit8: 0x09,
      Digit9: 0x0a,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if not typing in text fields
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Get scan code for the pressed key (using e.code for physical position)
      const scanCode = SCAN_CODES[e.code];
      if (scanCode == null) return; // Unknown key

      // Find Input nodes that are keyboard registers
      // Convention: label or ID contains "keyboard" (case insensitive)
      const keyboardNodes = circuit.nodes.filter(
        (node) =>
          node.componentRef === "Input" &&
          (node.label?.toLowerCase().includes("keyboard") ||
            node.id.toLowerCase().includes("keyboard")),
      );

      // Write scan code to all keyboard registers (latching behavior)
      // Like a hardware write to memory-mapped I/O port
      // Value persists until next key press (no automatic clear on key up)
      keyboardNodes.forEach((node) => {
        const currentNode = useCircuitStore.getState().getNode(node.id);
        if (currentNode) {
          useCircuitStore.getState().updateNode(node.id, {
            arguments: { ...currentNode.arguments, value: scanCode },
          });
        }
      });

      // Prevent default browser behavior for arrow keys (scrolling)
      if (e.code.startsWith("Arrow")) {
        e.preventDefault();
      }
    };

    // Note: No keyup handler - register latches value until overwritten
    // This models real keyboard buffer behavior (IBM PC, C64, etc.)

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [circuit]);

  // Handle edge changes (selection and deletion)
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "select") {
          // Update selection state in metadata store
          setConnectionSelected(change.id, change.selected);
        } else if (change.type === "remove") {
          // Remove connection from CircuitStore
          removeConnection(change.id);
        }
      });
    },
    [setConnectionSelected, removeConnection],
  );

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return;
      }

      // Parse port names from handle IDs (format: "out-portName", "in-portName")
      const sourcePortName = connection.sourceHandle.replace("out-", "");
      const targetPortName = connection.targetHandle.replace("in-", "");

      // Create PortPath objects
      const source = { nodeId: connection.source, portName: sourcePortName };
      const target = { nodeId: connection.target, portName: targetPortName };

      // Add connection to CircuitStore
      addConnection(source, target);
    },
    [addConnection],
  );

  // Handle canvas drop for new components
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const componentType = event.dataTransfer.getData("application/reactflow");
      if (!componentType) return;

      // Convert screen position to flow position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Add node to CircuitStore
      const nodeId = addNode(componentType);

      // Add metadata with drop position
      setComponentMetadata(nodeId, {
        id: nodeId,
        position,
      });
    },
    [screenToFlowPosition, addNode, setComponentMetadata],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Save positions to localStorage when dragging stops
  const onNodeDragStop = useCallback(() => {
    saveCurrentPositions();
  }, [saveCurrentPositions]);

  return (
    <div
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // Selection and deletion settings
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={true}
        panOnDrag={[1, 2]} // Pan with middle and right mouse button
        selectionMode={SelectionMode.Partial} // Select nodes when selection box partially overlaps
        // Interaction settings
        selectNodesOnDrag={false}
        // Hide React Flow attribution
        // proOptions={{ hideAttribution: true }}
        // Styling
        className="bg-gray-50"
      >
        <Background />
        <Controls />
      </ReactFlow>

      {/* Selection Info Panel - shown when nodes are selected */}
      <SelectionInfo selectedCount={selectedNodeCount} />

      {/* Keyboard Shortcuts Info - shown when canvas has components but none selected */}
      <KeyboardShortcutsInfo
        show={nodes.length > 0 && selectedNodeCount === 0}
      />
    </div>
  );
}
