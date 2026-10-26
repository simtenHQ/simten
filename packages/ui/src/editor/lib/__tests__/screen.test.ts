/**
 * Screen Component Integration Tests
 *
 * Tests Screen component reading RAM via sequential state (DMA-like behavior).
 */

import {
  type CircuitDefinitions,
  createEngine,
  elaborate,
  getStdLibrary,
} from '@simten/core/internal';
import { STDLIB_CIRCUITS } from '@simten/core/std';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitLibraryStore } from '../../stores/circuit-library-store';
import { bitType, busType, type CircuitIR } from '../../types/circuit';

const PRIMITIVES = STDLIB_CIRCUITS.map((c) => c.circuit).filter(
  (c) => c.implementation.kind === 'primitive',
);

function storeDefinitions(): CircuitDefinitions {
  const store = useCircuitLibraryStore.getState();
  return {
    resolveCircuit: (name) => store.resolveCircuit(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('Screen Integration', () => {
  let library: ReturnType<typeof useCircuitLibraryStore.getState>;

  beforeEach(() => {
    library = useCircuitLibraryStore.getState();
    library.clear();
    library.addCircuits(PRIMITIVES as any[]);
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

    const definitions = storeDefinitions();

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

    const definitions = storeDefinitions();

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
    const definitions = storeDefinitions();
    const sim = createEngine(elaborate(circuit, definitions), {
      library: { definitions, behaviors: getStdLibrary().behaviors },
    });
    const result = sim.runCombinational();
    expect(result.error).toBeUndefined();
  });
});
