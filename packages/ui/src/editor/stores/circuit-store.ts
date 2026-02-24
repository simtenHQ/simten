/**
 * Circuit Store - IR v0.1 State Management
 *
 * This store manages the Circuit (IR v0.1) format, which uses name-based ports
 * and provides the canonical representation for the visual editor.
 *
 * Migration note: This replaces the legacy ir-store.ts which used index-based ports.
 * During migration, both stores coexist with conversion between formats.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  Circuit,
  Node,
  Connection,
  PortPath,
  PortDescriptor,
  ArgumentValue,
} from '../types/circuit';
import { useComponentLibraryStore } from './component-library-store';

interface CircuitActions {
  // Circuit-level operations
  setCircuit: (circuit: Circuit) => void;
  clearCircuit: () => void;
  getCircuit: () => Circuit | null;

  // Node operations
  addNode: (componentRef: string, args?: Record<string, ArgumentValue>) => string;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  getNode: (nodeId: string) => Node | undefined;

  // Connection operations
  addConnection: (source: PortPath, target: PortPath) => string | null;
  removeConnection: (connectionId: string) => void;
  getConnection: (connectionId: string) => Connection | undefined;
  getNodeConnections: (nodeId: string) => Connection[];

  // Port operations
  getNodeOutputPorts: (nodeId: string) => PortDescriptor[];
  getNodeInputPorts: (nodeId: string) => PortDescriptor[];
}

export interface CircuitStore extends CircuitActions {
  circuit: Circuit | null;
}

const initialState = {
  circuit: null,
};

export const useCircuitStore = create<CircuitStore>()(
  immer((set, get) => ({
    ...initialState,

    setCircuit: (circuit) => {
      set({ circuit });
    },

    clearCircuit: () => {
      set({ circuit: null });
    },

    getCircuit: () => {
      return get().circuit;
    },

    addNode: (componentRef, args = {}) => {
      const nodeId = nanoid();

      set((state) => {
        // Auto-create empty circuit if it doesn't exist
        if (!state.circuit) {
          state.circuit = {
            id: nanoid(),
            name: 'Untitled Circuit',
            parameters: [],
            inputs: [],
            outputs: [],
            clocks: [],
            state: [],
            nodes: [],
            connections: [],
            implementation: { kind: 'composite' },
          };
        }

        // Resolve component to get its port definitions
        const library = useComponentLibraryStore.getState();
        const component = library.resolveComponent(componentRef);

        if (!component) {
          console.warn(`Component not found: ${componentRef}`);
          return;
        }

        // Create port instances from component definition
        const inputs = component.inputs.map((portDesc) => ({
          id: `${nodeId}.${portDesc.name}`,
          name: portDesc.name,
          portType: portDesc.portType,
        }));

        const outputs = component.outputs.map((portDesc) => ({
          id: `${nodeId}.${portDesc.name}`,
          name: portDesc.name,
          portType: portDesc.portType,
        }));

        const clocks = component.clocks.map((clockDesc) => ({
          id: `${nodeId}.${clockDesc.name}`,
          name: clockDesc.name,
        }));

        const node: Node = {
          id: nodeId,
          label: componentRef,
          componentRef,
          arguments: args,
          inputs,
          outputs,
          clocks,
        };

        state.circuit.nodes.push(node);
      });

      return nodeId;
    },

    removeNode: (nodeId) => {
      set((state) => {
        if (!state.circuit) return;

        // Remove the node
        state.circuit.nodes = state.circuit.nodes.filter((n) => n.id !== nodeId);

        // Remove all connections involving this node
        state.circuit.connections = state.circuit.connections.filter(
          (conn) => conn.source.nodeId !== nodeId && conn.target.nodeId !== nodeId
        );
      });
    },

    updateNode: (nodeId, updates) => {
      set((state) => {
        if (!state.circuit) return;

        const node = state.circuit.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      });
    },

    getNode: (nodeId) => {
      const circuit = get().circuit;
      if (!circuit) return undefined;
      return circuit.nodes.find((n) => n.id === nodeId);
    },

    addConnection: (source, target) => {
      const circuit = get().circuit;
      if (!circuit) {
        console.warn('Cannot add connection: no circuit loaded');
        return null;
      }

      // Validation: check if source node exists
      const sourceNode = circuit.nodes.find((n) => n.id === source.nodeId);
      if (!sourceNode && source.nodeId !== '') {
        console.warn(`Source node not found: ${source.nodeId}`);
        return null;
      }

      // Validation: check if target node exists
      const targetNode = circuit.nodes.find((n) => n.id === target.nodeId);
      if (!targetNode && target.nodeId !== '') {
        console.warn(`Target node not found: ${target.nodeId}`);
        return null;
      }

      // Validation: check if source port exists
      let sourcePort;
      if (source.nodeId === '') {
        // Circuit-level input port
        sourcePort = circuit.inputs.find((p) => p.name === source.portName);
      } else {
        sourcePort = sourceNode?.outputs.find((p) => p.name === source.portName);
      }
      if (!sourcePort) {
        console.warn(`Source port not found: ${source.nodeId}.${source.portName}`);
        return null;
      }

      // Validation: check if target port exists
      let targetPort;
      if (target.nodeId === '') {
        // Circuit-level output port
        targetPort = circuit.outputs.find((p) => p.name === target.portName);
      } else {
        targetPort = targetNode?.inputs.find((p) => p.name === target.portName);
      }
      if (!targetPort) {
        console.warn(`Target port not found: ${target.nodeId}.${target.portName}`);
        return null;
      }

      // Validation: check if connection already exists
      const existingConnection = circuit.connections.find(
        (conn) =>
          conn.source.nodeId === source.nodeId &&
          conn.source.portName === source.portName &&
          conn.target.nodeId === target.nodeId &&
          conn.target.portName === target.portName
      );

      if (existingConnection) {
        console.warn('Connection already exists');
        return existingConnection.id;
      }

      // Validation: check if target port is already connected
      const targetAlreadyConnected = circuit.connections.some(
        (conn) => conn.target.nodeId === target.nodeId && conn.target.portName === target.portName
      );

      if (targetAlreadyConnected) {
        console.warn(`Target port already connected: ${target.nodeId}.${target.portName}`);
        return null;
      }

      // Validation: check port type compatibility
      if (sourcePort.portType.kind !== targetPort.portType.kind) {
        console.warn(
          `Port type mismatch: ${sourcePort.portType.kind} -> ${targetPort.portType.kind}`
        );
        return null;
      }

      if (
        sourcePort.portType.kind === 'bus' &&
        targetPort.portType.kind === 'bus' &&
        sourcePort.portType.width !== targetPort.portType.width
      ) {
        console.warn(
          `Bus width mismatch: ${sourcePort.portType.width} -> ${targetPort.portType.width}`
        );
        return null;
      }

      const connectionId = nanoid();
      set((state) => {
        if (!state.circuit) return;

        state.circuit.connections.push({
          id: connectionId,
          source,
          target,
          portType: sourcePort.portType,
        });
      });

      return connectionId;
    },

    removeConnection: (connectionId) => {
      set((state) => {
        if (!state.circuit) return;

        state.circuit.connections = state.circuit.connections.filter((c) => c.id !== connectionId);
      });
    },

    getConnection: (connectionId) => {
      const circuit = get().circuit;
      if (!circuit) return undefined;
      return circuit.connections.find((c) => c.id === connectionId);
    },

    getNodeConnections: (nodeId) => {
      const circuit = get().circuit;
      if (!circuit) return [];
      return circuit.connections.filter(
        (conn) => conn.source.nodeId === nodeId || conn.target.nodeId === nodeId
      );
    },

    getNodeOutputPorts: (nodeId) => {
      const node = get().getNode(nodeId);
      if (!node) return [];
      return node.outputs.map((p) => ({
        name: p.name,
        portType: p.portType,
      }));
    },

    getNodeInputPorts: (nodeId) => {
      const node = get().getNode(nodeId);
      if (!node) return [];
      return node.inputs.map((p) => ({
        name: p.name,
        portType: p.portType,
      }));
    },
  }))
);
