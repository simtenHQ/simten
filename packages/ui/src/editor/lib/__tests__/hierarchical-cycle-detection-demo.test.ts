/**
 * Hierarchical Cycle Detection - Integration Demo
 *
 * Demonstrates that composites with internal registers no longer trigger false cycle detection
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

describe('Hierarchical Cycle Detection - Real World Scenarios', () => {
  let library: ReturnType<typeof useCircuitLibraryStore.getState>;

  // Minimal Add circuit (8-bit adder, no carry) for tests that reference 'Add'
  const Add: import('../../types/circuit').Circuit = {
    id: 'add',
    name: 'Add',
    parameters: [],
    inputs: [{ name: 'a', portType: busType(8) }, { name: 'b', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
  };

  beforeEach(() => {
    library = useCircuitLibraryStore.getState();
    library.clear();
    library.addCircuits(PRIMITIVES as any[]);
    library.addCircuit(Add);
  });

  it('should compile a multi-level hierarchy with state machines', () => {
    // Create a simple FSM (Finite State Machine) with register
    const fsm: Circuit = {
      id: 'fsm',
      name: 'SimpleFSM',
      parameters: [],
      inputs: [{ name: 'trigger', portType: bitType() }],
      outputs: [{ name: 'state', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'state_reg',
          label: 'State',
          componentRef: 'Register',
          arguments: { initial: 0 },
          inputs: [
            { id: 'state_reg.data', name: 'data', portType: busType(8) },
            { id: 'state_reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'state_reg.q', name: 'q', portType: busType(8) }],
          clocks: [{ id: 'state_reg.clk', name: 'clk' }],
        },
        {
          id: 'next_state',
          label: 'NextState',
          componentRef: 'Add',
          arguments: {},
          inputs: [
            { id: 'next_state.a', name: 'a', portType: busType(8) },
            { id: 'next_state.b', name: 'b', portType: busType(8) },
          ],
          outputs: [{ id: 'next_state.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
        {
          id: 'one',
          label: 'One',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'one.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
        {
          id: 'we',
          label: 'WriteEnable',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'we.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        // Feedback loop: state → next_state → state (through register!)
        {
          id: 'c1',
          source: { nodeId: 'state_reg', portName: 'q' },
          target: { nodeId: 'next_state', portName: 'a' },
          portType: busType(8),
        },
        {
          id: 'c2',
          source: { nodeId: 'one', portName: 'out' },
          target: { nodeId: 'next_state', portName: 'b' },
          portType: busType(8),
        },
        {
          id: 'c3',
          source: { nodeId: 'next_state', portName: 'out' },
          target: { nodeId: 'state_reg', portName: 'data' },
          portType: busType(8),
        },
        {
          id: 'c4',
          source: { nodeId: 'we', portName: 'out' },
          target: { nodeId: 'state_reg', portName: 'we' },
          portType: busType(8),
        },
        // Output
        {
          id: 'c5',
          source: { nodeId: 'state_reg', portName: 'q' },
          target: { nodeId: '', portName: 'state' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.addCircuit(fsm);

    // Create a Controller that contains the FSM
    const controller: Circuit = {
      id: 'ctrl',
      name: 'Controller',
      parameters: [],
      inputs: [{ name: 'enable', portType: bitType() }],
      outputs: [{ name: 'status', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'fsm1',
          label: 'FSM',
          componentRef: 'SimpleFSM',
          arguments: {},
          inputs: [{ id: 'fsm1.trigger', name: 'trigger', portType: bitType() }],
          outputs: [{ id: 'fsm1.state', name: 'state', portType: busType(8) }],
          clocks: [{ id: 'fsm1.clk', name: 'clk' }],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'enable' },
          target: { nodeId: 'fsm1', portName: 'trigger' },
          portType: bitType(),
        },
        {
          id: 'c2',
          source: { nodeId: 'fsm1', portName: 'state' },
          target: { nodeId: '', portName: 'status' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.addCircuit(controller);

    // Create a top-level system with multiple controllers
    const system: Circuit = {
      id: 'sys',
      name: 'System',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ctrl1',
          label: 'Controller1',
          componentRef: 'Controller',
          arguments: {},
          inputs: [{ id: 'ctrl1.enable', name: 'enable', portType: bitType() }],
          outputs: [{ id: 'ctrl1.status', name: 'status', portType: busType(8) }],
          clocks: [{ id: 'ctrl1.clk', name: 'clk' }],
        },
        {
          id: 'ctrl2',
          label: 'Controller2',
          componentRef: 'Controller',
          arguments: {},
          inputs: [{ id: 'ctrl2.enable', name: 'enable', portType: bitType() }],
          outputs: [{ id: 'ctrl2.status', name: 'status', portType: busType(8) }],
          clocks: [{ id: 'ctrl2.clk', name: 'clk' }],
        },
        {
          id: 'sw',
          label: 'Switch',
          componentRef: 'Switch',
          arguments: { value: true },
          inputs: [],
          outputs: [{ id: 'sw.out', name: 'out', portType: bitType() }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: 'sw', portName: 'out' },
          target: { nodeId: 'ctrl1', portName: 'enable' },
          portType: bitType(),
        },
        {
          id: 'c2',
          source: { nodeId: 'sw', portName: 'out' },
          target: { nodeId: 'ctrl2', portName: 'enable' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // Before the fix: This would fail with "Cycle detected in circuit"
    // After the fix: This should succeed because registers break the paths
    const sim = createSimulatorFromCircuit(system, getLibrary());
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
    expect(result.portValues.get('sw.out')).toBe(true);
  });

  it('should demonstrate the false positive scenario from the plan', () => {
    // This recreates the exact scenario from the plan:
    // IngressController → Arbiter → PacketForwarder → IngressController
    // Each composite has internal registers that break the combinational loop

    // Create a minimal controller with register
    const ingressController: Circuit = {
      id: 'ingress',
      name: 'IngressController',
      parameters: [],
      inputs: [{ name: 'data_in', portType: busType(8) }],
      outputs: [{ name: 'data_out', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'buf_reg',
          label: 'BufferReg',
          componentRef: 'Register',
          arguments: { initial: 0 },
          inputs: [
            { id: 'buf_reg.data', name: 'data', portType: busType(8) },
            { id: 'buf_reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'buf_reg.q', name: 'q', portType: busType(8) }],
          clocks: [{ id: 'buf_reg.clk', name: 'clk' }],
        },
        {
          id: 'we',
          label: 'WE',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'we.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'data_in' },
          target: { nodeId: 'buf_reg', portName: 'data' },
          portType: busType(8),
        },
        {
          id: 'c2',
          source: { nodeId: 'we', portName: 'out' },
          target: { nodeId: 'buf_reg', portName: 'we' },
          portType: busType(8),
        },
        {
          id: 'c3',
          source: { nodeId: 'buf_reg', portName: 'q' },
          target: { nodeId: '', portName: 'data_out' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const arbiter: Circuit = {
      id: 'arb',
      name: 'SimpleArbiter',
      parameters: [],
      inputs: [{ name: 'req', portType: busType(8) }],
      outputs: [{ name: 'grant', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'state_reg',
          label: 'StateReg',
          componentRef: 'Register',
          arguments: { initial: 0 },
          inputs: [
            { id: 'state_reg.data', name: 'data', portType: busType(8) },
            { id: 'state_reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'state_reg.q', name: 'q', portType: busType(8) }],
          clocks: [{ id: 'state_reg.clk', name: 'clk' }],
        },
        {
          id: 'we',
          label: 'WE',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'we.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'req' },
          target: { nodeId: 'state_reg', portName: 'data' },
          portType: busType(8),
        },
        {
          id: 'c2',
          source: { nodeId: 'we', portName: 'out' },
          target: { nodeId: 'state_reg', portName: 'we' },
          portType: busType(8),
        },
        {
          id: 'c3',
          source: { nodeId: 'state_reg', portName: 'q' },
          target: { nodeId: '', portName: 'grant' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const packetForwarder: Circuit = {
      id: 'fwd',
      name: 'PacketForwarder',
      parameters: [],
      inputs: [{ name: 'pkt_in', portType: busType(8) }],
      outputs: [{ name: 'pkt_out', portType: busType(8) }],
      clocks: [{ name: 'clk' }],
      state: [],
      nodes: [
        {
          id: 'fwd_reg',
          label: 'ForwardReg',
          componentRef: 'Register',
          arguments: { initial: 0 },
          inputs: [
            { id: 'fwd_reg.data', name: 'data', portType: busType(8) },
            { id: 'fwd_reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [{ id: 'fwd_reg.q', name: 'q', portType: busType(8) }],
          clocks: [{ id: 'fwd_reg.clk', name: 'clk' }],
        },
        {
          id: 'we',
          label: 'WE',
          componentRef: 'Constant',
          arguments: { value: 1 },
          inputs: [],
          outputs: [{ id: 'we.out', name: 'out', portType: busType(8) }],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'pkt_in' },
          target: { nodeId: 'fwd_reg', portName: 'data' },
          portType: busType(8),
        },
        {
          id: 'c2',
          source: { nodeId: 'we', portName: 'out' },
          target: { nodeId: 'fwd_reg', portName: 'we' },
          portType: busType(8),
        },
        {
          id: 'c3',
          source: { nodeId: 'fwd_reg', portName: 'q' },
          target: { nodeId: '', portName: 'pkt_out' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.addCircuit(ingressController);
    library.addCircuit(arbiter);
    library.addCircuit(packetForwarder);

    // Create the network with apparent cycle:
    // IngressController → Arbiter → PacketForwarder → IngressController
    const network: Circuit = {
      id: 'net',
      name: 'Network',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ingress0',
          label: 'Ingress',
          componentRef: 'IngressController',
          arguments: {},
          inputs: [{ id: 'ingress0.data_in', name: 'data_in', portType: busType(8) }],
          outputs: [{ id: 'ingress0.data_out', name: 'data_out', portType: busType(8) }],
          clocks: [{ id: 'ingress0.clk', name: 'clk' }],
        },
        {
          id: 'arbiter0',
          label: 'Arbiter',
          componentRef: 'SimpleArbiter',
          arguments: {},
          inputs: [{ id: 'arbiter0.req', name: 'req', portType: busType(8) }],
          outputs: [{ id: 'arbiter0.grant', name: 'grant', portType: busType(8) }],
          clocks: [{ id: 'arbiter0.clk', name: 'clk' }],
        },
        {
          id: 'fwd0',
          label: 'Forwarder',
          componentRef: 'PacketForwarder',
          arguments: {},
          inputs: [{ id: 'fwd0.pkt_in', name: 'pkt_in', portType: busType(8) }],
          outputs: [{ id: 'fwd0.pkt_out', name: 'pkt_out', portType: busType(8) }],
          clocks: [{ id: 'fwd0.clk', name: 'clk' }],
        },
      ],
      connections: [
        // Create the "cycle": ingress → arbiter → forwarder → ingress
        {
          id: 'c1',
          source: { nodeId: 'ingress0', portName: 'data_out' },
          target: { nodeId: 'arbiter0', portName: 'req' },
          portType: busType(8),
        },
        {
          id: 'c2',
          source: { nodeId: 'arbiter0', portName: 'grant' },
          target: { nodeId: 'fwd0', portName: 'pkt_in' },
          portType: busType(8),
        },
        {
          id: 'c3',
          source: { nodeId: 'fwd0', portName: 'pkt_out' },
          target: { nodeId: 'ingress0', portName: 'data_in' },
          portType: busType(8),
        },
      ],
      implementation: { kind: 'composite' },
    };

    // OLD BEHAVIOR: Would falsely detect cycle
    // NEW BEHAVIOR: Correctly recognizes registers break the path
    const sim = createSimulatorFromCircuit(network, getLibrary());
    const result = sim.runCombinational();

    expect(result.error).toBeUndefined();
  });
});
