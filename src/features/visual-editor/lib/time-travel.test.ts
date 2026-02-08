import { describe, it, expect } from 'vitest';
import {
  captureEnvironmentalState,
  restoreEnvironmentalState,
  createSnapshot,
} from './time-travel';
import type { Node } from '../types/ir-v0.1';
import type { FlatSequentialState as SequentialState } from './flat-simulator';
import type { EnvironmentalStateValue } from '../types/simulation-snapshot';

describe('time-travel', () => {
  // Helper to create minimal test circuits (bypasses full type checking for testing)
  const createTestCircuit = (nodes: any[]): any => {
    return {
      id: 'test',
      name: 'Test',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.id,
        componentRef: n.componentRef,
        arguments: n.arguments,
        inputs: [],
        outputs: [],
        clocks: [],
      })),
      connections: [],
      implementation: { kind: 'composite' },
    };
  };

  describe('captureEnvironmentalState', () => {
    it('should capture state from Switch components', () => {
      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: true } },
      ]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(1);
      expect(envState.get('switch1')).toBe(true);
    });

    it('should capture state from Button components', () => {
      const circuit = createTestCircuit([
        { id: 'button1', componentRef: 'Button', arguments: { value: false } },
      ]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(1);
      expect(envState.get('button1')).toBe(false);
    });

    it('should capture state from Input components', () => {
      const circuit = createTestCircuit([
        { id: 'input1', componentRef: 'Input', arguments: { value: 42 } },
      ]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(1);
      expect(envState.get('input1')).toBe(42);
    });

    it('should capture state from multiple environmental components', () => {
      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: true } },
        { id: 'input1', componentRef: 'Input', arguments: { value: 100 } },
        { id: 'button1', componentRef: 'Button', arguments: { value: false } },
      ]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(3);
      expect(envState.get('switch1')).toBe(true);
      expect(envState.get('input1')).toBe(100);
      expect(envState.get('button1')).toBe(false);
    });

    it('should not capture state from non-environmental components', () => {
      const circuit = createTestCircuit([
        { id: 'register1', componentRef: 'Register', arguments: { initial: 0 } },
        { id: 'and1', componentRef: 'And', arguments: {} },
      ]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(0);
    });

    it('should return empty map for circuit with no environmental components', () => {
      const circuit = createTestCircuit([]);

      const envState = captureEnvironmentalState(circuit);

      expect(envState.size).toBe(0);
      expect(envState).toBeInstanceOf(Map);
    });
  });

  describe('restoreEnvironmentalState', () => {
    it('should restore state to Switch components', () => {
      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: false } },
      ]);

      const envState = new Map<string, EnvironmentalStateValue>([['switch1', true]]);

      const updateNode = (nodeId: string, updates: Partial<Node>) => {
        const node = circuit.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      };

      restoreEnvironmentalState(circuit, envState, updateNode);

      expect(circuit.nodes[0].arguments.value).toBe(true);
    });

    it('should restore state to multiple components', () => {
      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: false } },
        { id: 'input1', componentRef: 'Input', arguments: { value: 0 } },
      ]);

      const envState = new Map<string, EnvironmentalStateValue>([
        ['switch1', true],
        ['input1', 42],
      ]);

      const updateNode = (nodeId: string, updates: Partial<Node>) => {
        const node = circuit.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      };

      restoreEnvironmentalState(circuit, envState, updateNode);

      expect(circuit.nodes[0].arguments.value).toBe(true);
      expect(circuit.nodes[1].arguments.value).toBe(42);
    });

    it('should handle missing nodes gracefully', () => {
      const circuit = createTestCircuit([]);

      const envState = new Map<string, EnvironmentalStateValue>([['switch1', true]]);

      const updateNode = (nodeId: string, updates: Partial<Node>) => {
        const node = circuit.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      };

      // Should not throw
      expect(() => {
        restoreEnvironmentalState(circuit, envState, updateNode);
      }).not.toThrow();
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot with sequential state', () => {
      const seqState: SequentialState = {
        currentState: new Map([['reg1', 42]]),
        nextState: new Map([['reg1', 43]]),
        clocks: new Map([['clk', { value: true, edge: 'rising' }]]),
        cycleCount: 10,
      };

      const circuit = createTestCircuit([]);

      const snapshot = createSnapshot(seqState, circuit);

      expect(snapshot.cycleNumber).toBe(10);
      expect(snapshot.sequentialState.cycleCount).toBe(10);
      expect(snapshot.sequentialState.currentState.get('reg1')).toBe(42);
      expect(snapshot.sequentialState.nextState.get('reg1')).toBe(43);
      expect(snapshot.sequentialState.clocks.get('clk')).toEqual({ value: true, edge: 'rising' });
      expect(snapshot.environmentalState.size).toBe(0);
    });

    it('should create snapshot with environmental state', () => {
      const seqState: SequentialState = {
        currentState: new Map(),
        nextState: new Map(),
        clocks: new Map(),
        cycleCount: 5,
      };

      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: true } },
      ]);

      const snapshot = createSnapshot(seqState, circuit);

      expect(snapshot.cycleNumber).toBe(5);
      expect(snapshot.environmentalState.size).toBe(1);
      expect(snapshot.environmentalState.get('switch1')).toBe(true);
    });

    it('should deep clone sequential state Maps', () => {
      const seqState: SequentialState = {
        currentState: new Map([['reg1', 10]]),
        nextState: new Map([['reg1', 11]]),
        clocks: new Map([['clk', { value: false, edge: 'none' }]]),
        cycleCount: 0,
      };

      const circuit = createTestCircuit([]);

      const snapshot = createSnapshot(seqState, circuit);

      // Modify original state
      seqState.currentState.set('reg1', 999);
      seqState.nextState.set('reg1', 999);
      seqState.clocks.set('clk', { value: true, edge: 'rising' });

      // Snapshot should be unchanged (deep clone)
      expect(snapshot.sequentialState.currentState.get('reg1')).toBe(10);
      expect(snapshot.sequentialState.nextState.get('reg1')).toBe(11);
      expect(snapshot.sequentialState.clocks.get('clk')).toEqual({ value: false, edge: 'none' });
    });

    it('should deep clone RAM state (nested Maps)', () => {
      const ramState = new Map<number, number>([
        [0, 1],
        [1, 2],
        [2, 3],
      ]);

      const seqState: SequentialState = {
        currentState: new Map([['ram1', ramState]]),
        nextState: new Map(),
        clocks: new Map(),
        cycleCount: 0,
      };

      const circuit = createTestCircuit([]);

      const snapshot = createSnapshot(seqState, circuit);

      // Modify original RAM state
      ramState.set(0, 999);

      // Snapshot should be unchanged (deep clone)
      const snapshotRam = snapshot.sequentialState.currentState.get('ram1') as Map<
        number,
        number
      >;
      expect(snapshotRam.get(0)).toBe(1);
    });

    it('should include timestamp', () => {
      const seqState: SequentialState = {
        currentState: new Map(),
        nextState: new Map(),
        clocks: new Map(),
        cycleCount: 0,
      };

      const circuit = createTestCircuit([]);

      const before = Date.now();
      const snapshot = createSnapshot(seqState, circuit);
      const after = Date.now();

      expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
      expect(snapshot.timestamp).toBeLessThanOrEqual(after);
    });

    it('should create snapshot with both sequential and environmental state', () => {
      const seqState: SequentialState = {
        currentState: new Map([['reg1', 100]]),
        nextState: new Map([['reg1', 101]]),
        clocks: new Map([['clk', { value: true, edge: 'rising' }]]),
        cycleCount: 42,
      };

      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: true } },
        { id: 'input1', componentRef: 'Input', arguments: { value: 255 } },
      ]);

      const snapshot = createSnapshot(seqState, circuit);

      // Sequential state
      expect(snapshot.cycleNumber).toBe(42);
      expect(snapshot.sequentialState.currentState.get('reg1')).toBe(100);
      expect(snapshot.sequentialState.nextState.get('reg1')).toBe(101);
      expect(snapshot.sequentialState.clocks.get('clk')).toEqual({ value: true, edge: 'rising' });

      // Environmental state
      expect(snapshot.environmentalState.size).toBe(2);
      expect(snapshot.environmentalState.get('switch1')).toBe(true);
      expect(snapshot.environmentalState.get('input1')).toBe(255);
    });
  });

  describe('snapshot roundtrip (capture -> restore)', () => {
    it('should correctly roundtrip environmental state', () => {
      const circuit = createTestCircuit([
        { id: 'switch1', componentRef: 'Switch', arguments: { value: true } },
        { id: 'input1', componentRef: 'Input', arguments: { value: 42 } },
      ]);

      const seqState: SequentialState = {
        currentState: new Map(),
        nextState: new Map(),
        clocks: new Map(),
        cycleCount: 0,
      };

      // Capture snapshot
      const snapshot = createSnapshot(seqState, circuit);

      // Modify circuit state
      circuit.nodes[0].arguments.value = false;
      circuit.nodes[1].arguments.value = 100;

      // Restore snapshot
      const updateNode = (nodeId: string, updates: Partial<Node>) => {
        const node = circuit.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          Object.assign(node, updates);
        }
      };

      restoreEnvironmentalState(circuit, snapshot.environmentalState, updateNode);

      // Should be back to original values
      expect(circuit.nodes[0].arguments.value).toBe(true);
      expect(circuit.nodes[1].arguments.value).toBe(42);
    });
  });
});
