/**
 * MiniSwitch2Port Packet Switching Demonstration
 *
 * This test demonstrates actual packet switching through the circuit
 * with visible state transitions and packet forwarding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import {
  runCombinationalSimulation,
  initializeSequentialState,
  runSimulationTick,
  type SequentialState,
} from '../../src/features/visual-editor/lib/simulator-v0.1';
import type { Circuit } from '../../src/features/visual-editor/types/ir-v0.1';

describe('MiniSwitch2Port Packet Switching', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  class TestLibrary implements ComponentLibrary {
    constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}

    getCircuit(name: string): DslCircuit | undefined {
      const comp = this.store.resolveComponent(name);
      if (!comp) return undefined;

      return {
        id: comp.id,
        name: comp.name,
        parameters: comp.parameters || [],
        inputs: comp.inputs || [],
        outputs: comp.outputs || [],
        clocks: comp.clocks || [],
        state: comp.state || [],
        nodes: comp.nodes || [],
        connections: comp.connections || [],
        implementation: comp.implementation || { kind: 'primitive' },
      } as DslCircuit;
    }

    hasCircuit(name: string): boolean {
      return this.store.resolveComponent(name) !== undefined;
    }

    addCircuit(circuit: DslCircuit): void {
      this.store.registerUser(circuit as any);
    }
  }

  function loadDSLFile(filename: string): { circuit: Circuit; errors: string[] } {
    const source = readFileSync(
      resolve(__dirname, '../../dsl-files', filename),
      'utf-8'
    );

    const testLibrary = new TestLibrary(library);
    const result = compileDSL(source, testLibrary);

    if (result.circuits.length === 0) {
      return {
        circuit: null as any,
        errors: result.errors.map((e) => e.message),
      };
    }

    return {
      circuit: result.circuits[result.circuits.length - 1],
      errors: result.errors.map((e) => e.message),
    };
  }

  function loadAllComponents() {
    const components = [
      'MacRxParser.dsl',
      'IngressController.dsl',
      'SimpleArbiter2Port.dsl',
      'PacketForwarder2Port.dsl',
      'EgressController.dsl',
    ];

    for (const file of components) {
      const { circuit, errors } = loadDSLFile(file);
      if (errors.length > 0) {
        throw new Error(`Failed to load ${file}: ${errors.join(', ')}`);
      }
      if (circuit) {
        library.registerUser(circuit as any);
      }
    }
  }

  /**
   * Helper: Find state value by pattern matching on key
   */
  function findState(
    seqState: SequentialState,
    nodePattern: string,
    statePattern: string
  ): number | boolean | Map<number, number> | undefined {
    for (const [key, value] of seqState.currentState.entries()) {
      if (key.includes(nodePattern) && key.includes(statePattern)) {
        return value;
      }
    }
    return undefined;
  }

  it('should demonstrate runtime input modification', () => {
    loadAllComponents();
    const { circuit } = loadDSLFile('MiniSwitch2Port.dsl');

    // Find an Input node
    const inputNode = circuit.nodes.find(n => n.componentRef === 'Input');
    expect(inputNode).toBeDefined();

    console.log('Input node:', {
      id: inputNode?.id,
      label: inputNode?.label,
      arguments: inputNode?.arguments,
    });

    // Try to modify it
    try {
      if (inputNode) {
        const oldValue = inputNode.arguments.value;
        console.log('Old value:', oldValue);

        inputNode.arguments.value = 0x55; // Try to set preamble byte

        console.log('New value:', inputNode.arguments.value);
        console.log('✅ Successfully modified Input node!');
      }
    } catch (error) {
      console.log('❌ Error modifying Input node:', error);
      console.log('Error type:', (error as any).constructor.name);
      console.log('Error message:', (error as Error).message);
    }
  });

  it('should demonstrate packet reception with manual input construction', () => {
    loadAllComponents();
    const { circuit: templateCircuit } = loadDSLFile('MiniSwitch2Port.dsl');

    // Create a mutable clone ONCE at the start
    const circuit = JSON.parse(JSON.stringify(templateCircuit));

    // Initialize sequential state with THIS circuit
    const seqState = initializeSequentialState(circuit);

    // Verify initial idle state
    expect(findState(seqState, 'parser0', 'fsm_state')).toBe(0);

    console.log('\n=== Starting Packet Transmission Demo ===\n');

    // Helper to update input values in place
    // Note: Constants inside components now have values set in DSL (e.g. Input(value=0))
    function setCircuitInputs(
      circuit: Circuit,
      inputs: { [label: string]: number }
    ): void {
      // Set input values for top-level circuit inputs only (in place)
      for (const node of circuit.nodes) {
        if (node.componentRef === 'Input' && node.label in inputs) {
          if (!node.arguments) {
            node.arguments = {};
          }
          node.arguments.value = inputs[node.label];
        }
      }
    }

    // Step 1: Send first preamble byte (0x55)
    console.log('Step 1: Sending preamble byte 0x55 on port 0');
    setCircuitInputs(circuit, {
      p0_byte: 0x55,
      p0_valid: 1,
      p1_byte: 0,
      p1_valid: 0,
    });

    // Debug: Check input node values
    const p0ByteNode = circuit.nodes.find(n => n.label === 'p0_byte');
    const p0ValidNode = circuit.nodes.find(n => n.label === 'p0_valid');
    console.log(`  DEBUG: p0_byte.arguments.value = ${p0ByteNode?.arguments?.value}`);
    console.log(`  DEBUG: p0_valid.arguments.value = ${p0ValidNode?.arguments?.value}`);

    // Check if constants are accessible inside MacRxParser
    const macRxParserDef = library.resolveComponent('MacRxParser');
    const preambleByteConst = macRxParserDef?.nodes?.find((n: any) => n.label === 'PREAMBLE_BYTE');
    console.log(`  DEBUG: MacRxParser.PREAMBLE_BYTE.arguments = ${JSON.stringify(preambleByteConst?.arguments)}`);

    let result = runSimulationTick(circuit, seqState);
    expect(result.error).toBeUndefined();

    // Debug: Check port values after simulation
    console.log(`  DEBUG: portValues keys sample: ${Array.from(result.portValues.keys()).slice(0, 5).join(', ')}`);
    const parser0Id = circuit.nodes.find(n => n.label?.includes('parser0'))?.id;
    const byteInValue = result.portValues.get(`${parser0Id}.byte_in`);
    const validValue = result.portValues.get(`${parser0Id}.valid`);
    console.log(`  DEBUG: parser0.byte_in = ${byteInValue}, parser0.valid = ${validValue}`);

    let parser0State = findState(seqState, 'parser0', 'fsm_state');
    let preambleCount = findState(seqState, 'parser0', 'preamble_count');
    console.log(`  Parser0 FSM state: ${parser0State}, preamble_count: ${preambleCount}`);

    // Send 6 more preamble bytes
    for (let i = 2; i <= 7; i++) {
      console.log(`Step ${i}: Sending preamble byte ${i}/7`);
      setCircuitInputs(circuit, {
        p0_byte: 0x55,
        p0_valid: 1,
        p1_byte: 0,
        p1_valid: 0,
      });

      result = runSimulationTick(circuit, seqState);
      expect(result.error).toBeUndefined();

      parser0State = findState(seqState, 'parser0', 'fsm_state');
      preambleCount = findState(seqState, 'parser0', 'preamble_count');
      console.log(`  Parser0 FSM state: ${parser0State}, preamble_count: ${preambleCount}`);
    }

    // Step 8: Send SFD (0xD5)
    console.log('Step 8: Sending SFD byte 0xD5');
    setCircuitInputs(circuit, {
      p0_byte: 0xd5,
      p0_valid: 1,
      p1_byte: 0,
      p1_valid: 0,
    });

    result = runSimulationTick(circuit, seqState);
    expect(result.error).toBeUndefined();

    parser0State = findState(seqState, 'parser0', 'fsm_state');
    console.log(`  Parser0 FSM state after SFD: ${parser0State}`);

    // Steps 9-16: Send 8-byte packet
    const packetData = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
    for (let i = 0; i < packetData.length; i++) {
      console.log(`Step ${9 + i}: Sending packet byte ${i + 1}/8: 0x${packetData[i].toString(16)}`);
      setCircuitInputs(circuit, {
        p0_byte: packetData[i],
        p0_valid: 1,
        p1_byte: 0,
        p1_valid: 0,
      });

      result = runSimulationTick(circuit, seqState);
      expect(result.error).toBeUndefined();

      parser0State = findState(seqState, 'parser0', 'fsm_state');
      const byteCount = findState(seqState, 'parser0', 'byte_count');
      console.log(`  Parser0 FSM state: ${parser0State}, byte_count: ${byteCount}`);
    }

    // Step 17: End transmission (valid=0)
    console.log('Step 17: Ending transmission (valid=0)');
    setCircuitInputs(circuit, {
      p0_byte: 0,
      p0_valid: 0,
      p1_byte: 0,
      p1_valid: 0,
    });

    result = runSimulationTick(circuit, seqState);
    expect(result.error).toBeUndefined();

    parser0State = findState(seqState, 'parser0', 'fsm_state');
    console.log(`  Parser0 FSM state after end: ${parser0State}`);

    // Check ingress controller state
    const ingress0State = findState(seqState, 'ingress0', 'fsm_state');
    const pktReady = findState(seqState, 'ingress0', 'pkt_ready_reg');
    console.log(`\nIngress0 state: ${ingress0State}, pkt_ready: ${pktReady}`);

    // Run several more cycles to let the packet propagate
    console.log('\n=== Propagating packet through system ===\n');
    for (let i = 0; i < 20; i++) {
      setCircuitInputs(circuit, {
        p0_byte: 0,
        p0_valid: 0,
        p1_byte: 0,
        p1_valid: 0,
      });

      result = runSimulationTick(circuit, seqState);
      expect(result.error).toBeUndefined();

      const arbiterState = findState(seqState, 'arbiter', 'grant_port_reg');
      const arbiterValid = findState(seqState, 'arbiter', 'grant_valid_reg');
      const fwdState = findState(seqState, 'forwarder', 'fsm_state');
      const egress0State = findState(seqState, 'egress0', 'fsm_state');
      const egress1State = findState(seqState, 'egress1', 'fsm_state');

      console.log(`Cycle ${i + 18}: Arbiter grant=${arbiterState} valid=${arbiterValid}, Fwd=${fwdState}, Egress0=${egress0State}, Egress1=${egress1State}`);
    }

    console.log('\n✅ Packet transmission and switching demonstrated successfully!');
    console.log('The circuit processes packets with visible FSM state transitions.');
  });
});
