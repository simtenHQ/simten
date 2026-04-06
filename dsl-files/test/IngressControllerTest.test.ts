/**
 * Ingress Controller Tests
 *
 * Tests for the IngressController component that buffers incoming packets.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { CircuitLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useCircuitLibraryStore } from '../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

describe('IngressController', () => {
  let library: ReturnType<typeof useCircuitLibraryStore.getState>;

  beforeEach(() => {
    library = useCircuitLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  class TestLibrary implements CircuitLibrary {
    constructor(private store: ReturnType<typeof useCircuitLibraryStore.getState>) {}

    getCircuit(name: string): DslCircuit | undefined {
      const comp = this.store.resolveCircuit(name);
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
      return this.store.resolveCircuit(name) !== undefined;
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
      const { circuit, errors } = loadDSLFile('IngressController.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('IngressController');
    });

    it('should have correct structure', () => {
      const { circuit } = loadDSLFile('IngressController.dsl');

      // Should have FSM state register
      const stateNode = circuit.nodes?.find(n => n.id.includes('fsm_state'));
      expect(stateNode).toBeDefined();
      expect(stateNode?.componentRef).toBe('Register');

      // Should have counters
      const byteCountNode = circuit.nodes?.find(n => n.id.includes('byte_count'));
      expect(byteCountNode).toBeDefined();
      expect(byteCountNode?.componentRef).toBe('Register');

      const pktCountNode = circuit.nodes?.find(n => n.id.includes('pkt_count'));
      expect(pktCountNode).toBeDefined();
      expect(pktCountNode?.componentRef).toBe('Register');

      const writePtrNode = circuit.nodes?.find(n => n.id.includes('write_ptr'));
      expect(writePtrNode).toBeDefined();
      expect(writePtrNode?.componentRef).toBe('Register');
    });
  });

  describe('Formal Port Structure', () => {
    it('should have formal input ports', () => {
      const { circuit } = loadDSLFile('IngressController.dsl');

      const dataIn = circuit.inputs?.find(p => p.name === 'data_in');
      expect(dataIn).toBeDefined();
      expect(dataIn?.portType.kind).toBe('bus');
      if (dataIn?.portType.kind === 'bus') {
        expect(dataIn.portType.width).toBe(8);
      }

      const sof = circuit.inputs?.find(p => p.name === 'sof');
      expect(sof).toBeDefined();
      expect(sof?.portType.kind).toBe('bit');

      const eof = circuit.inputs?.find(p => p.name === 'eof');
      expect(eof).toBeDefined();
      expect(eof?.portType.kind).toBe('bit');

      const dataValid = circuit.inputs?.find(p => p.name === 'data_valid');
      expect(dataValid).toBeDefined();
      expect(dataValid?.portType.kind).toBe('bit');

      const grant = circuit.inputs?.find(p => p.name === 'grant');
      expect(grant).toBeDefined();
      expect(grant?.portType.kind).toBe('bit');
    });

    it('should have formal output ports', () => {
      const { circuit } = loadDSLFile('IngressController.dsl');

      const bufAddr = circuit.outputs?.find(p => p.name === 'buf_addr');
      expect(bufAddr).toBeDefined();
      expect(bufAddr?.portType.kind).toBe('bus');
      if (bufAddr?.portType.kind === 'bus') {
        expect(bufAddr.portType.width).toBe(8);
      }

      const bufData = circuit.outputs?.find(p => p.name === 'buf_data');
      expect(bufData).toBeDefined();
      expect(bufData?.portType.kind).toBe('bus');
      if (bufData?.portType.kind === 'bus') {
        expect(bufData.portType.width).toBe(8);
      }

      const bufWe = circuit.outputs?.find(p => p.name === 'buf_we');
      expect(bufWe).toBeDefined();
      expect(bufWe?.portType.kind).toBe('bit');

      const pktReady = circuit.outputs?.find(p => p.name === 'pkt_ready');
      expect(pktReady).toBeDefined();
      expect(pktReady?.portType.kind).toBe('bit');

      const bufFull = circuit.outputs?.find(p => p.name === 'buf_full');
      expect(bufFull).toBeDefined();
      expect(bufFull?.portType.kind).toBe('bit');

      const writePtr = circuit.outputs?.find(p => p.name === 'write_ptr');
      expect(writePtr).toBeDefined();
      expect(writePtr?.portType.kind).toBe('bus');
      if (writePtr?.portType.kind === 'bus') {
        expect(writePtr.portType.width).toBe(8);
      }
    });

    it('should have clock declaration', () => {
      const { circuit } = loadDSLFile('IngressController.dsl');

      const clk = circuit.clocks?.find(c => c.name === 'clk');
      expect(clk).toBeDefined();
    });
  });

  // TODO: Add functional tests
  // - Test packet reception
  // - Test buffer full backpressure
  // - Test packet release on grant
});
