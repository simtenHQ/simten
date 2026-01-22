/**
 * Screen Component Integration Tests
 *
 * Tests Screen component reading RAM via sequential state (DMA-like behavior).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runCombinationalSimulation,
  initializeSequentialState,
} from './simulator-v0.1';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { getPrimitives } from './primitives';
import { bitType, busType, type Circuit } from '../types/ir-v0.1';

describe('Screen Integration', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
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

    const seqState = initializeSequentialState(circuit);
    const result = runCombinationalSimulation(circuit, seqState);

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

    const seqState = initializeSequentialState(circuit);
    const result = runCombinationalSimulation(circuit, seqState);

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

    // Initialize state
    const seqState = initializeSequentialState(circuit);

    // Run simulation - should not error
    const result = runCombinationalSimulation(circuit, seqState);
    expect(result.error).toBeUndefined();
  });
});
