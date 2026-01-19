/**
 * Simulator v0.1 Tests
 *
 * Comprehensive test suite for the v0.1 simulator with composite component support.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSimulationState,
  setInputs,
  getOutputs,
  simulate,
  validateCircuitForSimulation,
  simulateSteps,
} from './simulator-v0.1';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { getPrimitives } from '../lib/primitives';
import {
  bitType,
  busType,
  type Circuit,
  portPathKey,
} from '../types/ir-v0.1';

describe('Simulator v0.1', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    // Setup component library with primitives
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  describe('Simulation State Management', () => {
    it('should create initial simulation state', () => {
      const circuit: Circuit = {
        id: 'test-circuit',
        name: 'TestCircuit',
        parameters: [],
        inputs: [{ name: 'a', portType: bitType() }],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const state = createSimulationState(circuit);

      expect(state.cycle).toBe(0);
      expect(state.portValues.size).toBeGreaterThan(0);
      expect(state.evaluationOrder).toEqual([]);
    });

    it('should initialize input ports with default values', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'Test',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: busType(8) },
        ],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const state = createSimulationState(circuit);

      const aKey = portPathKey({ nodeId: '', portName: 'a' });
      const bKey = portPathKey({ nodeId: '', portName: 'b' });

      expect(state.portValues.get(aKey)).toBe(false);
      expect(state.portValues.get(bKey)).toBe(0);
    });

    it('should set input values', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'Test',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      let state = createSimulationState(circuit);
      state = setInputs(state, circuit, { a: true, b: false });

      const aKey = portPathKey({ nodeId: '', portName: 'a' });
      const bKey = portPathKey({ nodeId: '', portName: 'b' });

      expect(state.portValues.get(aKey)).toBe(true);
      expect(state.portValues.get(bKey)).toBe(false);
    });

    it('should get output values', () => {
      const circuit: Circuit = {
        id: 'test',
        name: 'Test',
        parameters: [],
        inputs: [],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const state = createSimulationState(circuit);
      const outKey = portPathKey({ nodeId: '', portName: 'out' });
      state.portValues.set(outKey, true);

      const outputs = getOutputs(state, circuit);
      expect(outputs.out).toBe(true);
    });
  });

  describe('Primitive Component Evaluation', () => {
    it('should evaluate AND gate', () => {
      const circuit: Circuit = {
        id: 'and-test',
        name: 'AndTest',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [{ name: 'out', portType: bitType() }],
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
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c3',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const result = simulate(circuit, { a: true, b: true }, library);
      expect(result.out).toBe(true);

      const result2 = simulate(circuit, { a: true, b: false }, library);
      expect(result2.out).toBe(false);
    });

    it('should evaluate NOT gate', () => {
      const circuit: Circuit = {
        id: 'not-test',
        name: 'NotTest',
        parameters: [],
        inputs: [{ name: 'in', portType: bitType() }],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'not1',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'c1',
            source: { nodeId: '', portName: 'in' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: 'not1', portName: 'out' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      expect(simulate(circuit, { in: true }, library).out).toBe(false);
      expect(simulate(circuit, { in: false }, library).out).toBe(true);
    });

    it('should evaluate multiple gates in sequence', () => {
      // Create circuit: a AND b, then NOT the result
      const circuit: Circuit = {
        id: 'multi-gate',
        name: 'MultiGate',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
        ],
        outputs: [{ name: 'out', portType: bitType() }],
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
          {
            id: 'not1',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'c1',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c3',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'c4',
            source: { nodeId: 'not1', portName: 'out' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      // This is effectively NAND
      expect(simulate(circuit, { a: false, b: false }, library).out).toBe(true);
      expect(simulate(circuit, { a: true, b: false }, library).out).toBe(true);
      expect(simulate(circuit, { a: false, b: true }, library).out).toBe(true);
      expect(simulate(circuit, { a: true, b: true }, library).out).toBe(false);
    });
  });

  describe('Composite Component Evaluation', () => {
    it('should evaluate a composite HalfAdder', () => {
      // First, create the HalfAdder composite
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
        nodes: [
          {
            id: 'xor1',
            componentRef: 'Xor',
            arguments: {},
            inputs: [
              { id: 'xor1.a', name: 'a', portType: bitType() },
              { id: 'xor1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'xor1.out', name: 'out', portType: bitType() }],
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
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'xor1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'xor1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c3',
            source: { nodeId: 'xor1', portName: 'out' },
            target: { nodeId: '', portName: 'sum' },
            portType: bitType(),
          },
          {
            id: 'c4',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c5',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c6',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: '', portName: 'carry' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      // Register HalfAdder in library
      library.registerUser(halfAdder);

      // Test all combinations
      const result1 = simulate(halfAdder, { a: false, b: false }, library);
      expect(result1.sum).toBe(false);
      expect(result1.carry).toBe(false);

      const result2 = simulate(halfAdder, { a: false, b: true }, library);
      expect(result2.sum).toBe(true);
      expect(result2.carry).toBe(false);

      const result3 = simulate(halfAdder, { a: true, b: false }, library);
      expect(result3.sum).toBe(true);
      expect(result3.carry).toBe(false);

      const result4 = simulate(halfAdder, { a: true, b: true }, library);
      expect(result4.sum).toBe(false);
      expect(result4.carry).toBe(true);
    });

    it('should evaluate nested composites (FullAdder from HalfAdders)', () => {
      // Create HalfAdder
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
        nodes: [
          {
            id: 'xor1',
            componentRef: 'Xor',
            arguments: {},
            inputs: [
              { id: 'xor1.a', name: 'a', portType: bitType() },
              { id: 'xor1.b', name: 'b', portType: bitType() },
            ],
            outputs: [{ id: 'xor1.out', name: 'out', portType: bitType() }],
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
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'xor1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'xor1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c3',
            source: { nodeId: 'xor1', portName: 'out' },
            target: { nodeId: '', portName: 'sum' },
            portType: bitType(),
          },
          {
            id: 'c4',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'and1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c5',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'and1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c6',
            source: { nodeId: 'and1', portName: 'out' },
            target: { nodeId: '', portName: 'carry' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      library.registerUser(halfAdder);

      // Create FullAdder from two HalfAdders
      const fullAdder: Circuit = {
        id: 'full-adder',
        name: 'FullAdder',
        parameters: [],
        inputs: [
          { name: 'a', portType: bitType() },
          { name: 'b', portType: bitType() },
          { name: 'cin', portType: bitType() },
        ],
        outputs: [
          { name: 'sum', portType: bitType() },
          { name: 'cout', portType: bitType() },
        ],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'ha1',
            componentRef: 'HalfAdder',
            arguments: {},
            inputs: [
              { id: 'ha1.a', name: 'a', portType: bitType() },
              { id: 'ha1.b', name: 'b', portType: bitType() },
            ],
            outputs: [
              { id: 'ha1.sum', name: 'sum', portType: bitType() },
              { id: 'ha1.carry', name: 'carry', portType: bitType() },
            ],
            clocks: [],
          },
          {
            id: 'ha2',
            componentRef: 'HalfAdder',
            arguments: {},
            inputs: [
              { id: 'ha2.a', name: 'a', portType: bitType() },
              { id: 'ha2.b', name: 'b', portType: bitType() },
            ],
            outputs: [
              { id: 'ha2.sum', name: 'sum', portType: bitType() },
              { id: 'ha2.carry', name: 'carry', portType: bitType() },
            ],
            clocks: [],
          },
          {
            id: 'or1',
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
          // ha1 inputs
          {
            id: 'c1',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'ha1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: '', portName: 'b' },
            target: { nodeId: 'ha1', portName: 'b' },
            portType: bitType(),
          },
          // ha2 inputs
          {
            id: 'c3',
            source: { nodeId: 'ha1', portName: 'sum' },
            target: { nodeId: 'ha2', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c4',
            source: { nodeId: '', portName: 'cin' },
            target: { nodeId: 'ha2', portName: 'b' },
            portType: bitType(),
          },
          // Final sum
          {
            id: 'c5',
            source: { nodeId: 'ha2', portName: 'sum' },
            target: { nodeId: '', portName: 'sum' },
            portType: bitType(),
          },
          // OR gate for carry
          {
            id: 'c6',
            source: { nodeId: 'ha1', portName: 'carry' },
            target: { nodeId: 'or1', portName: 'a' },
            portType: bitType(),
          },
          {
            id: 'c7',
            source: { nodeId: 'ha2', portName: 'carry' },
            target: { nodeId: 'or1', portName: 'b' },
            portType: bitType(),
          },
          {
            id: 'c8',
            source: { nodeId: 'or1', portName: 'out' },
            target: { nodeId: '', portName: 'cout' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      library.registerUser(fullAdder);

      // Test FullAdder
      const result = simulate(fullAdder, { a: true, b: true, cin: true }, library);
      expect(result.sum).toBe(true); // 1 + 1 + 1 = 11 in binary
      expect(result.cout).toBe(true);
    });
  });

  describe('Circuit Validation', () => {
    it('should validate a correct circuit', () => {
      const circuit: Circuit = {
        id: 'valid',
        name: 'Valid',
        parameters: [],
        inputs: [{ name: 'a', portType: bitType() }],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'not1',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'c1',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: 'not1', portName: 'out' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const result = validateCircuitForSimulation(circuit, library);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unresolved component references', () => {
      const circuit: Circuit = {
        id: 'invalid',
        name: 'Invalid',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'unknown1',
            componentRef: 'UnknownComponent',
            arguments: {},
            inputs: [],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      };

      const result = validateCircuitForSimulation(circuit, library);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Cannot resolve component');
    });

    it('should detect combinational loops', () => {
      // Create a circuit with a loop: NOT -> NOT -> back to first NOT
      const circuit: Circuit = {
        id: 'loop',
        name: 'Loop',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'not1',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
          {
            id: 'not2',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not2.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not2.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'c1',
            source: { nodeId: 'not1', portName: 'out' },
            target: { nodeId: 'not2', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: 'not2', portName: 'out' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      const result = validateCircuitForSimulation(circuit, library);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('loop'))).toBe(true);
    });

    it('should detect type mismatches', () => {
      const circuit: Circuit = {
        id: 'type-mismatch',
        name: 'TypeMismatch',
        parameters: [],
        inputs: [{ name: 'a', portType: bitType() }],
        outputs: [{ name: 'out', portType: busType(8) }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [
          {
            id: 'c1',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(), // Connecting bit to bus
          },
        ],
        implementation: { kind: 'composite' },
      };

      const result = validateCircuitForSimulation(circuit, library);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Type mismatch'))).toBe(true);
    });
  });

  describe('Multi-Step Simulation', () => {
    it('should simulate multiple steps', () => {
      const circuit: Circuit = {
        id: 'multi-step',
        name: 'MultiStep',
        parameters: [],
        inputs: [{ name: 'a', portType: bitType() }],
        outputs: [{ name: 'out', portType: bitType() }],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'not1',
            componentRef: 'Not',
            arguments: {},
            inputs: [{ id: 'not1.in', name: 'in', portType: bitType() }],
            outputs: [{ id: 'not1.out', name: 'out', portType: bitType() }],
            clocks: [],
          },
        ],
        connections: [
          {
            id: 'c1',
            source: { nodeId: '', portName: 'a' },
            target: { nodeId: 'not1', portName: 'in' },
            portType: bitType(),
          },
          {
            id: 'c2',
            source: { nodeId: 'not1', portName: 'out' },
            target: { nodeId: '', portName: 'out' },
            portType: bitType(),
          },
        ],
        implementation: { kind: 'composite' },
      };

      let state = createSimulationState(circuit);
      state = setInputs(state, circuit, { a: true });

      const states = simulateSteps(circuit, state, library, 3);

      expect(states).toHaveLength(4); // Initial + 3 steps
      expect(states[0].cycle).toBe(0);
      expect(states[3].cycle).toBe(3);
    });
  });
});
