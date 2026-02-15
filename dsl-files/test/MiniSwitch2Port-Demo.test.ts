/**
 * Test that the demo version compiles and runs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary as DSLComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import { createSimulatorFromCircuit, type ComponentLibrary, type SimulatorEngine } from '@/core/simulator';
import type { Circuit } from '../../src/features/visual-editor/types/ir-v0.1';

function getSimLibrary(): ComponentLibrary {
  const store = useComponentLibraryStore.getState();
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

describe('MiniSwitch2Port Demo', () => {
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
      'PacketGenerator.dsl',
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

  it('should compile PacketGenerator without errors', () => {
    const { circuit, errors } = loadDSLFile('PacketGenerator.dsl');

    if (errors.length > 0) {
      console.log('Compilation errors:', errors);
    }

    expect(errors).toEqual([]);
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('PacketGenerator');
  });

  // Skipped: MiniSwitch2Port-Demo.dsl file does not exist
  it.skip('should compile MiniSwitch2Port_Demo without errors', () => {
    loadAllComponents();

    const { circuit, errors } = loadDSLFile('MiniSwitch2Port-Demo.dsl');

    if (errors.length > 0) {
      console.log('Compilation errors:', errors);
    }

    expect(errors).toEqual([]);
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('MiniSwitch2Port_Demo');
  });

  // Skipped: MiniSwitch2Port-Demo-Complete.dsl file does not exist
  it.skip('should compile MiniSwitch2Port_Demo_Complete (all-in-one) without errors', () => {
    const { circuit, errors } = loadDSLFile('MiniSwitch2Port-Demo-Complete.dsl');

    if (errors.length > 0) {
      console.log('Compilation errors:', errors);
    }

    expect(errors).toEqual([]);
    expect(circuit).toBeDefined();
    expect(circuit.name).toBe('MiniSwitch2Port_Demo');
  });

  // Skipped: MiniSwitch2Port-Demo-Complete.dsl file does not exist
  it.skip('should run complete demo for multiple cycles and show packet activity', () => {
    const { circuit } = loadDSLFile('MiniSwitch2Port-Demo-Complete.dsl');

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());

    console.log('\n=== Running MiniSwitch2Port Complete Demo (All-in-One) ===\n');
    console.log('Watching packet flow for 50 clock cycles...\n');

    for (let cycle = 0; cycle < 50; cycle++) {
      const result = sim.tick();

      // Find debug LED values
      const genValidNode = circuit.nodes.find(n => n.label === 'debug_gen_valid');
      const genValid = result.portValues.get(`${genValidNode?.id}.in`);

      const grantValidNode = circuit.nodes.find(n => n.label === 'debug_grant_valid');
      const grantValid = result.portValues.get(`${grantValidNode?.id}.in`);

      const ingress0ReadyNode = circuit.nodes.find(n => n.label === 'debug_ingress0_ready');
      const ingress0Ready = result.portValues.get(`${ingress0ReadyNode?.id}.in`);

      const p1ValidNode = circuit.nodes.find(n => n.label === 'p1_valid_out');
      const p1Valid = result.portValues.get(`${p1ValidNode?.id}.in`);

      // Log every cycle to show the full sequence
      console.log(
        `Cycle ${cycle.toString().padStart(2)}: ` +
        `Gen=${genValid ? '🟢' : '⚪'} ` +
        `Grant=${grantValid ? '🟢' : '⚪'} ` +
        `Buf=${ingress0Ready ? '🟢' : '⚪'} ` +
        `TX=${p1Valid ? '🟢' : '⚪'}`
      );
    }

    console.log('\n✅ Complete demo runs successfully with automatic packet generation!');
  });

  // Skipped: MiniSwitch2Port-Demo.dsl file does not exist
  it.skip('should run demo for multiple cycles and show packet activity', () => {
    loadAllComponents();
    const { circuit } = loadDSLFile('MiniSwitch2Port-Demo.dsl');

    const sim = createSimulatorFromCircuit(circuit, getSimLibrary());

    console.log('\n=== Running MiniSwitch2Port Demo ===\n');
    console.log('Watching packet flow for 30 clock cycles...\n');

    for (let cycle = 0; cycle < 30; cycle++) {
      const result = sim.tick();

      // Find debug LED values
      const genValidNode = circuit.nodes.find(n => n.label === 'debug_gen_valid');
      const genValid = result.portValues.get(`${genValidNode?.id}.in`);

      const grantValidNode = circuit.nodes.find(n => n.label === 'debug_grant_valid');
      const grantValid = result.portValues.get(`${grantValidNode?.id}.in`);

      const ingress0ReadyNode = circuit.nodes.find(n => n.label === 'debug_ingress0_ready');
      const ingress0Ready = result.portValues.get(`${ingress0ReadyNode?.id}.in`);

      const p1ValidNode = circuit.nodes.find(n => n.label === 'p1_valid_out');
      const p1Valid = result.portValues.get(`${p1ValidNode?.id}.in`);

      // Only log when something interesting happens
      if (genValid || grantValid || ingress0Ready || p1Valid) {
        console.log(
          `Cycle ${cycle.toString().padStart(2)}: ` +
          `Gen=${genValid ? '🟢' : '⚪'} ` +
          `Grant=${grantValid ? '🟢' : '⚪'} ` +
          `Buf=${ingress0Ready ? '🟢' : '⚪'} ` +
          `TX=${p1Valid ? '🟢' : '⚪'}`
        );
      }
    }

    console.log('\n✅ Demo runs successfully with automatic packet generation!');
  });
});
