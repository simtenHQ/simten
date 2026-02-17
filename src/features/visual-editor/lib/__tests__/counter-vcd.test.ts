import { describe, it, expect } from 'vitest';
import { compileTestbenchToIR } from '@/features/dsl/compiler/testbench-compiler';
import { runTestbench } from '../testing/testbench-runner';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { compileCircuitToIR } from '@/features/dsl/compiler';
import { parseDSLOrThrow } from '@/features/dsl/parser';
import { PRIMITIVES } from '../primitives';
import { generateVCD } from '../visualization/vcd-generator';
import * as fs from 'fs';

describe('Counter VCD Output', () => {
  // TODO: Fix VCD capture to work with flat simulator signal paths
  // The hierarchical signal paths (dut.count) don't match flat simulator paths
  it.skip('should generate VCD with incrementing count', () => {
    // Initialize library with primitives
    const library = useComponentLibraryStore.getState();
    library.registerPrimitives(PRIMITIVES);

    // Create a simple library adapter for the compiler
    const compilerLibrary = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
    };

    // Load Counter circuit
    const counterDsl = fs.readFileSync('./dsl-files/Counter.dsl', 'utf-8');
    const counterAst = parseDSLOrThrow(counterDsl);
    const counterCircuit = compileCircuitToIR(counterAst.circuits[0], compilerLibrary);

    // Add to library
    library.registerUser(counterCircuit);

    // Load testbench
    const tbDsl = fs.readFileSync('./dsl-files/SimpleCounter.tb.dsl', 'utf-8');
    const tbAst = parseDSLOrThrow(tbDsl);
    const testbench = compileTestbenchToIR(tbAst.testbenches![0], library);

    // Modify the capture config to not write to file (just keep the data)
    if (testbench.capture) {
      testbench.capture.filename = ''; // Empty filename = don't write
    }

    // Run testbench for 10 cycles
    const result = runTestbench(testbench, 10);

    console.log('Result status:', result.status);
    console.log('Port values:', Object.fromEntries(result.portValues));

    // Check if count values are in the capture data
    if (result.captureData) {
      for (const [key, trace] of result.captureData.traces) {
        console.log(`Signal ${key}: values =`, trace.values);
        console.log(`Signal ${key}: changes =`, trace.changes);
      }

      // Generate VCD string
      const vcd = generateVCD(result.captureData);
      console.log('\n=== VCD OUTPUT ===\n');
      console.log(vcd);
      console.log('\n=== END VCD ===\n');

      // Check that count changes in VCD
      expect(vcd).toContain('b00000001 #'); // count = 1
      expect(vcd).toContain('b00000010 #'); // count = 2
    } else {
      console.log('No capture data!');
    }

    expect(result.status).toBe('passed');
  });
});
