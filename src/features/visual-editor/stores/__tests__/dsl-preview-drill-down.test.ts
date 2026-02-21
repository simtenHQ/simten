/**
 * Tests for DSLPreviewStore drill-down navigation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDSLPreviewStore } from '../dsl-preview-store';
import { useComponentLibraryStore } from '../component-library-store';
import { useCircuitStore } from '../circuit-store';
import type { Circuit } from '../../types/circuit';
import { BOUNDARY_IN_PREFIX, BOUNDARY_OUT_PREFIX } from '../../utils/drill-down-view';

/** Re-read store state after mutations */
const getState = () => useDSLPreviewStore.getState();

// Helper: create a primitive component definition
function makePrimitive(name: string, inputs: string[], outputs: string[]): Circuit {
  return {
    id: `${name}-def`,
    name,
    parameters: [],
    inputs: inputs.map((n) => ({ name: n, portType: { kind: 'bit' as const } })),
    outputs: outputs.map((n) => ({ name: n, portType: { kind: 'bit' as const } })),
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
  };
}

// Helper: create a composite HalfAdder definition
function makeHalfAdderDef(): Circuit {
  return {
    id: 'half-adder-def',
    name: 'HalfAdder',
    parameters: [],
    inputs: [
      { name: 'a', portType: { kind: 'bit' } },
      { name: 'b', portType: { kind: 'bit' } },
    ],
    outputs: [
      { name: 'sum', portType: { kind: 'bit' } },
      { name: 'carry', portType: { kind: 'bit' } },
    ],
    clocks: [],
    state: [],
    nodes: [
      {
        id: 'xor1',
        label: 'xor1',
        componentRef: 'Xor',
        arguments: {},
        inputs: [
          { id: 'xor1_a', name: 'a', portType: { kind: 'bit' } },
          { id: 'xor1_b', name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [{ id: 'xor1_out', name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
      },
      {
        id: 'and1',
        label: 'and1',
        componentRef: 'And',
        arguments: {},
        inputs: [
          { id: 'and1_a', name: 'a', portType: { kind: 'bit' } },
          { id: 'and1_b', name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [{ id: 'and1_out', name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
      },
    ],
    connections: [
      { id: 'c1', source: { nodeId: '', portName: 'a' }, target: { nodeId: 'xor1', portName: 'a' }, portType: { kind: 'bit' } },
      { id: 'c2', source: { nodeId: '', portName: 'b' }, target: { nodeId: 'xor1', portName: 'b' }, portType: { kind: 'bit' } },
      { id: 'c3', source: { nodeId: '', portName: 'a' }, target: { nodeId: 'and1', portName: 'a' }, portType: { kind: 'bit' } },
      { id: 'c4', source: { nodeId: '', portName: 'b' }, target: { nodeId: 'and1', portName: 'b' }, portType: { kind: 'bit' } },
      { id: 'c5', source: { nodeId: 'xor1', portName: 'out' }, target: { nodeId: '', portName: 'sum' }, portType: { kind: 'bit' } },
      { id: 'c6', source: { nodeId: 'and1', portName: 'out' }, target: { nodeId: '', portName: 'carry' }, portType: { kind: 'bit' } },
    ],
    implementation: { kind: 'composite' },
  };
}

// Helper: create a top-level FullAdder circuit that uses HalfAdder
function makeFullAdder(): Circuit {
  return {
    id: 'full-adder',
    name: 'FullAdder',
    parameters: [],
    inputs: [
      { name: 'a', portType: { kind: 'bit' } },
      { name: 'b', portType: { kind: 'bit' } },
      { name: 'cin', portType: { kind: 'bit' } },
    ],
    outputs: [
      { name: 'sum', portType: { kind: 'bit' } },
      { name: 'cout', portType: { kind: 'bit' } },
    ],
    clocks: [],
    state: [],
    nodes: [
      {
        id: 'sw_a',
        label: 'a',
        componentRef: 'Switch',
        arguments: { value: false },
        inputs: [],
        outputs: [{ id: 'sw_a_out', name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
      },
      {
        id: 'sw_b',
        label: 'b',
        componentRef: 'Switch',
        arguments: { value: false },
        inputs: [],
        outputs: [{ id: 'sw_b_out', name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
      },
      {
        id: 'ha1',
        label: 'ha1',
        componentRef: 'HalfAdder',
        arguments: {},
        inputs: [
          { id: 'ha1_a', name: 'a', portType: { kind: 'bit' } },
          { id: 'ha1_b', name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [
          { id: 'ha1_sum', name: 'sum', portType: { kind: 'bit' } },
          { id: 'ha1_carry', name: 'carry', portType: { kind: 'bit' } },
        ],
        clocks: [],
      },
      {
        id: 'led_sum',
        label: 'sum',
        componentRef: 'Led',
        arguments: {},
        inputs: [{ id: 'led_sum_in', name: 'in', portType: { kind: 'bit' } }],
        outputs: [],
        clocks: [],
      },
    ],
    connections: [
      { id: 'fc1', source: { nodeId: 'sw_a', portName: 'out' }, target: { nodeId: 'ha1', portName: 'a' }, portType: { kind: 'bit' } },
      { id: 'fc2', source: { nodeId: 'sw_b', portName: 'out' }, target: { nodeId: 'ha1', portName: 'b' }, portType: { kind: 'bit' } },
      { id: 'fc3', source: { nodeId: 'ha1', portName: 'sum' }, target: { nodeId: 'led_sum', portName: 'in' }, portType: { kind: 'bit' } },
    ],
    implementation: { kind: 'composite' },
  };
}

describe('DSLPreviewStore drill-down navigation', () => {
  beforeEach(() => {
    // Reset stores
    const library = useComponentLibraryStore.getState();
    library.clearAll();

    // Register primitives
    library.registerPrimitive(makePrimitive('Switch', [], ['out']));
    library.registerPrimitive(makePrimitive('Led', ['in'], []));
    library.registerPrimitive(makePrimitive('Xor', ['a', 'b'], ['out']));
    library.registerPrimitive(makePrimitive('And', ['a', 'b'], ['out']));

    // Register composite HalfAdder
    library.registerUser(makeHalfAdderDef());

    // Set up the top-level circuit
    const fullAdder = makeFullAdder();
    library.registerUser(fullAdder);

    // Initialize preview store with the FullAdder circuit
    getState().setCompiledCircuits([fullAdder], 'component FullAdder {}');
  });

  describe('drillInto', () => {
    it('pushes a frame onto the stack for a valid composite node', () => {
      getState().drillInto('ha1');

      const { drillDownStack } = getState();
      expect(drillDownStack).toHaveLength(1);
      expect(drillDownStack[0].nodeId).toBe('ha1');
      expect(drillDownStack[0].nodeLabel).toBe('ha1');
      expect(drillDownStack[0].componentName).toBe('HalfAdder');
    });

    it('rejects drill-into for primitive nodes', () => {
      getState().drillInto('sw_a');
      expect(getState().drillDownStack).toHaveLength(0);
    });

    it('rejects drill-into for unknown node IDs', () => {
      getState().drillInto('nonexistent');
      expect(getState().drillDownStack).toHaveLength(0);
    });

    it('sets CircuitStore to the view circuit with boundary nodes', () => {
      getState().drillInto('ha1');

      const circuit = useCircuitStore.getState().circuit;
      expect(circuit).not.toBeNull();

      // Should have boundary nodes + internal nodes
      const boundaryInputs = circuit!.nodes.filter(
        (n) => n.id.startsWith(BOUNDARY_IN_PREFIX),
      );
      const boundaryOutputs = circuit!.nodes.filter(
        (n) => n.id.startsWith(BOUNDARY_OUT_PREFIX),
      );

      expect(boundaryInputs).toHaveLength(2); // a, b
      expect(boundaryOutputs).toHaveLength(2); // sum, carry

      // Should also have internal nodes xor1 and and1
      expect(circuit!.nodes.find((n) => n.id === 'xor1')).toBeDefined();
      expect(circuit!.nodes.find((n) => n.id === 'and1')).toBeDefined();
    });
  });

  describe('navigateTo', () => {
    it('navigateTo(0) clears stack and restores top-level circuit', () => {
      getState().drillInto('ha1');
      expect(getState().drillDownStack).toHaveLength(1);

      getState().navigateTo(0);
      expect(getState().drillDownStack).toHaveLength(0);

      // CircuitStore should have the top-level FullAdder circuit
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit).not.toBeNull();
      expect(circuit!.name).toBe('FullAdder');
    });

    it('is a no-op when already at target depth', () => {
      getState().drillInto('ha1');

      // navigateTo(1) when stack has 1 frame — no-op
      getState().navigateTo(1);
      expect(getState().drillDownStack).toHaveLength(1);
    });
  });

  describe('isDrilledIn / getPortValuePrefix', () => {
    it('isDrilledIn() returns false when stack is empty', () => {
      expect(getState().isDrilledIn()).toBe(false);
    });

    it('isDrilledIn() returns true after drillInto', () => {
      getState().drillInto('ha1');
      expect(getState().isDrilledIn()).toBe(true);
    });

    it('getPortValuePrefix() returns empty string at top level', () => {
      expect(getState().getPortValuePrefix()).toBe('');
    });

    it('getPortValuePrefix() returns "nodeId." when drilled one level', () => {
      getState().drillInto('ha1');
      expect(getState().getPortValuePrefix()).toBe('ha1.');
    });
  });

  describe('stack clearing on recompile', () => {
    it('setCompiledCircuits clears the drill-down stack', () => {
      getState().drillInto('ha1');
      expect(getState().drillDownStack).toHaveLength(1);

      const fullAdder = makeFullAdder();
      getState().setCompiledCircuits([fullAdder], 'recompiled');
      expect(getState().drillDownStack).toHaveLength(0);
    });

    it('selectCircuit clears the drill-down stack', () => {
      // Set up with two circuits
      const fullAdder = makeFullAdder();
      const halfAdder = makeHalfAdderDef();
      getState().setCompiledCircuits([fullAdder, halfAdder], 'two circuits');

      // Drill into the selected circuit (last one is auto-selected, so select first)
      getState().selectCircuit(0);
      getState().drillInto('ha1');
      expect(getState().drillDownStack).toHaveLength(1);

      // Switch to a different circuit
      getState().selectCircuit(1);
      expect(getState().drillDownStack).toHaveLength(0);
    });
  });
});
