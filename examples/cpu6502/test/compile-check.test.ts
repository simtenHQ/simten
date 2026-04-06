/**
 * Simple test to check DSL compilation - shows actual errors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { compileDSL, CircuitLibrary } from '../../../src/features/dsl/index';
import { useCircuitLibraryStore } from '../../../src/features/visual-editor/stores/circuit-library-store';
import { getPrimitives } from '../../../src/features/visual-editor/lib/primitive-registry';
import type { Circuit } from '../../../src/features/visual-editor/types/circuit';

// Adapter to make CircuitLibraryStore compatible with CircuitLibrary interface
class CircuitLibraryAdapter implements CircuitLibrary {
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

describe('DSL Compilation Check', () => {
  let store: ReturnType<typeof useCircuitLibraryStore.getState>;
  let library: CircuitLibrary;

  beforeEach(() => {
    store = useCircuitLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(getPrimitives());
    library = new CircuitLibraryAdapter(store);
  });

  function loadAndCompileDSL(filename: string) {
    const filepath = resolve(__dirname, '..', filename);
    const source = readFileSync(filepath, 'utf-8');
    return compileDSL(source, library);
  }

  it('should compile Program Counter', () => {
    const result = loadAndCompileDSL('05-program-counter.dsl');

    console.log('\n=== Program Counter Compilation ===');
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
        console.log(`    at line ${err.line}, col ${err.column}`);
      });
    } else {
      console.log('SUCCESS! Generated circuits:');
      result.circuits.forEach((c) => {
        console.log(`  - ${c.name}`);
      });
    }

    expect(result.errors).toHaveLength(0);
    expect(result.circuits.length).toBeGreaterThan(0);
  });

  it('should compile Instruction Decoder', () => {
    const result = loadAndCompileDSL('06-instruction-decoder.dsl');

    console.log('\n=== Instruction Decoder Compilation ===');
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
        console.log(`    at line ${err.line}, col ${err.column}`);
      });
    } else {
      console.log('SUCCESS! Generated circuits:');
      result.circuits.forEach((c) => {
        console.log(`  - ${c.name}`);
      });
    }

    expect(result.errors).toHaveLength(0);
    expect(result.circuits.length).toBeGreaterThan(0);
  });

  it('should compile minimal FSM', () => {
    const result = loadAndCompileDSL('test-minimal-fsm.dsl');

    console.log('\n=== Minimal FSM Compilation ===');
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
        console.log(`    at line ${err.line}, col ${err.column}`);
      });
    } else {
      console.log('SUCCESS! Generated circuits:');
      result.circuits.forEach((c) => {
        console.log(`  - ${c.name}`);
      });
    }

    expect(result.errors).toHaveLength(0);
    expect(result.circuits.length).toBeGreaterThan(0);
  });

  it('should compile Control FSM', () => {
    const result = loadAndCompileDSL('07-control-fsm.dsl');

    console.log('\n=== Control FSM Compilation ===');
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
        console.log(`    at line ${err.line}, col ${err.column}`);
      });
    } else {
      console.log('SUCCESS! Generated circuits:');
      result.circuits.forEach((c) => {
        console.log(`  - ${c.name}`);
      });
    }

    expect(result.errors).toHaveLength(0);
    expect(result.circuits.length).toBeGreaterThan(0);
  });

  it('should compile integrated CPU Stage 2', () => {
    // First, compile and register dependencies
    const pcResult = loadAndCompileDSL('05-program-counter.dsl');
    pcResult.circuits.forEach((c) => library.addCircuit(c));

    const decoderResult = loadAndCompileDSL('06-instruction-decoder.dsl');
    decoderResult.circuits.forEach((c) => library.addCircuit(c));

    const controlResult = loadAndCompileDSL('07-control-fsm.dsl');
    controlResult.circuits.forEach((c) => library.addCircuit(c));

    // Now compile CPU Stage 2
    const result = loadAndCompileDSL('08-cpu-stage2.dsl');

    console.log('\n=== CPU Stage 2 Compilation ===');
    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach((err) => {
        console.log(`  - ${err.message}`);
        console.log(`    at line ${err.line}, col ${err.column}`);
      });
    } else {
      console.log('SUCCESS! Generated circuits:');
      result.circuits.forEach((c) => {
        console.log(`  - ${c.name}`);
      });
    }

    expect(result.errors).toHaveLength(0);
    expect(result.circuits.length).toBeGreaterThan(0);
  });
});
