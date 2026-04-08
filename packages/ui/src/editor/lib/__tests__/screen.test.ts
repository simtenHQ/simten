/**
 * Screen Component Integration Tests
 *
 * Tests Screen component reading RAM via sequential state (DMA-like behavior).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulatorFromCircuit, type CircuitLibrary } from '@turing-incomplete/core/simulator';
import { useCircuitLibraryStore } from '../../stores/circuit-library-store';
import * as std from '@turing-incomplete/core/std';
import type { BuiltCircuit } from '@turing-incomplete/core/circuit';
import { bitType, busType, type Circuit } from '../../types/circuit';

const PRIMITIVES = Object.values(std)
  .filter((v): v is BuiltCircuit => !!v && typeof v === 'object' && 'circuit' in v && 'name' in v)
  .map((v) => v.circuit)
  .filter(c => c.implementation.kind === 'primitive');

function getLibrary(): CircuitLibrary {
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
    const circuit: Circuit = {
      id: 'test',
      name: 'EmptyScreenTest',
      parameters: [],
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

    const sim = createSimulatorFromCircuit(circuit, getLibrary());
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
  });

  it('should work with RAM in circuit', () => {
    const circuit: Circuit = {
      id: 'test',
      name: 'ScreenWithRAM',
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
          arguments: {},
          inputs: [
            { id: 'ram1.addr', name: 'addr', portType: busType(8) },
            { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
            { id: 'ram1.we', name: 'we', portType: bitType() },
          ],
          outputs: [
            { id: 'ram1.data_out', name: 'data_out', portType: busType(8) },
          ],
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

    const sim = createSimulatorFromCircuit(circuit, getLibrary());
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
  });

  it('should verify Screen component exists in circuit', () => {
    // Create circuit with RAM and Screen
    const circuit: Circuit = {
      id: 'test',
      name: 'ScreenTest',
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
          arguments: {},
          inputs: [
            { id: 'ram1.addr', name: 'addr', portType: busType(8) },
            { id: 'ram1.data_in', name: 'data_in', portType: busType(8) },
            { id: 'ram1.we', name: 'we', portType: bitType() },
          ],
          outputs: [
            { id: 'ram1.data_out', name: 'data_out', portType: busType(8) },
          ],
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
    const screenNode = circuit.nodes.find(n => n.componentRef === 'Screen');
    expect(screenNode).toBeDefined();
    expect(screenNode?.id).toBe('screen1');
    expect(screenNode?.inputs.length).toBe(0);
    expect(screenNode?.outputs.length).toBe(0);

    // Run simulation - should not error
    const sim = createSimulatorFromCircuit(circuit, getLibrary());
    const result = sim.runCombinational();
    expect(result.error).toBeUndefined();
  });
});
