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
import { ComponentLibrary as DSLComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import {
  createSimulatorFromCircuit,
  type ComponentLibrary,
  type FlatSequentialState,
} from '@/core/simulator';
import type { Circuit } from '../../src/features/visual-editor/types/ir-v0.1';

function getSimLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('MiniSwitch2Port Packet Switching', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  class TestLibrary implements DSLComponentLibrary {
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
    seqState: FlatSequentialState | null,
    nodePattern: string,
    statePattern: string
  ): number | boolean | Map<number, number> | string | undefined {
    if (!seqState) return undefined;
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

  // Skipped: This test requires modifying Input node values between ticks,
  // which the new fast simulator doesn't support (circuit is compiled once at creation).
  // To re-enable this test, the simulator would need a setInput() method or similar.
  it.skip('should demonstrate packet reception with manual input construction', () => {
    loadAllComponents();
    const { circuit } = loadDSLFile('MiniSwitch2Port.dsl');

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());
    const seqState = sim.getState();

    // Verify initial idle state
    expect(findState(seqState, 'parser0', 'fsm_state')).toBe(0);

    console.log('\n=== Starting Packet Transmission Demo ===\n');
    console.log('Note: This test requires dynamic input modification which is not supported');
    console.log('by the current fast simulator architecture.');
  });
});
