/**
 * Circuit Store Tests
 *
 * Tests for the IR v0.1 Circuit store implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCircuitStore } from './circuit-store';
import { useCircuitLibraryStore } from './circuit-library-store';
import type { Circuit } from '../types/circuit';
import { bitType, busType } from '../types/circuit';

describe('CircuitStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCircuitStore.setState({ circuit: null });

    // Set up a minimal component library for testing
    const library = useCircuitLibraryStore.getState();

    // Clear existing library
    library.clear();

    // Add a simple AND gate primitive for testing
    library.addCircuit({
      id: 'primitive_and',
      name: 'And',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
      ],
      outputs: [
        { name: 'out', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [],
      connections: [],
      implementation: { kind: 'primitive' },
    });

    // Add a simple LED output for testing
    library.addCircuit({
      id: 'primitive_led',
      name: 'Led',
      parameters: [],
      inputs: [
        { name: 'in', portType: bitType() },
      ],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [],
      connections: [],
      implementation: { kind: 'primitive' },
    });
  });

  describe('Circuit operations', () => {
    it('should set and get circuit', () => {
      const store = useCircuitStore.getState();

      const testCircuit: Circuit = {
        id: 'test1',
        name: 'TestCircuit',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      store.setCircuit(testCircuit);
      expect(store.getCircuit()).toEqual(testCircuit);
    });

    it('should clear circuit', () => {
      const store = useCircuitStore.getState();

      const testCircuit: Circuit = {
        id: 'test1',
        name: 'TestCircuit',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      store.setCircuit(testCircuit);
      expect(store.getCircuit()).not.toBeNull();

      store.clearCircuit();
      expect(store.getCircuit()).toBeNull();
    });
  });

  describe('Node operations', () => {
    beforeEach(() => {
      const store = useCircuitStore.getState();

      // Create an empty circuit for testing
      const testCircuit: Circuit = {
        id: 'test1',
        name: 'TestCircuit',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      store.setCircuit(testCircuit);
    });

    it('should add a node', () => {
      const store = useCircuitStore.getState();
      const nodeId = store.addNode('And');

      expect(nodeId).toBeTruthy();

      const node = store.getNode(nodeId);
      expect(node).toBeDefined();
      expect(node?.componentRef).toBe('And');
      expect(node?.inputs).toHaveLength(2);
      expect(node?.outputs).toHaveLength(1);
      expect(node?.inputs[0].name).toBe('a');
      expect(node?.inputs[1].name).toBe('b');
      expect(node?.outputs[0].name).toBe('out');
    });

    it('should add a node with arguments', () => {
      const store = useCircuitStore.getState();
      const nodeId = store.addNode('And', { width: 8 });

      const node = store.getNode(nodeId);
      expect(node?.arguments).toEqual({ width: 8 });
    });

    it('should remove a node', () => {
      const store = useCircuitStore.getState();
      const nodeId = store.addNode('And');

      expect(store.getNode(nodeId)).toBeDefined();

      store.removeNode(nodeId);
      expect(store.getNode(nodeId)).toBeUndefined();
    });

    it('should update a node', () => {
      const store = useCircuitStore.getState();
      const nodeId = store.addNode('And');

      store.updateNode(nodeId, { label: 'MyAndGate' });

      const node = store.getNode(nodeId);
      expect(node?.label).toBe('MyAndGate');
    });

    it('should get node input and output ports', () => {
      const store = useCircuitStore.getState();
      const nodeId = store.addNode('And');

      const inputPorts = store.getNodeInputPorts(nodeId);
      expect(inputPorts).toHaveLength(2);
      expect(inputPorts[0].name).toBe('a');
      expect(inputPorts[1].name).toBe('b');

      const outputPorts = store.getNodeOutputPorts(nodeId);
      expect(outputPorts).toHaveLength(1);
      expect(outputPorts[0].name).toBe('out');
    });
  });

  describe('Connection operations', () => {
    let andNodeId: string;
    let ledNodeId: string;

    beforeEach(() => {
      const store = useCircuitStore.getState();

      // Create an empty circuit for testing
      const testCircuit: Circuit = {
        id: 'test1',
        name: 'TestCircuit',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      store.setCircuit(testCircuit);

      // Add nodes for connection testing
      andNodeId = store.addNode('And');
      ledNodeId = store.addNode('Led');
    });

    it('should add a connection between nodes', () => {
      const store = useCircuitStore.getState();

      const connectionId = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(connectionId).toBeTruthy();

      const connection = store.getConnection(connectionId!);
      expect(connection).toBeDefined();
      expect(connection?.source.nodeId).toBe(andNodeId);
      expect(connection?.source.portName).toBe('out');
      expect(connection?.target.nodeId).toBe(ledNodeId);
      expect(connection?.target.portName).toBe('in');
    });

    it('should prevent duplicate connections', () => {
      const store = useCircuitStore.getState();

      const conn1Id = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      const conn2Id = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      // Should return existing connection ID
      expect(conn2Id).toBe(conn1Id);

      const circuit = store.getCircuit();
      expect(circuit?.connections).toHaveLength(1);
    });

    it('should prevent multiple connections to same target port', () => {
      const store = useCircuitStore.getState();
      const and2NodeId = store.addNode('And');

      const conn1Id = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      const conn2Id = store.addConnection(
        { nodeId: and2NodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(conn1Id).toBeTruthy();
      expect(conn2Id).toBeNull(); // Second connection should fail

      const circuit = store.getCircuit();
      expect(circuit?.connections).toHaveLength(1);
    });

    it('should remove a connection', () => {
      const store = useCircuitStore.getState();

      const connectionId = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(store.getConnection(connectionId!)).toBeDefined();

      store.removeConnection(connectionId!);
      expect(store.getConnection(connectionId!)).toBeUndefined();
    });

    it('should remove connections when node is removed', () => {
      const store = useCircuitStore.getState();

      const connectionId = store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(store.getConnection(connectionId!)).toBeDefined();

      store.removeNode(andNodeId);

      // Connection should be removed when source node is deleted
      expect(store.getConnection(connectionId!)).toBeUndefined();
    });

    it('should get node connections', () => {
      const store = useCircuitStore.getState();

      store.addConnection(
        { nodeId: andNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      const andConnections = store.getNodeConnections(andNodeId);
      expect(andConnections).toHaveLength(1);

      const ledConnections = store.getNodeConnections(ledNodeId);
      expect(ledConnections).toHaveLength(1);
    });

    it('should validate port existence before creating connection', () => {
      const store = useCircuitStore.getState();

      // Try to connect to non-existent port
      const connectionId = store.addConnection(
        { nodeId: andNodeId, portName: 'invalid_port' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(connectionId).toBeNull();
    });

    it('should validate port type compatibility', () => {
      const store = useCircuitStore.getState();
      const library = useCircuitLibraryStore.getState();

      // Add a bus component
      library.addCircuit({
        id: 'primitive_bus_source',
        name: 'BusSource',
        parameters: [],
        inputs: [],
        outputs: [
          { name: 'out', portType: busType(8) },
        ],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'primitive' },
      });

      const busNodeId = store.addNode('BusSource');

      // Try to connect bus to bit port (should fail)
      const connectionId = store.addConnection(
        { nodeId: busNodeId, portName: 'out' },
        { nodeId: ledNodeId, portName: 'in' }
      );

      expect(connectionId).toBeNull();
    });
  });
});
