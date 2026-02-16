/**
 * MAC RX Parser Tests
 *
 * Tests for the MacRxParser component that detects frame boundaries
 * from raw byte streams by detecting Ethernet preamble and SFD.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL } from '../../src/features/dsl/index';
import { ComponentLibrary, Circuit as DslCircuit } from '../../src/features/dsl/types';
import { useComponentLibraryStore } from '../../src/features/visual-editor/stores/component-library-store';
import { getPrimitives } from '../../src/features/visual-editor/lib/primitives';
import type { Circuit } from '../../src/features/visual-editor/types/circuit';

describe('MacRxParser', () => {
  let library: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    library = useComponentLibraryStore.getState();
    library.clearAll();
    library.registerPrimitives(getPrimitives());
  });

  // Component library adapter
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
    it('should compile existing snake.dsl (sanity check)', () => {
      const { circuit, errors } = loadDSLFile('snake.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
    });

    // Skipped: MacRxParserMinimal.dsl file does not exist
    it.skip('should compile minimal version without errors', () => {
      const { circuit, errors } = loadDSLFile('MacRxParserMinimal.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('MacRxParserMinimal');
    });

    it('should compile full version without errors', () => {
      const { circuit, errors } = loadDSLFile('MacRxParser.dsl');

      if (errors.length > 0) {
        console.log('Compilation errors:', errors);
      }

      expect(errors).toEqual([]);
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('MacRxParser');
    });

    it('should have correct structure', () => {
      const { circuit } = loadDSLFile('MacRxParser.dsl');

      // Node IDs are prefixed with circuit name, so we search by substring
      // Should have state registers (renamed from 'state' to 'fsm_state' due to reserved keyword)
      const stateNode = circuit.nodes?.find(n => n.id.includes('fsm_state'));
      expect(stateNode).toBeDefined();
      expect(stateNode?.componentRef).toBe('Register');

      const preambleCountNode = circuit.nodes?.find(n => n.id.includes('preamble_count'));
      expect(preambleCountNode).toBeDefined();
      expect(preambleCountNode?.componentRef).toBe('Register');

      const byteCountNode = circuit.nodes?.find(n => n.id.includes('byte_count'));
      expect(byteCountNode).toBeDefined();
      expect(byteCountNode?.componentRef).toBe('Register');
    });
  });

  describe('Formal Port Structure', () => {
    it('should have formal input ports', () => {
      const { circuit } = loadDSLFile('MacRxParser.dsl');

      // Check byte_in input
      const byteInInput = circuit.inputs?.find(p => p.name === 'byte_in');
      expect(byteInInput).toBeDefined();
      expect(byteInInput?.portType.kind).toBe('bus');
      if (byteInInput?.portType.kind === 'bus') {
        expect(byteInInput.portType.width).toBe(8);
      }

      // Check valid input
      const validInput = circuit.inputs?.find(p => p.name === 'valid');
      expect(validInput).toBeDefined();
      expect(validInput?.portType.kind).toBe('bit');
    });

    it('should have formal output ports', () => {
      const { circuit } = loadDSLFile('MacRxParser.dsl');

      // Check data_out
      const dataOutOutput = circuit.outputs?.find(p => p.name === 'data_out');
      expect(dataOutOutput).toBeDefined();
      expect(dataOutOutput?.portType.kind).toBe('bus');
      if (dataOutOutput?.portType.kind === 'bus') {
        expect(dataOutOutput.portType.width).toBe(8);
      }

      // Check sof
      const sofOutput = circuit.outputs?.find(p => p.name === 'sof');
      expect(sofOutput).toBeDefined();
      expect(sofOutput?.portType.kind).toBe('bit');

      // Check eof
      const eofOutput = circuit.outputs?.find(p => p.name === 'eof');
      expect(eofOutput).toBeDefined();
      expect(eofOutput?.portType.kind).toBe('bit');

      // Check data_valid
      const dataValidOutput = circuit.outputs?.find(p => p.name === 'data_valid');
      expect(dataValidOutput).toBeDefined();
      expect(dataValidOutput?.portType.kind).toBe('bit');

      // Check error
      const errorOutput = circuit.outputs?.find(p => p.name === 'error');
      expect(errorOutput).toBeDefined();
      expect(errorOutput?.portType.kind).toBe('bit');
    });

    it('should have clock declaration', () => {
      const { circuit } = loadDSLFile('MacRxParser.dsl');

      const clk = circuit.clocks?.find(c => c.name === 'clk');
      expect(clk).toBeDefined();
    });
  });

  // TODO: Add functional tests with simulation
  // - Test preamble detection
  // - Test SFD detection
  // - Test frame boundary generation (sof/eof)
  // - Test error recovery (broken preamble, missing SFD)
  // - Test multiple frames back-to-back
});
