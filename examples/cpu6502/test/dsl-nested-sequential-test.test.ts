/**
 * Test DSL-compiled nested Constant with SEQUENTIAL simulation
 * This closely matches the CPU structure
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileDSL, CircuitLibrary as DSLCircuitLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/dsl/types';
import { createSimulatorFromCircuit, type CircuitLibrary } from '@/core/simulator';

class CircuitLibraryAdapter implements DSLCircuitLibrary {
  constructor(private store: ReturnType<typeof useCircuitLibraryStore.getState>) {}

  getCircuit(name: string): Circuit | undefined {
    return this.store.resolveCircuit(name);
  }

  hasCircuit(name: string): boolean {
    return this.store.resolveCircuit(name) !== undefined;
  }

  addCircuit(circuit: Circuit): void {
    this.store.registerUser(circuit);
  }
}

function getSimLibrary(): CircuitLibrary {
  const store = useCircuitLibraryStore.getState();
  return {
    resolveCircuit: (name) => store.resolveCircuit(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('DSL Nested Sequential Constant Test', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: DSLCircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
  });

  it('should evaluate nested Constant with sequential simulation', () => {
    const dslSource = `
circuit ConstantHolder {
  output value: Bus[8]

  impl {
    node c: Constant(value=169)
    connect c.out -> value
  }
}

circuit NestedSequentialTest {
  output out: Bus[8]
  clock clk

  impl {
    node holder: ConstantHolder
    node reg: Register(width=8)
    node one: Constant(value=1)

    connect holder.value -> reg.data
    connect one.out -> reg.we
    connect clk -> reg.clk
    connect reg.q -> out
  }
}
`;

    const result = compileDSL(dslSource, library);
    console.log('\n=== Compilation Result ===');
    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(err => console.log(`  ${err}`));
    }
    expect(result.errors).toHaveLength(0);

    for (const circuit of result.circuits) {
      library.addCircuit(circuit);
    }

    const testCircuit = result.circuits.find(c => c.name === 'NestedSequentialTest');
    expect(testCircuit).toBeDefined();

    if (!testCircuit) return;

    console.log('\n=== Circuit Structure ===');
    console.log(`Circuit: ${testCircuit.name}`);
    console.log(`Nodes: ${testCircuit.nodes.length}`);
    testCircuit.nodes.forEach(node => {
      console.log(`  - ${node.id}: ${node.componentRef}`);
    });

    // Check connections
    console.log(`\nConnections: ${testCircuit.connections.length}`);
    testCircuit.connections.forEach((conn, idx) => {
      console.log(`  ${idx}: ${conn.source.nodeId === '' ? '(circuit)' : conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId === '' ? '(circuit)' : conn.target.nodeId}.${conn.target.portName}`);
    });

    // Check the ConstantHolder circuit
    const holderCircuit = result.circuits.find(c => c.name === 'ConstantHolder');
    if (holderCircuit) {
      console.log(`\nConstantHolder circuit:`);
      console.log(`  Nodes: ${holderCircuit.nodes.length}`);
      holderCircuit.nodes.forEach(node => {
        console.log(`    - ${node.id}: ${node.componentRef}`);
        if (node.componentRef === 'Constant') {
          console.log(`      arguments: ${JSON.stringify(node.arguments)}`);
        }
      });
    }

    // Create simulator and run
    const sim = createSimulatorFromCircuit(testCircuit, getSimLibrary());

    // First, try pure combinational simulation to compare
    console.log('\n=== Trying Combinational Simulation First ===');
    const comboResult = sim.runCombinational();
    console.log('Combinational holder.value:', comboResult.portValues.get(`${testCircuit.nodes[0].id}.value`));
    console.log('Combinational reg.data:', comboResult.portValues.get(`${testCircuit.nodes[1].id}.data`));

    // Run one tick
    console.log('\n=== Running Tick 1 ===');
    const tick1 = sim.tick();

    console.log(`\n=== Tick 1 Results ===`);
    // Log all port values to see what's happening
    const allPorts = Array.from(tick1.portValues.keys()).sort();
    console.log(`Total ports: ${allPorts.length}`);
    console.log(`\nAll port values:`);
    allPorts.forEach(key => {
      const value = tick1.portValues.get(key);
      console.log(`  ${key} = ${value}`);
    });

    // Look for holder and constant values
    const holderPorts = allPorts.filter(p => p.includes('holder'));
    console.log(`\nHolder ports:`);
    holderPorts.forEach(p => {
      console.log(`  ${p} = ${tick1.portValues.get(p)}`);
    });

    const constPorts = allPorts.filter(p => p.includes('_c_'));
    console.log(`\nConstant ports:`);
    constPorts.forEach(p => {
      console.log(`  ${p} = ${tick1.portValues.get(p)}`);
    });

    console.log(`\nCircuit output (.out): ${tick1.portValues.get('.out')}`);

    // Check Register input
    const regNode = testCircuit.nodes.find(n => n.componentRef === 'Register');
    if (regNode) {
      const regDataPort = `${regNode.id}.data`;
      const regQPort = `${regNode.id}.q`;
      console.log(`\nRegister ports:`);
      console.log(`  ${regDataPort} = ${tick1.portValues.get(regDataPort)}`);
      console.log(`  ${regQPort} = ${tick1.portValues.get(regQPort)}`);
    }

    // Run second tick (register should latch)
    const tick2 = sim.tick();

    console.log(`\n=== Tick 2 Results ===`);
    console.log(`Circuit output (.out): ${tick2.portValues.get('.out')}`);

    // Get holder node ID
    const holderNode = testCircuit.nodes.find(n => n.componentRef === 'ConstantHolder');
    if (holderNode) {
      const holderValue = tick1.portValues.get(`${holderNode.id}.value`);
      console.log(`\nDirect holder output: ${holderValue}`);
      expect(holderValue).toBe(169);
    }

    expect(tick2.portValues.get('.out')).toBe(169);
  });
});
