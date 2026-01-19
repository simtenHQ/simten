/**
 * Projection Tests
 *
 * Tests for the projection layer that converts IR + Metadata + Library to ReactFlow nodes/edges
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { projectToNodes, projectToReactFlow } from './projection';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { bitType, type Circuit } from '../types/ir-v0.1';
import type { IRState, MetadataState } from '../types';

describe('Projection Layer', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
  });

  describe('projectToNodes', () => {
    it('should project primitive components with correct port counts', () => {
      const ir: IRState = {
        components: {
          'and1': {
            id: 'and1',
            type: 'AND_GATE',
            label: 'AND',
          },
          'not1': {
            id: 'not1',
            type: 'NOT_GATE',
          },
        },
        connections: {},
      };

      const metadata: MetadataState = {
        components: {
          'and1': {
            id: 'and1',
            position: { x: 100, y: 100 },
          },
          'not1': {
            id: 'not1',
            position: { x: 200, y: 200 },
          },
        },
        connections: {},
      };

      const nodes = projectToNodes(ir, metadata);

      expect(nodes).toHaveLength(2);

      const andNode = nodes.find(n => n.id === 'and1');
      expect(andNode).toBeDefined();
      expect(andNode?.data.inputCount).toBe(2);
      expect(andNode?.data.outputCount).toBe(1);

      const notNode = nodes.find(n => n.id === 'not1');
      expect(notNode).toBeDefined();
      expect(notNode?.data.inputCount).toBe(1);
      expect(notNode?.data.outputCount).toBe(1);
    });

    it('should project user-defined components with correct port counts', () => {
      // Create a user-defined MyAndGate circuit
      const myAndGate: Circuit = {
        id: 'my-and-gate',
        name: 'MyAndGate',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [
          { name: 'result', portType: bitType() },
        ],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      // Register it in the library
      library.registerUser(myAndGate);

      const ir: IRState = {
        components: {
          'myand1': {
            id: 'myand1',
            type: 'MyAndGate',
            label: 'My AND',
          },
        },
        connections: {},
      };

      const metadata: MetadataState = {
        components: {
          'myand1': {
            id: 'myand1',
            position: { x: 100, y: 100 },
          },
        },
        connections: {},
      };

      // Get the library fresh to ensure state is up to date
      const currentLibrary = useComponentLibraryStore.getState().library;
      const nodes = projectToNodes(ir, metadata, currentLibrary);

      expect(nodes).toHaveLength(1);

      const myAndNode = nodes[0];
      expect(myAndNode.data.componentType).toBe('MyAndGate');
      expect(myAndNode.data.inputCount).toBe(2); // Should detect 2 inputs (a, b)
      expect(myAndNode.data.outputCount).toBe(1); // Should detect 1 output (result)
    });

    it('should handle user-defined components with multiple outputs', () => {
      // Create a HalfAdder with 2 outputs
      const halfAdder: Circuit = {
        id: 'half-adder',
        name: 'HalfAdder',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [
          { name: 'sum', portType: bitType() },
          { name: 'carry', portType: bitType() },
        ],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      library.registerUser(halfAdder);

      const ir: IRState = {
        components: {
          'ha1': {
            id: 'ha1',
            type: 'HalfAdder',
          },
        },
        connections: {},
      };

      const metadata: MetadataState = {
        components: {
          'ha1': {
            id: 'ha1',
            position: { x: 0, y: 0 },
          },
        },
        connections: {},
      };

      const currentLibrary = useComponentLibraryStore.getState().library;
      const nodes = projectToNodes(ir, metadata, currentLibrary);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].data.inputCount).toBe(2);
      expect(nodes[0].data.outputCount).toBe(2); // Should have 2 outputs
    });

    it('should fallback to 0 ports for unknown component types', () => {
      const ir: IRState = {
        components: {
          'unknown1': {
            id: 'unknown1',
            type: 'UnknownComponent',
          },
        },
        connections: {},
      };

      const metadata: MetadataState = {
        components: {
          'unknown1': {
            id: 'unknown1',
            position: { x: 0, y: 0 },
          },
        },
        connections: {},
      };

      const currentLibrary = useComponentLibraryStore.getState().library;
      const nodes = projectToNodes(ir, metadata, currentLibrary);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].data.inputCount).toBe(0);
      expect(nodes[0].data.outputCount).toBe(0);
    });

    it('should assign logicGateNode type to user-defined components with inputs and outputs', () => {
      // Create a user-defined MyAndGate circuit
      const myAndGate: Circuit = {
        id: 'my-and-gate',
        name: 'MyAndGate',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [
          { name: 'result', portType: bitType() },
        ],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      library.registerUser(myAndGate);

      const ir: IRState = {
        components: {
          'myand1': {
            id: 'myand1',
            type: 'MyAndGate',
          },
        },
        connections: {},
      };

      const metadata: MetadataState = {
        components: {
          'myand1': {
            id: 'myand1',
            position: { x: 100, y: 100 },
          },
        },
        connections: {},
      };

      const currentLibrary = useComponentLibraryStore.getState().library;
      const nodes = projectToNodes(ir, metadata, currentLibrary);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('logicGateNode'); // Should be logic gate type
      expect(nodes[0].data.inputCount).toBe(2);
      expect(nodes[0].data.outputCount).toBe(1);
    });
  });

  describe('projectToReactFlow', () => {
    it('should project both primitive and user components correctly', () => {
      // Create a composite circuit that uses both
      const myGate: Circuit = {
        id: 'my-gate',
        name: 'MyGate',
        parameters: [],
        inputs: [{ name: 'in', portType: bitType() }],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      library.registerUser(myGate);

      const ir: IRState = {
        components: {
          'switch1': {
            id: 'switch1',
            type: 'SWITCH',
            value: false,
          },
          'mygate1': {
            id: 'mygate1',
            type: 'MyGate',
          },
          'led1': {
            id: 'led1',
            type: 'LED',
            value: false,
          },
        },
        connections: {
          'c1': {
            id: 'c1',
            sourceComponentId: 'switch1',
            sourcePortIndex: 0,
            targetComponentId: 'mygate1',
            targetPortIndex: 0,
          },
          'c2': {
            id: 'c2',
            sourceComponentId: 'mygate1',
            sourcePortIndex: 0,
            targetComponentId: 'led1',
            targetPortIndex: 0,
          },
        },
      };

      const metadata: MetadataState = {
        components: {
          'switch1': { id: 'switch1', position: { x: 0, y: 100 } },
          'mygate1': { id: 'mygate1', position: { x: 200, y: 100 } },
          'led1': { id: 'led1', position: { x: 400, y: 100 } },
        },
        connections: {
          'c1': { id: 'c1' },
          'c2': { id: 'c2' },
        },
      };

      const currentLibrary = useComponentLibraryStore.getState().library;
      const result = projectToReactFlow(ir, metadata, currentLibrary);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);

      // Verify switch ports
      const switchNode = result.nodes.find(n => n.id === 'switch1');
      expect(switchNode?.data.inputCount).toBe(0);
      expect(switchNode?.data.outputCount).toBe(1);

      // Verify user component ports
      const myGateNode = result.nodes.find(n => n.id === 'mygate1');
      expect(myGateNode?.data.inputCount).toBe(1);
      expect(myGateNode?.data.outputCount).toBe(1);

      // Verify LED ports
      const ledNode = result.nodes.find(n => n.id === 'led1');
      expect(ledNode?.data.inputCount).toBe(1);
      expect(ledNode?.data.outputCount).toBe(0);
    });
  });
});
