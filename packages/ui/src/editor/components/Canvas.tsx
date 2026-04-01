/**
 * Canvas Component
 *
 * Thin wrapper that reads from editor stores and passes props to the unified canvas.
 * All rendering lives in CircuitCanvas. This component handles:
 * - Reading from editor stores (circuit, simulation state)
 * - Keyboard scan code handling for Input nodes
 * - Overlay UI (KeyboardShortcutsInfo)
 */

"use client";

import React, { useCallback, useEffect } from "react";

import { useCircuitStore } from "../stores/circuit-store";
import { useSequentialStateStore } from "../stores/sequential-state-store";
import { usePortValuesStore } from "../stores/port-values-store";
import { useComponentLibraryStore } from "../stores/component-library-store";

import { CircuitCanvas, NODE_TYPES, EDGE_TYPES } from "../../canvas";

// ---------------------------------------------------------------------------
// Overlay components
// ---------------------------------------------------------------------------

function KeyboardShortcutsInfo({ show }: { show: boolean }) {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!show || !isVisible) return null;

  return (
    <div className="absolute top-6 right-6 z-10">
      <div className="bg-white dark:bg-[#1a1a1e] border-2 border-gray-300 dark:border-[#2a2a2e] rounded-lg shadow-lg p-4 max-w-xs">
        <div className="flex items-start justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Keyboard Shortcuts
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between gap-4">
            <span>Double-click composite</span>
            <span className="text-gray-400">Inspect internals</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Drag node</span>
            <span className="text-gray-400">Reposition</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Scroll / pinch</span>
            <span className="text-gray-400">Zoom</span>
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
  theme?: "light" | "dark";
  nodePositions?: Record<string, { x: number; y: number }>;
}

export function Canvas({ renderEmptyState, theme = "light", nodePositions }: CanvasProps) {
  const circuit = useCircuitStore((state) => state.circuit);
  const seqState = useSequentialStateStore((state) => state.seqState);
  const portValues = usePortValuesStore((state) => state.portValues);

  const hasNodes = (circuit?.nodes?.length ?? 0) > 0;
  const resolveComponent = useComponentLibraryStore((s) => s.resolveComponent);
  const getAllPrimitiveNames = useComponentLibraryStore((s) => s.getAllPrimitiveNames);

  // Adapt the store to the ComponentLibrary interface expected by the canvas
  const componentLibrary = React.useMemo(() => ({
    resolveComponent,
    getAllPrimitiveNames,
  }), [resolveComponent, getAllPrimitiveNames]);

  const handleToggleNode = useCallback((nodeId: string) => {
    const node = useCircuitStore.getState().getNode(nodeId);
    if (node) {
      const currentValue = node.arguments.value;
      useCircuitStore.getState().updateNode(nodeId, {
        arguments: { ...node.arguments, value: typeof currentValue === 'boolean' ? !currentValue : !currentValue },
      });
    }
  }, []);

  const handleSetNodeValue = useCallback((nodeId: string, value: number) => {
    const node = useCircuitStore.getState().getNode(nodeId);
    if (node) {
      useCircuitStore.getState().updateNode(nodeId, {
        arguments: { ...node.arguments, value },
      });
    }
  }, []);

  // Keyboard scan code handler for Input nodes
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
      if (activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA") return;

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

      if (e.code.startsWith("Arrow")) e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [circuit]);

  return (
    <CircuitCanvas
      circuit={circuit}
      componentLibrary={componentLibrary}
      portValues={portValues}
      sequentialState={seqState}
      onToggleNode={handleToggleNode}
      onSetNodeValue={handleSetNodeValue}
      autoLayout={nodePositions ? false : true}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      showControls
      theme={theme}
      renderEmptyState={renderEmptyState}
      {...(nodePositions ? { nodePositions } : {})}
      renderOverlay={() => (
        <KeyboardShortcutsInfo show={hasNodes} />
      )}
    />
  );
}
