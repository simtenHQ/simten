/**
 * Packet Forwarder Tests (2-Port)
 *
 * Tests for the PacketForwarder2Port component with static routing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { CircuitLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useCircuitLibraryStore } from '../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

describe('PacketForwarder2Port', () => {
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
      const { circuit, errors } = loadDSLFile('PacketForwarder2Port.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('PacketForwarder2Port');
    });

    it('should have correct structure', () => {
      const { circuit } = loadDSLFile('PacketForwarder2Port.dsl');

      // Should have FSM state register
      const stateNode = circuit.nodes?.find(n => n.id.includes('fsm_state'));
      expect(stateNode).toBeDefined();
      expect(stateNode?.componentRef).toBe('Register');

      // Should have byte counter
      const byteCounterNode = circuit.nodes?.find(n => n.id.includes('byte_counter'));
      expect(byteCounterNode).toBeDefined();
      expect(byteCounterNode?.componentRef).toBe('Register');

      // Should have port registers
      const outputPortNode = circuit.nodes?.find(n => n.id.includes('output_port'));
      expect(outputPortNode).toBeDefined();
      expect(outputPortNode?.componentRef).toBe('Register');

      const ingressPortNode = circuit.nodes?.find(n => n.id.includes('ingress_port'));
      expect(ingressPortNode).toBeDefined();
      expect(ingressPortNode?.componentRef).toBe('Register');
    });
  });

  describe('Formal Port Structure', () => {
    it('should have formal input ports', () => {
      const { circuit } = loadDSLFile('PacketForwarder2Port.dsl');

      const grantPort = circuit.inputs?.find(p => p.name === 'grant_port');
      expect(grantPort).toBeDefined();
      expect(grantPort?.portType.kind).toBe('bus');
      if (grantPort?.portType.kind === 'bus') {
        expect(grantPort.portType.width).toBe(8);
      }

      const grantValid = circuit.inputs?.find(p => p.name === 'grant_valid');
      expect(grantValid).toBeDefined();
      expect(grantValid?.portType.kind).toBe('bit');

      const port0ReadPtr = circuit.inputs?.find(p => p.name === 'port0_read_ptr');
      expect(port0ReadPtr).toBeDefined();
      expect(port0ReadPtr?.portType.kind).toBe('bus');
      if (port0ReadPtr?.portType.kind === 'bus') {
        expect(port0ReadPtr.portType.width).toBe(8);
      }

      const port1ReadPtr = circuit.inputs?.find(p => p.name === 'port1_read_ptr');
      expect(port1ReadPtr).toBeDefined();
      expect(port1ReadPtr?.portType.kind).toBe('bus');
      if (port1ReadPtr?.portType.kind === 'bus') {
        expect(port1ReadPtr.portType.width).toBe(8);
      }
    });

    it('should have formal output ports', () => {
      const { circuit } = loadDSLFile('PacketForwarder2Port.dsl');

      const ingressAddr = circuit.outputs?.find(p => p.name === 'ingress_addr');
      expect(ingressAddr).toBeDefined();
      expect(ingressAddr?.portType.kind).toBe('bus');
      if (ingressAddr?.portType.kind === 'bus') {
        expect(ingressAddr.portType.width).toBe(8);
      }

      const ingressRe = circuit.outputs?.find(p => p.name === 'ingress_re');
      expect(ingressRe).toBeDefined();
      expect(ingressRe?.portType.kind).toBe('bit');

      const egressAddr = circuit.outputs?.find(p => p.name === 'egress_addr');
      expect(egressAddr).toBeDefined();
      expect(egressAddr?.portType.kind).toBe('bus');
      if (egressAddr?.portType.kind === 'bus') {
        expect(egressAddr.portType.width).toBe(8);
      }

      const egressWe = circuit.outputs?.find(p => p.name === 'egress_we');
      expect(egressWe).toBeDefined();
      expect(egressWe?.portType.kind).toBe('bit');

      const done = circuit.outputs?.find(p => p.name === 'done');
      expect(done).toBeDefined();
      expect(done?.portType.kind).toBe('bit');

      const outputPort = circuit.outputs?.find(p => p.name === 'output_port');
      expect(outputPort).toBeDefined();
      expect(outputPort?.portType.kind).toBe('bus');
      if (outputPort?.portType.kind === 'bus') {
        expect(outputPort.portType.width).toBe(8);
      }

      const ingressPort = circuit.outputs?.find(p => p.name === 'ingress_port');
      expect(ingressPort).toBeDefined();
      expect(ingressPort?.portType.kind).toBe('bus');
      if (ingressPort?.portType.kind === 'bus') {
        expect(ingressPort.portType.width).toBe(8);
      }
    });

    it('should have clock declaration', () => {
      const { circuit } = loadDSLFile('PacketForwarder2Port.dsl');

      const clk = circuit.clocks?.find(c => c.name === 'clk');
      expect(clk).toBeDefined();
    });
  });

  // TODO: Add functional tests
  // - Test packet read from ingress
  // - Test routing decision (cross-over)
  // - Test packet write to egress
  // - Test FSM state progression
});
