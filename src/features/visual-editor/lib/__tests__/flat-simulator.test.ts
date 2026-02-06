/**
 * Flat Simulator Integration Tests
 *
 * Tests the complete flow: elaborate circuit -> simulate flat circuit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { elaborate } from '../elaboration';
import {
  runFlatSimulationTick,
  initializeFlatSequentialState
} from '../flat-simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { getPrimitives } from '../primitives';
import type { Circuit } from '../../types/ir-v0.1';

describe('Flat Simulator', () => {
  beforeEach(() => {
    // Clear component library before each test
    const library = useComponentLibraryStore.getState();
    library.clearAll();

    // Register all real primitives (includes Constant, Register, DFlipFlop, etc.)
    const primitives = getPrimitives();
    library.registerPrimitives(primitives);
  });

  it('simulates simple flat circuit with DFlipFlop', () => {
    const library = useComponentLibraryStore.getState();

    // Create a simple circuit: Constant -> DFlipFlop
    const circuit: Circuit = {
      id: 'simple-dff',
      name: 'SimpleDFF',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const1',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [
            { id: 'const1-out', name: 'out', portType: { kind: 'bus', width: 8 } }
          ],
          clocks: []
        },
        {
          id: 'dff1',
          componentRef: 'DFlipFlop',
          arguments: { initial: false },
          inputs: [
            { id: 'dff1-d', name: 'd', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'dff1-q', name: 'q', portType: { kind: 'bit' } },
            { id: 'dff1-q_bar', name: 'q_bar', portType: { kind: 'bit' } }
          ],
          clocks: [
            { id: 'dff1-clk', name: 'clk' }
          ]
        }
      ],
      connections: [
        {
          id: 'const-to-dff',
          source: { nodeId: 'const1', portName: 'out' },
          target: { nodeId: 'dff1', portName: 'd' },
          portType: { kind: 'bit' }
        },
        {
          id: 'dff-to-output',
          source: { nodeId: 'dff1', portName: 'q' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    // Elaborate circuit
    const flatCircuit = elaborate(circuit, library);

    // Should have 2 primitives
    expect(flatCircuit.nodes).toHaveLength(2);

    // Initialize state
    const seqState = initializeFlatSequentialState(flatCircuit);

    // Initial state should be false
    expect(seqState.currentState.get('dff1')).toBe(false);

    // Run one simulation tick
    const result = runFlatSimulationTick(flatCircuit, seqState);

    expect(result.error).toBeUndefined();

    // After one tick, DFF should have latched the value
    // Note: Constant outputs 1, DFF latches it as truthy (could be 1 or true depending on conversion)
    const dffState = seqState.currentState.get('dff1');
    expect(dffState).toBeTruthy(); // Either 1 or true is fine
  });

  it('elaborates nested composite correctly', () => {
    const library = useComponentLibraryStore.getState();

    // Define a composite that wraps a DFlipFlop
    library.registerStandard({
      id: 'dff-wrapper',
      name: 'DFFWrapper',
      parameters: [],
      inputs: [
        { name: 'din', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'dout', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'internal_dff',
          componentRef: 'DFlipFlop',
          arguments: {},
          inputs: [
            { id: 'internal_dff-d', name: 'd', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'internal_dff-q', name: 'q', portType: { kind: 'bit' } },
            { id: 'internal_dff-q_bar', name: 'q_bar', portType: { kind: 'bit' } }
          ],
          clocks: [
            { id: 'internal_dff-clk', name: 'clk' }
          ]
        }
      ],
      connections: [
        {
          id: 'input-conn',
          source: { nodeId: '', portName: 'din' },
          target: { nodeId: 'internal_dff', portName: 'd' },
          portType: { kind: 'bit' }
        },
        {
          id: 'output-conn',
          source: { nodeId: 'internal_dff', portName: 'q' },
          target: { nodeId: '', portName: 'dout' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Create top-level circuit using the wrapper
    const circuit: Circuit = {
      id: 'nested-test',
      name: 'NestedTest',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'wrapper1',
          componentRef: 'DFFWrapper',
          arguments: {},
          inputs: [
            { id: 'wrapper1-din', name: 'din', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'wrapper1-dout', name: 'dout', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [],
      implementation: { kind: 'composite' }
    };

    // Elaborate (should flatten)
    const flatCircuit = elaborate(circuit, library);

    // Should have 1 primitive (the wrapped DFlipFlop)
    expect(flatCircuit.nodes).toHaveLength(1);
    expect(flatCircuit.nodes[0].id).toBe('wrapper1.internal_dff');
    expect(flatCircuit.nodes[0].primitiveType).toBe('DFlipFlop');

    // Hierarchy should show nesting
    expect(flatCircuit.hierarchy.children).toHaveLength(1);
    expect(flatCircuit.hierarchy.children[0].path).toBe('wrapper1');
  });
});
