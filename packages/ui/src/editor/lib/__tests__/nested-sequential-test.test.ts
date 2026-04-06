/**
 * Test: Nested Sequential Components
 *
 * Tests whether circuits with sequential logic (registers, clocks)
 * work correctly when instantiated as nodes within other circuits.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Circuit, bitType, busType } from '../../types/circuit';
import { createSimulatorFromCircuit, type CircuitLibrary } from '@turing-incomplete/core/simulator';
import { useCircuitLibraryStore } from '../../stores/circuit-library-store';
import { PRIMITIVES } from '@turing-incomplete/core/simulator';

function getLibrary(): CircuitLibrary {
  const store = useCircuitLibraryStore.getState();
  return {
    resolveCircuit: (name) => store.resolveCircuit(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Nested Sequential Components', () => {
  beforeAll(() => {
    // Register primitives first (required for nested components to work)
    const store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(PRIMITIVES as any[]);

    // Register the circuits so they can be instantiated as components
    const registerCircuit: Circuit = {
      id: 'simple_reg',
      name: 'SimpleReg',
      parameters: [],
      inputs: [{ name: 'dataIn', portType: busType(8) }],
      outputs: [{ name: 'dataOut', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'reg',
          componentRef: 'Register',
          arguments: {},
          inputs: [
            { id: 'reg_data', name: 'data', portType: busType(8) },
            { id: 'reg_we', name: 'we', portType: bitType() },
          ],
          outputs: [
            { id: 'reg_q', name: 'q', portType: busType(8) },
          ],
          clocks: [
            { id: 'reg_clk', name: 'clk' },
          ],
        },
        {
          id: 'we_const',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [
            { id: 'we_out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'dataIn' },
          target: { nodeId: 'reg', portName: 'data' },
          portType: busType(8),
        },
        {
          id: 'conn2',
          source: { nodeId: 'we_const', portName: 'out' },
          target: { nodeId: 'reg', portName: 'we' },
          portType: bitType(),
        },
        {
          id: 'conn3',
          source: { nodeId: '', portName: 'clk' },
          target: { nodeId: 'reg', portName: 'clk' },
          portType: bitType(),
        },
        {
          id: 'conn4',
          source: { nodeId: 'reg', portName: 'q' },
          target: { nodeId: '', portName: 'dataOut' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const counterCircuit: Circuit = {
      id: 'simple_counter',
      name: 'SimpleCounter',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'count', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'reg',
          componentRef: 'Register',
          arguments: {},
          inputs: [
            { id: 'reg_data', name: 'data', portType: busType(8) },
            { id: 'reg_we', name: 'we', portType: bitType() },
          ],
          outputs: [
            { id: 'reg_q', name: 'q', portType: busType(8) },
          ],
          clocks: [{ id: 'reg_clk', name: 'clk' }],
        },
        {
          id: 'adder',
          componentRef: 'Adder',
          arguments: {},
          inputs: [
            { id: 'adder_a', name: 'a', portType: busType(8) },
            { id: 'adder_b', name: 'b', portType: busType(8) },
          ],
          outputs: [
            { id: 'adder_sum', name: 'sum', portType: busType(8) },
          ],
          clocks: [],
        },
        {
          id: 'one',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'one_out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
        {
          id: 'we',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'we_out', name: 'out', portType: bitType() }],
          clocks: [],
        },
      ],
      connections: [
        // Register output -> Adder input A
        {
          id: 'conn1',
          source: { nodeId: 'reg', portName: 'q' },
          target: { nodeId: 'adder', portName: 'a' },
          portType: busType(8),
        },
        // Constant 1 -> Adder input B
        {
          id: 'conn2',
          source: { nodeId: 'one', portName: 'out' },
          target: { nodeId: 'adder', portName: 'b' },
          portType: busType(8),
        },
        // Adder output -> Register data (feedback!)
        {
          id: 'conn3',
          source: { nodeId: 'adder', portName: 'sum' },
          target: { nodeId: 'reg', portName: 'data' },
          portType: busType(8),
        },
        // Write enable
        {
          id: 'conn4',
          source: { nodeId: 'we', portName: 'out' },
          target: { nodeId: 'reg', portName: 'we' },
          portType: bitType(),
        },
        // Clock
        {
          id: 'conn5',
          source: { nodeId: '', portName: 'clk' },
          target: { nodeId: 'reg', portName: 'clk' },
          portType: bitType(),
        },
        // Register output -> circuit output
        {
          id: 'conn6',
          source: { nodeId: 'reg', portName: 'q' },
          target: { nodeId: '', portName: 'count' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // Register both circuits in the component library
    store.registerUser(registerCircuit);
    store.registerUser(counterCircuit);
  });

  it('should handle a simple register in a nested circuit', () => {
    // Create a wrapper circuit that instantiates the register circuit (registered in beforeAll)
    const wrapperCircuit: Circuit = {
      id: 'wrapper',
      name: 'Wrapper',
      parameters: [],
      inputs: [{ name: 'input', portType: busType(8) }],
      outputs: [{ name: 'output', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'input_node',
          componentRef: 'Constant',
          arguments: { value: 42 },
          inputs: [],
          outputs: [
            { id: 'input_out', name: 'out', portType: busType(8) },
          ],
          clocks: [],
        },
        {
          id: 'reg_instance',
          componentRef: 'SimpleReg', // Reference to the nested circuit
          arguments: {},
          inputs: [
            { id: 'reg_in', name: 'dataIn', portType: busType(8) },
          ],
          outputs: [
            { id: 'reg_out', name: 'dataOut', portType: busType(8) },
          ],
          clocks: [
            { id: 'reg_clk2', name: 'clk' },
          ],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'input_node', portName: 'out' },
          target: { nodeId: 'reg_instance', portName: 'dataIn' },
          portType: busType(8),
        },
        {
          id: 'conn2',
          source: { nodeId: '', portName: 'clk' },
          target: { nodeId: 'reg_instance', portName: 'clk' },
          portType: busType(8),
        },
        {
          id: 'conn3',
          source: { nodeId: 'reg_instance', portName: 'dataOut' },
          target: { nodeId: '', portName: 'output' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // Create simulator
    const sim = createSimulatorFromCircuit(wrapperCircuit, getLibrary());
    const seqState = sim.getState();

    // Initial state - register should be 0
    expect(seqState?.cycleCount).toBe(0);

    // Run one clock tick - register should latch the value 42
    const result1 = sim.tick();
    expect(result1.sequentialState?.cycleCount).toBe(1);

    // Check output using portValues
    const regOutput = result1.portValues.get('reg_instance.dataOut');

    // This is the key test: does the nested register's output update?
    expect(regOutput).toBe(42);
  });

  it('should handle a counter with feedback in a nested circuit', () => {
    // Wrapper circuit that instantiates the counter (registered in beforeAll)
    const wrapperCircuit: Circuit = {
      id: 'wrapper',
      name: 'CounterWrapper',
      parameters: [],
      inputs: [],
      outputs: [{ name: 'count', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'counter',
          componentRef: 'SimpleCounter',
          arguments: {},
          inputs: [],
          outputs: [{ id: 'counter_out', name: 'count', portType: busType(8) }],
          clocks: [{ id: 'counter_clk', name: 'clk' }],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'clk' },
          target: { nodeId: 'counter', portName: 'clk' },
          portType: bitType(),
        },
        {
          id: 'conn2',
          source: { nodeId: 'counter', portName: 'count' },
          target: { nodeId: '', portName: 'count' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // Create simulator
    const sim = createSimulatorFromCircuit(wrapperCircuit, getLibrary());
    const seqState = sim.getState();
    expect(seqState?.cycleCount).toBe(0);

    // Run 5 clock ticks
    let lastResult;
    for (let i = 0; i < 5; i++) {
      lastResult = sim.tick();
    }

    // Check counter output using portValues from last result
    const counterOutput = lastResult!.portValues.get('counter.count');

    // This tests if nested sequential components with feedback work
    expect(counterOutput).toBe(5);
  });
});
