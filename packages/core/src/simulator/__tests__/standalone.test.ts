/**
 * Standalone Core Simulator Test
 *
 * This test verifies that the core simulator can run without any
 * browser dependencies (Zustand, React, etc.). It only imports from
 * the core simulator module.
 *
 * If this test fails to compile or run, it means a browser dependency
 * was accidentally introduced into the core simulator.
 */

import { describe, it, expect } from 'vitest';
import {
  createSimulator,
  createComponentLibrary,
  elaborate,
  type Circuit,
  bitType,
} from '../index.js';

// Define test circuits using only core types (no store dependencies)
function createTestPrimitives(): Circuit[] {
  const andGate: Circuit = {
    id: 'prim:and',
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
    metadata: { kind: 'combinational' },
  };

  const orGate: Circuit = {
    id: 'prim:or',
    name: 'Or',
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
    metadata: { kind: 'combinational' },
  };

  const notGate: Circuit = {
    id: 'prim:not',
    name: 'Not',
    parameters: [],
    inputs: [
      { name: 'in', portType: bitType() },
    ],
    outputs: [
      { name: 'out', portType: bitType() },
    ],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { kind: 'combinational' },
  };

  const switchPrim: Circuit = {
    id: 'prim:switch',
    name: 'Switch',
    parameters: [],
    inputs: [],
    outputs: [
      { name: 'out', portType: bitType() },
    ],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { kind: 'combinational' },
  };

  const register: Circuit = {
    id: 'prim:register',
    name: 'Register',
    parameters: [{ name: 'width', paramType: 'int', defaultValue: 1 }],
    inputs: [
      { name: 'd', portType: bitType() },
      { name: 'we', portType: bitType() },
    ],
    outputs: [
      { name: 'q', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { kind: 'sequential', outputDependency: 'state-only' },
  };

  return [andGate, orGate, notGate, switchPrim, register];
}

describe('Core Simulator Standalone', () => {
  it('should create a component library without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createComponentLibrary(primitives);

    expect(library.resolveComponent('And')).toBeDefined();
    expect(library.resolveComponent('Or')).toBeDefined();
    expect(library.resolveComponent('Not')).toBeDefined();
    expect(library.getAllPrimitiveNames()).toContain('And');
  });

  it('should elaborate a simple circuit without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createComponentLibrary(primitives);

    // Create a simple AND gate circuit
    const circuit: Circuit = {
      id: 'test:simple-and',
      name: 'SimpleAnd',
      parameters: [],
      inputs: [
        { name: 'x', portType: bitType() },
        { name: 'y', portType: bitType() },
      ],
      outputs: [
        { name: 'z', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'x' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'c2',
          source: { nodeId: '', portName: 'y' },
          target: { nodeId: 'and1', portName: 'b' },
          portType: bitType(),
        },
        {
          id: 'c3',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'z' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const flatCircuit = elaborate(circuit, library);

    expect(flatCircuit.nodes.length).toBe(1);
    expect(flatCircuit.nodes[0].primitiveType).toBe('And');
  });

  it('should run combinational simulation without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createComponentLibrary(primitives);

    // Create circuit with switch inputs
    const circuit: Circuit = {
      id: 'test:switch-and',
      name: 'SwitchAnd',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'result', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'sw1',
          componentRef: 'Switch',
          arguments: { value: true },
          inputs: [],
          outputs: [{ id: 'sw1.out', name: 'out', portType: bitType() }],
          clocks: [],
        },
        {
          id: 'sw2',
          componentRef: 'Switch',
          arguments: { value: true },
          inputs: [],
          outputs: [{ id: 'sw2.out', name: 'out', portType: bitType() }],
          clocks: [],
        },
        {
          id: 'and1',
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
      connections: [
        {
          id: 'c1',
          source: { nodeId: 'sw1', portName: 'out' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'c2',
          source: { nodeId: 'sw2', portName: 'out' },
          target: { nodeId: 'and1', portName: 'b' },
          portType: bitType(),
        },
        {
          id: 'c3',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'result' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const flatCircuit = elaborate(circuit, library);
    const sim = createSimulator(flatCircuit, { componentLibrary: library });

    // Both switches are true, so AND should output true
    const result = sim.runCombinational();

    // Find the AND gate output in the port values
    const andOutput = Array.from(result.portValues.entries())
      .find(([key]) => key.includes('and1') && key.endsWith('.out'));

    expect(andOutput).toBeDefined();
    expect(andOutput![1]).toBe(true);
  });

  it('should support sequential simulation API without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createComponentLibrary(primitives);

    // Create a simple register circuit
    const circuit: Circuit = {
      id: 'test:register',
      name: 'SimpleRegister',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'q', portType: bitType() },
      ],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'reg',
          componentRef: 'Register',
          arguments: { width: 1 },
          inputs: [
            { id: 'reg.d', name: 'd', portType: bitType() },
            { id: 'reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'reg.q', name: 'q', portType: bitType() }],
          clocks: [{ id: 'reg.clk', name: 'clk' }],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: 'reg', portName: 'q' },
          target: { nodeId: '', portName: 'q' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const flatCircuit = elaborate(circuit, library);
    const sim = createSimulator(flatCircuit, { componentLibrary: library });

    // Verify all simulator APIs work without browser dependencies
    expect(sim.getPortValues()).toBeInstanceOf(Map);
    expect(sim.getState()).not.toBeNull();
    expect(sim.getMetrics().nodeCount).toBe(1);

    // tick() should work and return a result
    const result = sim.tick();
    expect(result.portValues).toBeInstanceOf(Map);
    expect(result.sequentialState).toBeDefined();
    expect(result.metrics.totalEvals).toBeGreaterThanOrEqual(0);

    // snapshot/restore should work
    const snapshot = sim.snapshot();
    expect(snapshot.portValues).toBeInstanceOf(Map);
    expect(snapshot.sequentialState).toBeDefined();

    sim.restore(snapshot);
    expect(sim.getState()?.cycleCount).toBe(snapshot.cycleCount);

    // reset should work
    sim.reset();
    expect(sim.getMetrics().totalTicks).toBe(0);
  });
});
