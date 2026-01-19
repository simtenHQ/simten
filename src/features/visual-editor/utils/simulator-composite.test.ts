/**
 * Tests for composite component evaluation in the simulator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runSimulationStep } from './simulator';
import { useComponentLibraryStore } from '../stores/component-library-store';
import type { IRState } from '../types';
import type { Circuit } from '../types/ir-v0.1';

describe('Composite Component Evaluation', () => {
  beforeEach(() => {
    // Clear the component library before each test
    useComponentLibraryStore.getState().clearAll();
  });

  it('should evaluate a simple pass-through composite component', () => {
    // Define a simple pass-through component: MyAndGate that just connects input to output
    const myAndGateCircuit: Circuit = {
      id: 'myandgate',
      name: 'MyAndGate',
      parameters: [],
      inputs: [
        { name: 'a', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'result', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: '', portName: 'result' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    // Register the circuit in the component library
    useComponentLibraryStore.getState().registerUser(myAndGateCircuit);

    // Create a test circuit: SWITCH (ON) -> MyAndGate -> LED
    const ir: IRState = {
      components: {
        'switch1': {
          id: 'switch1',
          type: 'SWITCH',
          value: true
        },
        'mygate': {
          id: 'mygate',
          type: 'MyAndGate'
        },
        'led1': {
          id: 'led1',
          type: 'LED',
          value: false
        }
      },
      connections: {
        'conn1': {
          id: 'conn1',
          sourceComponentId: 'switch1',
          sourcePortIndex: 0,
          targetComponentId: 'mygate',
          targetPortIndex: 0
        },
        'conn2': {
          id: 'conn2',
          sourceComponentId: 'mygate',
          sourcePortIndex: 0,
          targetComponentId: 'led1',
          targetPortIndex: 0
        }
      }
    };

    // Run simulation
    const result = runSimulationStep(ir);

    // LED should be ON because switch is ON and MyAndGate passes it through
    expect(result.components['led1']).toHaveProperty('value', true);
  });

  it('should evaluate a composite component with internal logic', () => {
    // Define a composite component with an internal AND gate
    const myCompositeCircuit: Circuit = {
      id: 'mycomposite',
      name: 'MyComposite',
      parameters: [],
      inputs: [
        { name: 'a', portType: { kind: 'bit' } },
        { name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.in0', name: 'in0', portType: { kind: 'bit' } },
            { id: 'and1.in1', name: 'in1', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'and1', portName: 'in0' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'and1', portName: 'in1' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn3',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    // Register the circuit
    useComponentLibraryStore.getState().registerUser(myCompositeCircuit);

    // Create test circuit: SWITCH1 (ON) and SWITCH2 (ON) -> MyComposite -> LED
    const ir: IRState = {
      components: {
        'switch1': {
          id: 'switch1',
          type: 'SWITCH',
          value: true
        },
        'switch2': {
          id: 'switch2',
          type: 'SWITCH',
          value: true
        },
        'composite': {
          id: 'composite',
          type: 'MyComposite'
        },
        'led1': {
          id: 'led1',
          type: 'LED',
          value: false
        }
      },
      connections: {
        'conn1': {
          id: 'conn1',
          sourceComponentId: 'switch1',
          sourcePortIndex: 0,
          targetComponentId: 'composite',
          targetPortIndex: 0
        },
        'conn2': {
          id: 'conn2',
          sourceComponentId: 'switch2',
          sourcePortIndex: 0,
          targetComponentId: 'composite',
          targetPortIndex: 1
        },
        'conn3': {
          id: 'conn3',
          sourceComponentId: 'composite',
          sourcePortIndex: 0,
          targetComponentId: 'led1',
          targetPortIndex: 0
        }
      }
    };

    // Run simulation
    const result = runSimulationStep(ir);

    // LED should be ON because both switches are ON and MyComposite has an AND gate
    expect(result.components['led1']).toHaveProperty('value', true);
  });

  it('should handle composite component with one input OFF', () => {
    // Reuse the MyComposite definition from previous test
    const myCompositeCircuit: Circuit = {
      id: 'mycomposite',
      name: 'MyComposite',
      parameters: [],
      inputs: [
        { name: 'a', portType: { kind: 'bit' } },
        { name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.in0', name: 'in0', portType: { kind: 'bit' } },
            { id: 'and1.in1', name: 'in1', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'and1', portName: 'in0' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'and1', portName: 'in1' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn3',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    useComponentLibraryStore.getState().registerUser(myCompositeCircuit);

    // Create test circuit: SWITCH1 (ON) and SWITCH2 (OFF) -> MyComposite -> LED
    const ir: IRState = {
      components: {
        'switch1': {
          id: 'switch1',
          type: 'SWITCH',
          value: true
        },
        'switch2': {
          id: 'switch2',
          type: 'SWITCH',
          value: false
        },
        'composite': {
          id: 'composite',
          type: 'MyComposite'
        },
        'led1': {
          id: 'led1',
          type: 'LED',
          value: false
        }
      },
      connections: {
        'conn1': {
          id: 'conn1',
          sourceComponentId: 'switch1',
          sourcePortIndex: 0,
          targetComponentId: 'composite',
          targetPortIndex: 0
        },
        'conn2': {
          id: 'conn2',
          sourceComponentId: 'switch2',
          sourcePortIndex: 0,
          targetComponentId: 'composite',
          targetPortIndex: 1
        },
        'conn3': {
          id: 'conn3',
          sourceComponentId: 'composite',
          sourcePortIndex: 0,
          targetComponentId: 'led1',
          targetPortIndex: 0
        }
      }
    };

    // Run simulation
    const result = runSimulationStep(ir);

    // LED should be OFF because one switch is OFF
    expect(result.components['led1']).toHaveProperty('value', false);
  });
});
