/**
 * Canvas Component
 *
 * Main ReactFlow canvas for the visual editor.
 * Handles node/edge rendering, drag-and-drop, connections, and interactions.
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

'use client';

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  Connection,
  NodeTypes,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useIRStore, useMetadataStore } from '../stores';
import { projectToReactFlow } from '../utils/projection';
import { InputNode, OutputNode, LogicGateNode } from './nodes';
import { OrthogonalEdge } from './edges';
import { runSimulationStep } from '../utils/simulator';

// Define custom node types
const nodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
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
              {selectedCount} component{selectedCount !== 1 ? 's' : ''} selected
            </div>
            <div className="text-xs text-gray-600">
              Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Delete</kbd> or{' '}
              <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">⌫</kbd> to remove
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
          <div className="text-sm font-semibold text-gray-900">Keyboard Shortcuts</div>
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
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">Shift</kbd> + Click
            </span>
            <span className="text-gray-400">Multi-select</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Drag on canvas</span>
            <span className="text-gray-400">Box select</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">Delete</kbd> /{' '}
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[10px]">⌫</kbd>
            </span>
            <span className="text-gray-400">Delete selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNodeCount, setSelectedNodeCount] = useState(0);

  // Subscribe to stores - select values separately to avoid creating new objects on every render
  const irComponents = useIRStore((state) => state.components);
  const irConnections = useIRStore((state) => state.connections);
  const metadataComponents = useMetadataStore((state) => state.components);
  const metadataConnections = useMetadataStore((state) => state.connections);
  const updateComponentPosition = useMetadataStore((state) => state.updateComponentPosition);
  const setComponentSelected = useMetadataStore((state) => state.setComponentSelected);
  const setConnectionSelected = useMetadataStore((state) => state.setConnectionSelected);
  const updateComponent = useIRStore((state) => state.updateComponent);
  const addConnection = useIRStore((state) => state.addConnection);
  const removeConnection = useIRStore((state) => state.removeConnection);
  const addComponent = useIRStore((state) => state.addComponent);
  const removeComponent = useIRStore((state) => state.removeComponent);
  const setComponentMetadata = useMetadataStore((state) => state.setComponentMetadata);
  const removeComponentMetadata = useMetadataStore((state) => state.removeComponentMetadata);

  // Track switch values to only run simulation when inputs change
  const switchValuesKey = useMemo(() => {
    const switches = Object.entries(irComponents)
      .filter(([_, comp]) => comp.type === 'SWITCH')
      .map(([id, comp]) => `${id}:${'value' in comp ? comp.value : false}`)
      .sort()
      .join(',');
    return switches;
  }, [irComponents]);

  const connectionsKey = useMemo(() => {
    return Object.keys(irConnections).sort().join(',');
  }, [irConnections]);

  // Auto-run simulation whenever switches or connections change
  useEffect(() => {
    if (Object.keys(irComponents).length === 0) return;

    // Run simulation step
    const updatedIR = runSimulationStep({ components: irComponents, connections: irConnections });

    // Update component values in the store (batch updates)
    const updates: Array<{ id: string; value: boolean }> = [];
    Object.entries(updatedIR.components).forEach(([id, component]) => {
      if ('value' in component) {
        const currentComponent = irComponents[id];
        const currentValue = currentComponent && 'value' in currentComponent ? currentComponent.value : undefined;

        // Only update if value changed
        if (currentValue !== component.value) {
          updates.push({ id, value: component.value });
        }
      }
    });

    // Apply all updates
    updates.forEach(({ id, value }) => {
      updateComponent(id, { value });
    });
  }, [switchValuesKey, connectionsKey]); // Only depend on switches and connections, not all components

  // Project IR + Metadata to ReactFlow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const irState = { components: irComponents, connections: irConnections };
    const metadataState = { components: metadataComponents, connections: metadataConnections };
    return projectToReactFlow(irState, metadataState);
  }, [irComponents, irConnections, metadataComponents, metadataConnections]);

  // Handle node position changes (drag), selection, and deletion
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          // Update position during drag for smooth visual feedback
          updateComponentPosition(change.id, change.position);
        } else if (change.type === 'select') {
          // Update selection state in metadata store
          setComponentSelected(change.id, change.selected);
        } else if (change.type === 'remove') {
          // Remove component from both stores
          removeComponent(change.id);
          removeComponentMetadata(change.id);
        }
      });
    },
    [updateComponentPosition, setComponentSelected, removeComponent, removeComponentMetadata]
  );

  // Update selection count whenever nodes change
  useEffect(() => {
    const count = nodes.filter((node) => node.selected).length;
    setSelectedNodeCount(count);
  }, [nodes]);

  // Handle edge changes (selection and deletion)
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'select') {
          // Update selection state in metadata store
          setConnectionSelected(change.id, change.selected);
        } else if (change.type === 'remove') {
          // Remove connection from IR store (metadata will be cleaned up separately)
          removeConnection(change.id);
        }
      });
    },
    [setConnectionSelected, removeConnection]
  );

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
        return;
      }

      // Parse port indices from handle IDs
      const sourcePortIndex = parseInt(connection.sourceHandle.replace('out-', ''));
      const targetPortIndex = parseInt(connection.targetHandle.replace('in-', ''));

      // Add connection to IR store
      addConnection(connection.source, sourcePortIndex, connection.target, targetPortIndex);
    },
    [addConnection]
  );

  // Handle canvas drop for new components
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const componentType = event.dataTransfer.getData('application/reactflow');
      if (!componentType) return;

      // Convert screen position to flow position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Add component to IR
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const componentId = addComponent(componentType as any);

      // Add metadata with drop position
      setComponentMetadata(componentId, {
        id: componentId,
        position,
      });
    },
    [screenToFlowPosition, addComponent, setComponentMetadata]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // Selection and deletion settings
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={true}
        panOnDrag={[1, 2]} // Pan with middle and right mouse button
        selectionMode={SelectionMode.Partial} // Select nodes when selection box partially overlaps
        // Interaction settings
        selectNodesOnDrag={false}
        // Styling
        className="bg-gray-50"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'inputNode':
                return '#22c55e'; // green
              case 'outputNode':
                return '#3b82f6'; // blue
              case 'logicGateNode':
                return '#f59e0b'; // amber
              default:
                return '#6b7280'; // gray
            }
          }}
        />
      </ReactFlow>

      {/* Selection Info Panel - shown when nodes are selected */}
      <SelectionInfo selectedCount={selectedNodeCount} />

      {/* Keyboard Shortcuts Info - shown when canvas has components but none selected */}
      <KeyboardShortcutsInfo show={nodes.length > 0 && selectedNodeCount === 0} />
    </div>
  );
}
