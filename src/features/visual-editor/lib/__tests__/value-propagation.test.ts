/**
 * Value Propagation Tests
 *
 * Tests that the flat simulator correctly propagates values through nested composites,
 * fixing the bug where values get lost crossing composite boundaries.
 *
 * This was the critical bug affecting 6502 CPU memory operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { elaborate } from '../elaboration';
import {
  runFlatSimulationTick,
  initializeFlatSequentialState
} from '../flat-simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { getPrimitives } from '../primitives';
import type { Circuit } from '../../types/circuit';

describe('Value Propagation Through Composites', () => {
  beforeEach(() => {
    const library = useComponentLibraryStore.getState();
    library.clearAll();

    // Register all real primitives
    const primitives = getPrimitives();
    library.registerPrimitives(primitives);
  });

  it('propagates values through nested composites correctly', () => {
    const library = useComponentLibraryStore.getState();

    // Define Level 1 composite: Wraps a Constant
    library.registerStandard({
      id: 'const-wrapper',
      name: 'ConstWrapper',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'value', portType: { kind: 'bus', width: 8 } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const',
          componentRef: 'Constant',
          arguments: { value: 42 },
          inputs: [],
          outputs: [
            { id: 'const-out', name: 'out', portType: { kind: 'bus', width: 8 } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'const-to-output',
          source: { nodeId: 'const', portName: 'out' },
          target: { nodeId: '', portName: 'value' },
          portType: { kind: 'bus', width: 8 }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Define Level 2 composite: Uses ConstWrapper + DFlipFlop
    library.registerStandard({
      id: 'reg-wrapper',
      name: 'RegWrapper',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'source',
          componentRef: 'ConstWrapper',
          arguments: {},
          inputs: [],
          outputs: [
            { id: 'source-value', name: 'value', portType: { kind: 'bus', width: 8 } }
          ],
          clocks: []
        },
        {
          id: 'dff',
          componentRef: 'DFlipFlop',
          arguments: { initial: false },
          inputs: [
            { id: 'dff-d', name: 'd', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'dff-q', name: 'q', portType: { kind: 'bit' } },
            { id: 'dff-q_bar', name: 'q_bar', portType: { kind: 'bit' } }
          ],
          clocks: [
            { id: 'dff-clk', name: 'clk' }
          ]
        }
      ],
      connections: [
        {
          id: 'source-to-dff',
          source: { nodeId: 'source', portName: 'value' },
          target: { nodeId: 'dff', portName: 'd' },
          portType: { kind: 'bit' }
        },
        {
          id: 'dff-to-output',
          source: { nodeId: 'dff', portName: 'q' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Top-level circuit: Uses RegWrapper (3 levels deep!)
    const circuit: Circuit = {
      id: 'nested-test',
      name: 'NestedTest',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'result', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'wrapper',
          componentRef: 'RegWrapper',
          arguments: {},
          inputs: [],
          outputs: [
            { id: 'wrapper-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'wrapper-to-output',
          source: { nodeId: 'wrapper', portName: 'out' },
          target: { nodeId: '', portName: 'result' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    // Elaborate (should flatten 3 levels)
    const flatCircuit = elaborate(circuit, library);

    // Should have 2 primitives (Constant and DFlipFlop)
    expect(flatCircuit.nodes).toHaveLength(2);
    expect(flatCircuit.nodes[0].id).toBe('wrapper.source.const');
    expect(flatCircuit.nodes[1].id).toBe('wrapper.dff');

    // Initialize and simulate
    const seqState = initializeFlatSequentialState(flatCircuit);

    // Initial DFF state
    expect(seqState.currentState.get('wrapper.dff')).toBe(false);

    // Run one tick
    const result = runFlatSimulationTick(flatCircuit, seqState);

    expect(result.error).toBeUndefined();

    // After tick, DFF should have latched the value from nested Constant
    // Constant(42) -> ConstWrapper -> RegWrapper -> DFF
    // This tests 3-level value propagation!
    const dffState = seqState.currentState.get('wrapper.dff');
    expect(dffState).toBeTruthy(); // Should be true or 1 (truthy)

    // Output should also propagate correctly
    const outputValue = result.portValues.get('__top__.result');
    expect(outputValue).toBeTruthy();
  });

  it('propagates values through multiple nested composites with real primitives', () => {
    const library = useComponentLibraryStore.getState();

    // Define an inverter composite with a Not gate inside
    library.registerStandard({
      id: 'inverter',
      name: 'Inverter',
      parameters: [],
      inputs: [
        { name: 'in', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'not1',
          componentRef: 'Not',
          arguments: {},
          inputs: [
            { id: 'not1-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'not1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'in-to-not',
          source: { nodeId: '', portName: 'in' },
          target: { nodeId: 'not1', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'not-to-out',
          source: { nodeId: 'not1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Define a double inverter (Not->Not = identity) with 2 Inverter instances chained
    library.registerStandard({
      id: 'double-inverter',
      name: 'DoubleInverter',
      parameters: [],
      inputs: [
        { name: 'in', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'inv1',
          componentRef: 'Inverter',
          arguments: {},
          inputs: [
            { id: 'inv1-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'inv1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        },
        {
          id: 'inv2',
          componentRef: 'Inverter',
          arguments: {},
          inputs: [
            { id: 'inv2-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'inv2-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'in-to-inv1',
          source: { nodeId: '', portName: 'in' },
          target: { nodeId: 'inv1', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'inv1-to-inv2',
          source: { nodeId: 'inv1', portName: 'out' },
          target: { nodeId: 'inv2', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'inv2-to-out',
          source: { nodeId: 'inv2', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Top-level: Constant(1) -> DoubleInverter -> output
    // Result should be: 1 -> Not -> 0 -> Not -> 1
    const circuit: Circuit = {
      id: 'inverter-test',
      name: 'InverterTest',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'final', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'const',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [
            { id: 'const-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        },
        {
          id: 'double',
          componentRef: 'DoubleInverter',
          arguments: {},
          inputs: [
            { id: 'double-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'double-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'const-to-double',
          source: { nodeId: 'const', portName: 'out' },
          target: { nodeId: 'double', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'double-to-final',
          source: { nodeId: 'double', portName: 'out' },
          target: { nodeId: '', portName: 'final' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    // Elaborate - should flatten to 3 primitives: 1 Constant + 2 Not gates
    const flatCircuit = elaborate(circuit, library);

    expect(flatCircuit.nodes).toHaveLength(3);
    expect(flatCircuit.nodes.map(n => n.primitiveType).sort()).toEqual(['Constant', 'Not', 'Not']);

    // Initialize and simulate
    const seqState = initializeFlatSequentialState(flatCircuit);
    const result = runFlatSimulationTick(flatCircuit, seqState);

    expect(result.error).toBeUndefined();

    // Value should propagate: 1 -> Not(1)=false -> Not(false)=true -> output
    const outputValue = result.portValues.get('__top__.final');
    expect(outputValue).toBe(true);  // Bit values are booleans
  });
});
