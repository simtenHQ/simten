/**
 * Canvas Component
 *
 * Thin wrapper around CircuitCanvas that wires editor stores to the shared canvas.
 * All rendering, projection, and ReactFlow integration lives in CircuitCanvas.
 * This component is responsible for:
 * - Reading from editor stores (circuit, metadata, simulation state)
 * - Wiring editing callbacks to store mutations
 * - Keyboard scan code handling for Input nodes
 * - Overlay UI (SelectionInfo, KeyboardShortcutsInfo)
 */

"use client";

import React, { useCallback, useMemo, useEffect } from "react";

import { useCircuitStore } from "../stores/circuit-store";
import { useMetadataStore } from "../stores";
import { useSequentialStateStore } from "../stores/sequential-state-store";
import { usePortValuesStore } from "../stores/port-values-store";
import { useDSLPreviewStore } from "../stores/dsl-preview-store";

import { CircuitCanvas } from "../../shared/CircuitCanvas";
import { FULL_NODE_TYPES, EDGE_TYPES } from "../../shared/node-types";

// ---------------------------------------------------------------------------
// Overlay components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Canvas wrapper
// ---------------------------------------------------------------------------

interface CanvasProps {
  renderEmptyState?: () => React.ReactNode;
}

export function Canvas({ renderEmptyState }: CanvasProps) {
  // --- Store reads ---
  const circuit = useCircuitStore((state) => state.circuit);
  const metadataComponents = useMetadataStore((state) => state.components);
  const metadataConnections = useMetadataStore((state) => state.connections);
  const seqState = useSequentialStateStore((state) => state.seqState);
  const portValues = usePortValuesStore((state) => state.portValues);

  // --- Store write actions ---
  const updateComponentPosition = useMetadataStore((state) => state.updateComponentPosition);
  const setComponentSelected = useMetadataStore((state) => state.setComponentSelected);
  const setConnectionSelected = useMetadataStore((state) => state.setConnectionSelected);
  const addConnection = useCircuitStore((state) => state.addConnection);
  const removeConnection = useCircuitStore((state) => state.removeConnection);
  const addNode = useCircuitStore((state) => state.addNode);
  const removeNode = useCircuitStore((state) => state.removeNode);
  const setComponentMetadata = useMetadataStore((state) => state.setComponentMetadata);
  const removeComponentMetadata = useMetadataStore((state) => state.removeComponentMetadata);
  const saveCurrentPositions = useDSLPreviewStore((state) => state.saveCurrentPositions);

  // --- Derived state ---
  const metadata = useMemo(() => ({
    components: metadataComponents,
    connections: metadataConnections,
  }), [metadataComponents, metadataConnections]);

  const hasNodes = (circuit?.nodes?.length ?? 0) > 0;

  // Track selected node count from metadata store
  const selectedNodeCount = useMemo(() => {
    return Object.values(metadataComponents).filter(c => c.selected).length;
  }, [metadataComponents]);

  // --- Editing callbacks ---

  const handleNodesDelete = useCallback(
    (nodeIds: string[]) => {
      for (const id of nodeIds) {
        removeNode(id);
        removeComponentMetadata(id);
      }
    },
    [removeNode, removeComponentMetadata],
  );

  const handleEdgesDelete = useCallback(
    (edgeIds: string[]) => {
      for (const id of edgeIds) {
        removeConnection(id);
      }
    },
    [removeConnection],
  );

  const handleConnect = useCallback(
    (source: { nodeId: string; portName: string }, target: { nodeId: string; portName: string }) => {
      addConnection(source, target);
    },
    [addConnection],
  );

  const handleDrop = useCallback(
    (componentType: string, position: { x: number; y: number }) => {
      const nodeId = addNode(componentType);
      setComponentMetadata(nodeId, { id: nodeId, position });
    },
    [addNode, setComponentMetadata],
  );

  // --- Keyboard scan code handler ---
  useEffect(() => {
    if (!circuit) return;

    const SCAN_CODES: Record<string, number> = {
      ArrowUp: 0x48, ArrowDown: 0x50, ArrowLeft: 0x4b, ArrowRight: 0x4d,
      Space: 0x39, Enter: 0x1c, Escape: 0x01,
      KeyA: 0x1e, KeyB: 0x30, KeyC: 0x2e, KeyD: 0x20, KeyE: 0x12,
      KeyF: 0x21, KeyG: 0x22, KeyH: 0x23, KeyI: 0x17, KeyJ: 0x24,
      KeyK: 0x25, KeyL: 0x26, KeyM: 0x32, KeyN: 0x31, KeyO: 0x18,
      KeyP: 0x19, KeyQ: 0x10, KeyR: 0x13, KeyS: 0x1f, KeyT: 0x14,
      KeyU: 0x16, KeyV: 0x2f, KeyW: 0x11, KeyX: 0x2d, KeyY: 0x15,
      KeyZ: 0x2c,
      Digit0: 0x0b, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04,
      Digit4: 0x05, Digit5: 0x06, Digit6: 0x07, Digit7: 0x08,
      Digit8: 0x09, Digit9: 0x0a,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const scanCode = SCAN_CODES[e.code];
      if (scanCode == null) return;

      const keyboardNodes = circuit.nodes.filter(
        (node) =>
          node.componentRef === "Input" &&
          (node.label?.toLowerCase().includes("keyboard") ||
            node.id.toLowerCase().includes("keyboard")),
      );

      keyboardNodes.forEach((node) => {
        const currentNode = useCircuitStore.getState().getNode(node.id);
        if (currentNode) {
          useCircuitStore.getState().updateNode(node.id, {
            arguments: { ...currentNode.arguments, value: scanCode },
          });
        }
      });

      if (e.code.startsWith("Arrow")) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [circuit]);

  // --- Render ---

  return (
    <CircuitCanvas
      circuit={circuit}
      portValues={portValues}
      sequentialState={seqState}
      metadata={metadata}
      autoLayout={false}
      editable
      nodeTypes={FULL_NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      showControls
      theme="light"
      renderInspector={false}
      onNodePositionChange={updateComponentPosition}
      onNodeSelect={setComponentSelected}
      onNodesDelete={handleNodesDelete}
      onEdgeSelect={setConnectionSelected}
      onEdgesDelete={handleEdgesDelete}
      onConnect={handleConnect}
      onDrop={handleDrop}
      onNodeDragStop={saveCurrentPositions}
      renderEmptyState={renderEmptyState}
      renderOverlay={() => (
        <>
          <SelectionInfo selectedCount={selectedNodeCount} />
          <KeyboardShortcutsInfo
            show={hasNodes && selectedNodeCount === 0}
          />
        </>
      )}
    />
  );
}
