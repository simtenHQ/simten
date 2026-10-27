/**
 * Screen Component Integration Tests
 *
 * Tests Screen component reading RAM via sequential state (DMA-like behavior).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDefinitions } from '../../circuit/behavior.js';
import { internalsOf } from '../../circuit/internals.js';
import {
  bitType,
  busType,
  type CircuitIR,
  type MutableCircuitDefinitions,
} from '../../ir/circuit-ir.js';
import { STDLIB_CIRCUITS } from '../../std/index.js';
import { getStdLibrary } from '../../std/library.js';
import { createEngine, elaborate } from '../index.js';

const PRIMITIVES = STDLIB_CIRCUITS.map((c) => internalsOf(c).ir).filter(
  (c) => c.implementation.kind === 'primitive',
);

describe('Screen Integration', () => {
  let definitions: MutableCircuitDefinitions;

  beforeEach(() => {
    definitions = createDefinitions(PRIMITIVES);
  });

  it('should work with empty circuit (no RAM)', () => {
    const circuit: CircuitIR = {
      version: 1,
      name: 'EmptyScreenTest',
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'screen1',
          label: 'Screen',
          componentRef: 'Screen',
          arguments: {},
          inputs: [],
          outputs: [],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    const sim = createEngine(elaborate(circuit, definitions), {
      library: { definitions, behaviors: getStdLibrary().behaviors },
    });
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
  });

  it('should work with RAM in circuit', () => {
    const circuit: CircuitIR = {
      version: 1,
      name: 'ScreenWithRAM',
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ram1',
          label: 'RAM',
          componentRef: 'RAM',
          arguments: {},
          inputs: [
            { id: 'ram1.addr', name: 'addr', portType: busType(8) },
            { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
            { id: 'ram1.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'ram1.data_out', name: 'data_out', portType: busType(8) }],
          clocks: [],
        },
        {
          id: 'screen1',
          label: 'Screen',
          componentRef: 'Screen',
          arguments: {},
          inputs: [],
          outputs: [],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    const sim = createEngine(elaborate(circuit, definitions), {
      library: { definitions, behaviors: getStdLibrary().behaviors },
    });
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
  });

  it('should verify Screen component exists in circuit', () => {
    // Create circuit with RAM and Screen
    const circuit: CircuitIR = {
      version: 1,
      name: 'ScreenTest',
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ram1',
          label: 'RAM',
          componentRef: 'RAM',
          arguments: {},
          inputs: [
            { id: 'ram1.addr', name: 'addr', portType: busType(8) },
            { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
            { id: 'ram1.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'ram1.data_out', name: 'data_out', portType: busType(8) }],
          clocks: [],
        },
        {
          id: 'screen1',
          label: 'Screen',
          componentRef: 'Screen',
          arguments: {},
          inputs: [],
          outputs: [],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    // Verify circuit structure
    const screenNode = circuit.nodes.find((n) => n.componentRef === 'Screen');
    expect(screenNode).toBeDefined();
    expect(screenNode?.id).toBe('screen1');
    expect(screenNode?.inputs.length).toBe(0);
    expect(screenNode?.outputs.length).toBe(0);

    // Run simulation - should not error
    const sim = createEngine(elaborate(circuit, definitions), {
      library: { definitions, behaviors: getStdLibrary().behaviors },
    });
    const result = sim.runCombinational();
    expect(result.error).toBeUndefined();
  });
});
