/**
 * Simulator Tests
 *
 * Tests for the fast simulator engine.
 * Focus on end-to-end circuit simulation, edge cases, and critical behaviors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulatorFromCircuit, type ComponentLibrary } from '@turing-incomplete/core/simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { PRIMITIVES } from '@turing-incomplete/core/simulator';
import { bitType, busType, type Circuit } from '../../types/circuit';

function getLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Simulator', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(PRIMITIVES as any[]);
  });

  describe('Basic Combinational Simulation', () => {
    it('should simulate a simple Switch → LED circuit', () => {
      // This test would have caught the Switch → LED bug!
      const circuit: Circuit = {
        id: 'test',
        name: 'SwitchLED',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'Switch',
            componentRef: 'Switch',
            arguments: { value: true }, // Switch is ON
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led1',
            label: 'LED',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // Check that Switch outputs true
      const switchOut = result.portValues.get('switch1.out');
      expect(switchOut).toBe(true);

      // Check that LED receives true (this was the bug!)
      const ledIn = result.portValues.get('led1.in');
      expect(ledIn).toBe(true);

      expect(result.error).toBeUndefined();
    });

    it('should simulate Switch (OFF) → LED circuit', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'SwitchLED',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'Switch',
            componentRef: 'Switch',
            arguments: { value: false }, // Switch is OFF
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led1',
            label: 'LED',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      expect(result.portValues.get('switch1.out')).toBe(false);
      expect(result.portValues.get('led1.in')).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should simulate Switch → AND → LED circuit', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'AndGate',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'A',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch2',
            label: 'B',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'and1',
            label: 'AND',
            componentRef: 'And',
            arguments: {},
            inputs: [
              { id: 'and1.a', name: 'a', portType: bitType() },
              { id: 'and1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'and1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led1',
            label: 'LED',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'switch2', portName: 'out' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'conn3',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // true AND true = true
      expect(result.portValues.get('and1.out')).toBe(true);
      expect(result.portValues.get('led1.in')).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle OR gate logic correctly', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'OrGate',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'A',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch2',
            label: 'B',
            componentRef: 'Switch',
            arguments: { value: false },
            inputs: [],
            outputs: [{ id: 'switch2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'or1',
            label: 'OR',
            componentRef: 'Or',
            arguments: {},
            inputs: [
              { id: 'or1.a', name: 'a', portType: bitType() },
              { id: 'or1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'or1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'or1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'switch2', portName: 'out' },
            target: { nodeId: 'or1', portName: 'b' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // true OR false = true
      expect(result.portValues.get('or1.out')).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle NOT gate logic correctly', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'NotGate',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'A',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'not1',
            label: 'NOT',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // NOT true = false
      expect(result.portValues.get('not1.out')).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle multi-level logic (chained gates)', () => {
      // (A AND B) OR (C AND D)
      const circuit: Circuit = {
        id: 'test',
        name: 'ChainedGates',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'A',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch2',
            label: 'B',
            componentRef: 'Switch',
            arguments: { value: false },
            inputs: [],
            outputs: [{ id: 'switch2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch3',
            label: 'C',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch3.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch4',
            label: 'D',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch4.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'and1',
            label: 'AND1',
            componentRef: 'And',
            arguments: {},
            inputs: [
              { id: 'and1.a', name: 'a', portType: bitType() },
              { id: 'and1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'and1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'and2',
            label: 'AND2',
            componentRef: 'And',
            arguments: {},
            inputs: [
              { id: 'and2.a', name: 'a', portType: bitType() },
              { id: 'and2.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'and2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'or1',
            label: 'OR',
            componentRef: 'Or',
            arguments: {},
            inputs: [
              { id: 'or1.a', name: 'a', portType: bitType() },
              { id: 'or1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'or1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'switch2', portName: 'out' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'conn3',
            source: { nodeId: 'switch3', portName: 'out' },
            target: { nodeId: 'and2', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn4',
            source: { nodeId: 'switch4', portName: 'out' },
            target: { nodeId: 'and2', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'conn5',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: 'or1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn6',
            source: { nodeId: 'and2', portName: 'out' },
            target: { nodeId: 'or1', portName: 'b' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // (true AND false) OR (true AND true) = false OR true = true
      expect(result.portValues.get('and1.out')).toBe(false);
      expect(result.portValues.get('and2.out')).toBe(true);
      expect(result.portValues.get('or1.out')).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty circuit', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'Empty',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      expect(result.portValues.size).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle circuit with only switches (no gates)', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'OnlySwitches',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'Switch1',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'switch2',
            label: 'Switch2',
            componentRef: 'Switch',
            arguments: { value: false },
            inputs: [],
            outputs: [{ id: 'switch2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      expect(result.portValues.get('switch1.out')).toBe(true);
      expect(result.portValues.get('switch2.out')).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle unconnected gate inputs (default to false)', () => {
      // AND gate with no inputs connected - should default to false
      const circuit: Circuit = {
        id: 'test',
        name: 'UnconnectedInputs',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'and1',
            label: 'AND',
            componentRef: 'And',
            arguments: {},
            inputs: [
              { id: 'and1.a', name: 'a', portType: bitType() },
              { id: 'and1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'and1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // Unconnected inputs should default to false, so false AND false = false
      expect(result.portValues.get('and1.out')).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle disconnected components', () => {
      // Two separate circuits: switch1→led1 and switch2→led2 (no connection between them)
      const circuit: Circuit = {
        id: 'test',
        name: 'Disconnected',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'Switch1',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led1',
            label: 'LED1',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
          {
            id: 'switch2',
            label: 'Switch2',
            componentRef: 'Switch',
            arguments: { value: false },
            inputs: [],
            outputs: [{ id: 'switch2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led2',
            label: 'LED2',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led2.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'switch2', portName: 'out' },
            target: { nodeId: 'led2', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // Both circuits should work independently
      expect(result.portValues.get('led1.in')).toBe(true);
      expect(result.portValues.get('led2.in')).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Sequential Simulation', () => {
    it('should initialize sequential state for DFlipFlop', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'DFFTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'dff1',
            label: 'DFF',
            componentRef: 'DFlipFlop',
            arguments: {},
            inputs: [{ id: 'dff1.d', name: 'd', portType: bitType() }],
            outputs: [
              { id: 'dff1.q', name: 'q', portType: bitType() },
              { id: 'dff1.q_bar', name: 'q_bar', portType: bitType() },
            ],
            clocks: [{ id: 'dff1.clk', name: 'clk' }],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize state for DFF
      expect(seqState?.currentState.has('dff1')).toBe(true);
      expect(seqState?.nextState.has('dff1')).toBe(true);
      expect(seqState?.clocks.has('dff1.clk')).toBe(true);
      expect(seqState?.cycleCount).toBe(0);

      // Initial state should be false
      expect(seqState?.currentState.get('dff1')).toBe(false);
    });

    it('should initialize sequential state for Register', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'RegisterTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'reg1',
            label: 'Register',
            componentRef: 'Register',
            arguments: {},
            inputs: [
              { id: 'reg1.d', name: 'd', portType: busType(8) },
              { id: 'reg1.we', name: 'we', portType: bitType() },
            ],
            outputs: [{ id: 'reg1.q', name: 'q', portType: busType(8) }],
            clocks: [{ id: 'reg1.clk', name: 'clk' }],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize state for Register
      expect(seqState?.currentState.has('reg1')).toBe(true);
      expect(seqState?.nextState.has('reg1')).toBe(true);
      expect(seqState?.clocks.has('reg1.clk')).toBe(true);

      // Initial state should be 0
      expect(seqState?.currentState.get('reg1')).toBe(0);
    });

    it('should run a full simulation tick', () => {
      // Simple circuit with a DFF: Switch → DFF → LED
      const circuit: Circuit = {
        id: 'test',
        name: 'DFFCircuit',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'D Input',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'clk',
            label: 'Clock',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'clk.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'dff1',
            label: 'DFF',
            componentRef: 'DFlipFlop',
            arguments: {},
            inputs: [{ id: 'dff1.d', name: 'd', portType: bitType() }],
            outputs: [
              { id: 'dff1.q', name: 'q', portType: bitType() },
              { id: 'dff1.q_bar', name: 'q_bar', portType: bitType() },
            ],
            clocks: [{ id: 'dff1.clk', name: 'clk' }],
          },
          {
            id: 'led1',
            label: 'Q Output',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'dff1', portName: 'd' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'clk', portName: 'out' },
            target: { nodeId: 'dff1', portName: 'clk' },
            portType: bitType(),
          },
          {
            id: 'conn3',
            source: { nodeId: 'dff1', portName: 'q' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.tick();

      // After one tick with d=true and rising clock edge, q should be true
      expect(result.sequentialState).toBeDefined();
      expect(result.sequentialState!.cycleCount).toBe(1);
    });
  });

  describe('Port Value Storage', () => {
    it('should store both input and output port values', () => {
      // This is critical for visualization - LED needs its input value stored
      const circuit: Circuit = {
        id: 'test',
        name: 'PortStorage',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'switch1',
            label: 'Switch',
            componentRef: 'Switch',
            arguments: { value: true },
            inputs: [],
            outputs: [{ id: 'switch1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'and1',
            label: 'AND',
            componentRef: 'And',
            arguments: {},
            inputs: [
              { id: 'and1.a', name: 'a', portType: bitType() },
              { id: 'and1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'and1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'led1',
            label: 'LED',
            componentRef: 'Led',
            arguments: {},
            inputs: [{ id: 'led1.in', name: 'in', portType: bitType() }],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'conn2',
            source: { nodeId: 'switch1', portName: 'out' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'conn3',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: 'led1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const result = sim.runCombinational();

      // Check that output ports are stored
      expect(result.portValues.has('switch1.out')).toBe(true);
      expect(result.portValues.has('and1.out')).toBe(true);

      // Check that input ports are stored (critical for LED!)
      expect(result.portValues.has('and1.a')).toBe(true);
      expect(result.portValues.has('and1.b')).toBe(true);
      expect(result.portValues.has('led1.in')).toBe(true);

      // Verify values
      expect(result.portValues.get('switch1.out')).toBe(true);
      expect(result.portValues.get('and1.a')).toBe(true);
      expect(result.portValues.get('and1.b')).toBe(true);
      expect(result.portValues.get('and1.out')).toBe(true);
      expect(result.portValues.get('led1.in')).toBe(true);
    });
  });

  describe('Initialization Support', () => {
    it('should initialize Register with custom initial value', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'RegisterInitTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'reg1',
            label: 'Register',
            componentRef: 'Register',
            arguments: { initial: 42 }, // Custom initial value
            inputs: [
              { id: 'reg1.d', name: 'd', portType: busType(8) },
              { id: 'reg1.we', name: 'we', portType: bitType() },
            ],
            outputs: [{ id: 'reg1.q', name: 'q', portType: busType(8) }],
            clocks: [{ id: 'reg1.clk', name: 'clk' }],
          },
          {
            id: 'input1',
            label: 'Input',
            componentRef: 'Input',
            arguments: { value: 0 },
            inputs: [],
            outputs: [{ id: 'input1.out', name: 'out', portType: busType(8) }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'input1', portName: 'out' },
            target: { nodeId: 'reg1', portName: 'd' },
            portType: busType(8),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize with custom value
      expect(seqState?.currentState.has('reg1')).toBe(true);
      expect(seqState?.currentState.get('reg1')).toBe(42);

      // Run simulation - should output initial value before any clock tick
      const result = sim.runCombinational();
      expect(result.portValues.get('reg1.q')).toBe(42);
    });

    it('should initialize RAM with object-based init data', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'RAMInitTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'ram1',
            label: 'RAM',
            componentRef: 'RAM',
            arguments: {
              init: { 64: 3, 65: 4, 66: 5 }, // Initialize specific addresses
            },
            inputs: [
              { id: 'ram1.addr', name: 'addr', portType: busType(8) },
              { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
              { id: 'ram1.we', name: 'we', portType: bitType() },
            ],
            outputs: [{ id: 'ram1.data_out', name: 'data_out', portType: busType(8) }],
            clocks: [{ id: 'ram1.clk', name: 'clk' }],
          },
          {
            id: 'addr_input',
            label: 'Address',
            componentRef: 'Input',
            arguments: { value: 64 }, // Read address 64
            inputs: [],
            outputs: [{ id: 'addr_input.out', name: 'out', portType: busType(8) }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'addr_input', portName: 'out' },
            target: { nodeId: 'ram1', portName: 'addr' },
            portType: busType(8),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize with Map containing the init data
      expect(seqState?.currentState.has('ram1')).toBe(true);
      const ramState = seqState?.currentState.get('ram1');
      expect(ramState).toBeInstanceOf(Map);
      expect((ramState as Map<number, number>).get(64)).toBe(3);
      expect((ramState as Map<number, number>).get(65)).toBe(4);
      expect((ramState as Map<number, number>).get(66)).toBe(5);

      // Run simulation - should read initialized value at address 64
      const result = sim.runCombinational();
      expect(result.portValues.get('ram1.data_out')).toBe(3);
    });

    it('should initialize RAM with array-based init data', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'RAMInitArrayTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'ram1',
            label: 'RAM',
            componentRef: 'RAM',
            arguments: {
              init: [10, 20, 30, 40], // Initialize addresses 0-3
            },
            inputs: [
              { id: 'ram1.addr', name: 'addr', portType: busType(8) },
              { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
              { id: 'ram1.we', name: 'we', portType: bitType() },
            ],
            outputs: [{ id: 'ram1.data_out', name: 'data_out', portType: busType(8) }],
            clocks: [{ id: 'ram1.clk', name: 'clk' }],
          },
          {
            id: 'addr_input',
            label: 'Address',
            componentRef: 'Input',
            arguments: { value: 2 }, // Read address 2
            inputs: [],
            outputs: [{ id: 'addr_input.out', name: 'out', portType: busType(8) }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'addr_input', portName: 'out' },
            target: { nodeId: 'ram1', portName: 'addr' },
            portType: busType(8),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize with Map containing the array data
      expect(seqState?.currentState.has('ram1')).toBe(true);
      const ramState = seqState?.currentState.get('ram1');
      expect(ramState).toBeInstanceOf(Map);
      expect((ramState as Map<number, number>).get(0)).toBe(10);
      expect((ramState as Map<number, number>).get(1)).toBe(20);
      expect((ramState as Map<number, number>).get(2)).toBe(30);
      expect((ramState as Map<number, number>).get(3)).toBe(40);

      // Run simulation - should read initialized value at address 2
      const result = sim.runCombinational();
      expect(result.portValues.get('ram1.data_out')).toBe(30);
    });

    it('should use default initialization when no init argument provided', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'RAMDefaultInitTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'ram1',
            label: 'RAM',
            componentRef: 'RAM',
            arguments: {}, // No init argument - should use default
            inputs: [
              { id: 'ram1.addr', name: 'addr', portType: busType(8) },
              { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
              { id: 'ram1.we', name: 'we', portType: bitType() },
            ],
            outputs: [{ id: 'ram1.data_out', name: 'data_out', portType: busType(8) }],
            clocks: [{ id: 'ram1.clk', name: 'clk' }],
          },
          {
            id: 'addr_input',
            label: 'Address',
            componentRef: 'Input',
            arguments: { value: 10 },
            inputs: [],
            outputs: [{ id: 'addr_input.out', name: 'out', portType: busType(8) }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'conn1',
            source: { nodeId: 'addr_input', portName: 'out' },
            target: { nodeId: 'ram1', portName: 'addr' },
            portType: busType(8),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const sim = createSimulatorFromCircuit(circuit, getLibrary());
      const seqState = sim.getState();

      // Should initialize with empty Map
      expect(seqState?.currentState.has('ram1')).toBe(true);
      const ramState = seqState?.currentState.get('ram1');
      expect(ramState).toBeInstanceOf(Map);
      expect((ramState as Map<number, number>).size).toBe(0);

      // Run simulation - uninitialized addresses should return 0
      const result = sim.runCombinational();
      expect(result.portValues.get('ram1.data_out')).toBe(0);
    });
  });
});
