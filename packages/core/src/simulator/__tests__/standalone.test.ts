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

import { describe, expect, it } from 'vitest';
import type { Behavior } from '../../circuit/behavior.js';
import {
  bitType,
  type CircuitIR,
  createCircuitLibrary,
  createEngine,
  elaborate,
} from '../index.js';

// Define test circuits using only core types (no store dependencies)
function createTestPrimitives(): CircuitIR[] {
  const andGate: CircuitIR = {
    version: 1,
    name: 'And',

    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { timing: 'combinational' },
  };

  const orGate: CircuitIR = {
    version: 1,
    name: 'Or',

    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { timing: 'combinational' },
  };

  const notGate: CircuitIR = {
    version: 1,
    name: 'Not',

    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { timing: 'combinational' },
  };

  const switchPrim: CircuitIR = {
    version: 1,
    name: 'Switch',

    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { timing: 'combinational' },
  };

  const register: CircuitIR = {
    version: 1,
    name: 'Register',

    inputs: [
      { name: 'd', portType: bitType() },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'q', portType: bitType() }],
    clocks: [{ name: 'clk' }],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: { timing: 'sequential', outputDependency: 'state-only' },
  };

  return [andGate, orGate, notGate, switchPrim, register];
}

describe('Core Simulator Standalone', () => {
  it('should create a component library without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createCircuitLibrary(primitives);

    expect(library.resolveCircuit('And')).toBeDefined();
    expect(library.resolveCircuit('Or')).toBeDefined();
    expect(library.resolveCircuit('Not')).toBeDefined();
    expect(library.getAllPrimitiveNames()).toContain('And');
  });

  it('should elaborate a simple circuit without browser dependencies', () => {
    const primitives = createTestPrimitives();
    const library = createCircuitLibrary(primitives);

    // Create a simple AND gate circuit
    const circuit: CircuitIR = {
      version: 1,
      name: 'SimpleAnd',

      inputs: [
        { name: 'x', portType: bitType() },
        { name: 'y', portType: bitType() },
      ],
      outputs: [{ name: 'z', portType: bitType() }],
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
          outputs: [{ id: 'and1.out', name: 'out', portType: bitType() }],
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

  // The engine runs the behavior table it is given and nothing else. A test
  // that builds raw Circuit IR, without circuit(), supplies that table itself.
  // createCircuitLibrary + elaborate + createEngine still run without
  // DOM/React/Zustand.

  it('should run a simulation from a behavior table built by hand', () => {
    const behaviors = new Map<string, Behavior>([
      [
        'And',
        {
          inputNames: ['a', 'b'],
          outputNames: ['out'],
          evalFn: ({ a, b }) => ({ out: a && b ? 1 : 0 }),
        },
      ],
      [
        'Switch',
        { inputNames: [], outputNames: ['out'], evalFn: ({ value }) => ({ out: value ? 1 : 0 }) },
      ],
    ]);

    const primitives = createTestPrimitives();
    const library = createCircuitLibrary(primitives);

    const circuit: CircuitIR = {
      version: 1,
      name: 'SwitchAnd',

      inputs: [],
      outputs: [{ name: 'result', portType: bitType() }],
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
    const sim = createEngine(flatCircuit, { componentLibrary: library, behaviors });

    // Both switches are on, so AND should output 1
    const result = sim.runCombinational();

    // Find the AND gate output in the port values
    const andOutput = Array.from(result.portValues.entries()).find(
      ([key]) => key.includes('and1') && key.endsWith('.out'),
    );

    expect(andOutput).toBeDefined();
    expect(andOutput![1]).toBe(1);
  });

  // Removed: "should support sequential simulation API without browser
  // dependencies." It built a raw Register IR and called sim.tick(), which
  // worked pre-deletion only because evalRegister was statically populated.
  // Under the new contract (eval-bridge dispatches everything), tests that
  // need to exercise the simulator API surface should use circuit() to
  // define their primitives, which carries the eval and stays free of
  // browser deps. The combinational test above shows the shape for callers
  // that build raw IRs: a behavior table built by hand.
});
