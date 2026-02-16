/**
 * Simple Arbiter Tests (2-Port)
 *
 * Tests for the SimpleArbiter2Port component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

describe('SimpleArbiter2Port', () => {
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

  describe('Compilation', () => {
    it('should compile without errors', () => {
      const { circuit, errors } = loadDSLFile('SimpleArbiter2Port.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('SimpleArbiter2Port');
    });

    it('should have correct structure', () => {
      const { circuit } = loadDSLFile('SimpleArbiter2Port.dsl');

      // Should have last_port register
      const lastPortNode = circuit.nodes?.find(n => n.id.includes('last_port'));
      expect(lastPortNode).toBeDefined();
      expect(lastPortNode?.componentRef).toBe('Register');
    });
  });

  describe('Formal Port Structure', () => {
    it('should have formal input ports', () => {
      const { circuit } = loadDSLFile('SimpleArbiter2Port.dsl');

      const port0Ready = circuit.inputs?.find(p => p.name === 'port0_ready');
      expect(port0Ready).toBeDefined();
      expect(port0Ready?.portType.kind).toBe('bit');

      const port1Ready = circuit.inputs?.find(p => p.name === 'port1_ready');
      expect(port1Ready).toBeDefined();
      expect(port1Ready?.portType.kind).toBe('bit');

      const forwarderDone = circuit.inputs?.find(p => p.name === 'forwarder_done');
      expect(forwarderDone).toBeDefined();
      expect(forwarderDone?.portType.kind).toBe('bit');
    });

    it('should have formal output ports', () => {
      const { circuit } = loadDSLFile('SimpleArbiter2Port.dsl');

      const grantPort = circuit.outputs?.find(p => p.name === 'grant_port');
      expect(grantPort).toBeDefined();
      expect(grantPort?.portType.kind).toBe('bus');
      if (grantPort?.portType.kind === 'bus') {
        expect(grantPort.portType.width).toBe(8);
      }

      const grantValid = circuit.outputs?.find(p => p.name === 'grant_valid');
      expect(grantValid).toBeDefined();
      expect(grantValid?.portType.kind).toBe('bit');
    });

    it('should have clock declaration', () => {
      const { circuit } = loadDSLFile('SimpleArbiter2Port.dsl');

      const clk = circuit.clocks?.find(c => c.name === 'clk');
      expect(clk).toBeDefined();
    });
  });

  // TODO: Add functional tests
  // - Test port 0 selection
  // - Test port 1 selection
  // - Test fairness (alternation)
  // - Test fallback when one port not ready
});
