/**
 * Canvas Component
 *
 * Main ReactFlow canvas for the visual editor.
 * Handles node/edge rendering, drag-and-drop, and connections.
 */

'use client';

import React, { useCallback, useMemo, useEffect } from 'react';
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

export function Canvas() {
  const { screenToFlowPosition } = useReactFlow();

  // Subscribe to stores - select values separately to avoid creating new objects on every render
  const irComponents = useIRStore((state) => state.components);
  const irConnections = useIRStore((state) => state.connections);
  const metadataComponents = useMetadataStore((state) => state.components);
  const metadataConnections = useMetadataStore((state) => state.connections);
  const updateComponentPosition = useMetadataStore((state) => state.updateComponentPosition);
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

  // Handle node position changes (drag) and deletion
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          // Update position during drag for smooth visual feedback
          updateComponentPosition(change.id, change.position);
        } else if (change.type === 'remove') {
          // Remove component from both stores
          removeComponent(change.id);
          removeComponentMetadata(change.id);
        }
      });
    },
    [updateComponentPosition, removeComponent, removeComponentMetadata]
  );

  // Handle edge changes (deletion)
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeConnection(change.id);
        }
      });
    },
    [removeConnection]
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
    <div className="h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
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
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
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
    </div>
  );
}
