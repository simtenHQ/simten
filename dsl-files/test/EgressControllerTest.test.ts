/**
 * Egress Controller Tests
 *
 * Tests for the EgressController component that serializes packet output.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

describe('EgressController', () => {
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
      const { circuit, errors } = loadDSLFile('EgressController.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('EgressController');
    });

    it('should have correct structure', () => {
      const { circuit } = loadDSLFile('EgressController.dsl');

      // Should have FSM state register
      const stateNode = circuit.nodes?.find(n => n.id.includes('fsm_state'));
      expect(stateNode).toBeDefined();
      expect(stateNode?.componentRef).toBe('Register');

      // Should have byte counter
      const byteCounterNode = circuit.nodes?.find(n => n.id.includes('byte_counter'));
      expect(byteCounterNode).toBeDefined();
      expect(byteCounterNode?.componentRef).toBe('Register');

      // Should have read pointer
      const readPtrNode = circuit.nodes?.find(n => n.id.includes('read_ptr'));
      expect(readPtrNode).toBeDefined();
      expect(readPtrNode?.componentRef).toBe('Register');
    });
  });

  describe('Formal Port Structure', () => {
    it('should have formal input ports', () => {
      const { circuit } = loadDSLFile('EgressController.dsl');

      const pktReady = circuit.inputs?.find(p => p.name === 'pkt_ready');
      expect(pktReady).toBeDefined();
      expect(pktReady?.portType.kind).toBe('bit');

      const trigger = circuit.inputs?.find(p => p.name === 'trigger');
      expect(trigger).toBeDefined();
      expect(trigger?.portType.kind).toBe('bit');
    });

    it('should have formal output ports', () => {
      const { circuit } = loadDSLFile('EgressController.dsl');

      const egressAddr = circuit.outputs?.find(p => p.name === 'egress_addr');
      expect(egressAddr).toBeDefined();
      expect(egressAddr?.portType.kind).toBe('bus');
      if (egressAddr?.portType.kind === 'bus') {
        expect(egressAddr.portType.width).toBe(8);
      }

      const egressRe = circuit.outputs?.find(p => p.name === 'egress_re');
      expect(egressRe).toBeDefined();
      expect(egressRe?.portType.kind).toBe('bit');

      const dataValid = circuit.outputs?.find(p => p.name === 'data_valid');
      expect(dataValid).toBeDefined();
      expect(dataValid?.portType.kind).toBe('bit');

      const sof = circuit.outputs?.find(p => p.name === 'sof');
      expect(sof).toBeDefined();
      expect(sof?.portType.kind).toBe('bit');

      const eof = circuit.outputs?.find(p => p.name === 'eof');
      expect(eof).toBeDefined();
      expect(eof?.portType.kind).toBe('bit');

      const ready = circuit.outputs?.find(p => p.name === 'ready');
      expect(ready).toBeDefined();
      expect(ready?.portType.kind).toBe('bit');
    });

    it('should have clock declaration', () => {
      const { circuit } = loadDSLFile('EgressController.dsl');

      const clk = circuit.clocks?.find(c => c.name === 'clk');
      expect(clk).toBeDefined();
    });
  });

  // TODO: Add functional tests
  // - Test packet serialization
  // - Test sof/eof generation
  // - Test data_valid timing
  // - Test read pointer advancement
});
