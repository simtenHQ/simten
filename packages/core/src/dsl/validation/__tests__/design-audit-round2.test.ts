/**
 * Design Audit Round 2 Tests
 *
 * Tests for all 7 fixes from the DSL design audit:
 * 1. Recursive circuit crash guard
 * 2. Unified sequential port allowlists
 * 3. WIDTH_MISMATCH blocking metadata
 * 4. Visitor graceful error recovery
 * 5. DSL generator round-trip for state and params
 * 6. on_clock statements warning
 * 7. Parametric user circuit warning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateCircuit } from '../index.js';
import { isBlocking } from '../types.js';
import type { Diagnostic } from '../types.js';
import { createComponentLibrary } from '../../../simulator/index.js';
import { PRIMITIVES } from '../../../simulator/primitives.js';
import { SEQUENTIAL_INPUT_PORTS } from '../../../types/simulator.js';
import { parseDSL } from '../../parser/index.js';
import { generateDSL } from '../../generator/dsl-generator.js';
import { compileDSL } from '../../index.js';

describe('Design Audit Round 2', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  // ==========================================================================
  // Fix 1: Recursive circuit crash guard
  // ==========================================================================
  describe('Fix 1: Recursive circuit definition detection', () => {
    it('should not crash on self-referencing circuit', () => {
      const source = `
        circuit Foo {
          input a: Bit
          output b: Bit
          impl {
            node f: Foo
            connect a -> f.a
            connect f.b -> b
          }
        }
      `;

      // Should NOT throw (no stack overflow) — should produce an error diagnostic
      const result = validateCircuit(source, { componentLibrary: library });
      expect(result.valid).toBe(false);
    });

    it('should not crash on mutually recursive circuits (forward ref fails)', () => {
      const source = `
        circuit A {
          input x: Bit
          output y: Bit
          impl {
            node b: B
            connect x -> b.x
            connect b.y -> y
          }
        }
        circuit B {
          input x: Bit
          output y: Bit
          impl {
            node a: A
            connect x -> a.x
            connect a.y -> y
          }
        }
      `;

      // Forward reference to B should fail at compile time, not stack overflow
      const result = validateCircuit(source, { componentLibrary: library });
      expect(result.valid).toBe(false);
    });

    it('should elaborate valid non-recursive composites normally', () => {
      const source = `
        circuit MyNot {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
        circuit DoubleNot {
          input a: Bit
          output out: Bit
          impl {
            node n1: MyNot
            node n2: MyNot
            connect a -> n1.a
            connect n1.out -> n2.a
            connect n2.out -> out
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      expect(result.valid).toBe(true);
      expect(result.canSimulate).toBe(true);
    });
  });

  // ==========================================================================
  // Fix 2: Unified sequential port allowlists
  // ==========================================================================
  describe('Fix 2: SEQUENTIAL_INPUT_PORTS constant', () => {
    it('should include all required sequential port names', () => {
      const expected = ['d', 'data', 'data_in', 'dataA', 'dataB', 'we', 'weA', 'weB'];
      for (const port of expected) {
        expect(SEQUENTIAL_INPUT_PORTS.has(port)).toBe(true);
      }
    });

    it('should not include non-sequential ports', () => {
      expect(SEQUENTIAL_INPUT_PORTS.has('in')).toBe(false);
      expect(SEQUENTIAL_INPUT_PORTS.has('a')).toBe(false);
      expect(SEQUENTIAL_INPUT_PORTS.has('b')).toBe(false);
      expect(SEQUENTIAL_INPUT_PORTS.has('out')).toBe(false);
      expect(SEQUENTIAL_INPUT_PORTS.has('q')).toBe(false);
    });
  });

  // ==========================================================================
  // Fix 3: WIDTH_MISMATCH blocking metadata
  // ==========================================================================
  describe('Fix 3: WIDTH_MISMATCH is non-blocking', () => {
    it('should not block simulation for width mismatch warnings', () => {
      const widthMismatchDiagnostic: Diagnostic = {
        phase: 'type',
        code: 'WIDTH_MISMATCH',
        severity: 'warning',
        message: 'Width mismatch: a (8-bit) -> b (4-bit)',
      };

      expect(isBlocking(widthMismatchDiagnostic)).toBe(false);
    });

    it('WIDTH_MISMATCH as error should still not block (blocking: false)', () => {
      // Even if someone made it severity: error, blocking is false
      const diagnostic: Diagnostic = {
        phase: 'type',
        code: 'WIDTH_MISMATCH',
        severity: 'error',
        message: 'Width mismatch',
      };

      // blocking is false in DIAGNOSTIC_META, but isBlocking checks severity first
      // Since severity is error AND blocking is false, isBlocking returns false
      expect(isBlocking(diagnostic)).toBe(false);
    });

    it('should allow simulation with width mismatches', () => {
      const source = `
        circuit Test {
          input a: Bus[8]
          output out: Bus[4]
          impl {
            node buf: Buffer(width = 4)
            connect a -> buf.in
            connect buf.out -> out
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      // Width mismatch should be a warning, not prevent simulation
      const widthWarnings = result.diagnostics.filter(d => d.code === 'WIDTH_MISMATCH');
      for (const w of widthWarnings) {
        expect(isBlocking(w)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Fix 4: Visitor graceful error recovery
  // ==========================================================================
  describe('Fix 4: Visitor error recovery', () => {
    it('should not crash on invalid memory type (non-power-of-2 size)', () => {
      // This tests the visitMemoryType recovery
      const source = `
        circuit Test {
          input x: Bit
          output y: Bit
          state mem: Array[3, Bit]
        }
      `;

      // Should not throw, should parse with isIncomplete
      expect(() => parseDSL(source)).not.toThrow();
    });

    it('should not crash on valid memory type', () => {
      const source = `
        circuit Test {
          input x: Bit
          output y: Bit
          state mem: Array[256, Bus[8]]
        }
      `;

      const { ast, errors } = parseDSL(source);
      expect(ast).toBeDefined();
      // Parse should succeed; may have semantic issues but no crash
    });
  });

  // ==========================================================================
  // Fix 5: DSL generator round-trip for state and params
  // ==========================================================================
  describe('Fix 5: DSL generator state and parameter syntax', () => {
    it('should generate parenthesis syntax for parameters', () => {
      const source = `
        circuit Adder(width: int = 8) {
          input a: Bus[width]
          input b: Bus[width]
          output sum: Bus[width]
        }
      `;

      const compilerLib = {
        getCircuit: (name: string) => library.resolveComponent(name),
        hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
        addCircuit: () => {},
      };

      const { circuits, errors } = compileDSL(source, compilerLib);
      expect(errors).toHaveLength(0);
      expect(circuits).toHaveLength(1);

      const generated = generateDSL(circuits[0]);

      // Should use parentheses, not angle brackets
      expect(generated).toContain('(width: int = 8)');
      expect(generated).not.toContain('<');
      expect(generated).not.toContain('>');
    });

    it('should generate individual state declarations (not block syntax)', () => {
      const source = `
        circuit Counter {
          input clk_in: Bit
          output count: Bus[8]
          clock clk
          state counter_val: Bus[8] = 0
        }
      `;

      const compilerLib = {
        getCircuit: (name: string) => library.resolveComponent(name),
        hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
        addCircuit: () => {},
      };

      const { circuits, errors } = compileDSL(source, compilerLib);
      expect(errors).toHaveLength(0);

      const generated = generateDSL(circuits[0]);

      // Should use individual state declarations
      expect(generated).toContain('state counter_val: Bus[8]');
      // Should NOT use block syntax
      expect(generated).not.toContain('state {');
    });

    it('should generate Array syntax for memory state', () => {
      const source = `
        circuit MemTest {
          input x: Bit
          output y: Bit
          state mem: Array[256, Bus[8]]
        }
      `;

      const compilerLib = {
        getCircuit: (name: string) => library.resolveComponent(name),
        hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
        addCircuit: () => {},
      };

      const { circuits, errors } = compileDSL(source, compilerLib);
      expect(errors).toHaveLength(0);

      const generated = generateDSL(circuits[0]);
      expect(generated).toContain('state mem: Array[256, Bus[8]]');
    });
  });

  // ==========================================================================
  // Fix 6: on_clock statements warning
  // ==========================================================================
  describe('Fix 6: Behavioral statements warning', () => {
    it('should warn when on_clock statements are present', () => {
      const source = `
        circuit Counter {
          input en: Bit
          output count: Bus[8]
          clock clk
          state counter_val: Bus[8] = 0

          impl {
            on clk rising {
              counter_val = counter_val + 1
            }
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const unsupportedWarnings = result.diagnostics.filter(
        d => d.code === 'UNSUPPORTED_FEATURE' && d.message.includes('Behavioral statements')
      );
      expect(unsupportedWarnings.length).toBeGreaterThan(0);
      expect(unsupportedWarnings[0].severity).toBe('warning');
    });

    it('should not warn when no behavioral statements exist', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const unsupportedWarnings = result.diagnostics.filter(
        d => d.code === 'UNSUPPORTED_FEATURE'
      );
      expect(unsupportedWarnings.length).toBe(0);
    });
  });

  // ==========================================================================
  // Fix 7: Parametric user circuit warning
  // ==========================================================================
  describe('Fix 7: Parametric composite circuit warning', () => {
    it('should warn when composite circuit is instantiated with non-default params', () => {
      const source = `
        circuit MyBuffer(width: int = 8) {
          input a: Bus[width]
          output out: Bus[width]
          impl {
            node buf: Buffer(width = width)
            connect a -> buf.in
            connect buf.out -> out
          }
        }

        circuit Top {
          input x: Bus[16]
          output y: Bus[16]
          impl {
            node mb: MyBuffer(width = 16)
            connect x -> mb.a
            connect mb.out -> y
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const paramWarnings = result.diagnostics.filter(
        d => d.code === 'UNSUPPORTED_FEATURE' && d.message.includes('Parametric instantiation')
      );
      expect(paramWarnings.length).toBeGreaterThan(0);
      expect(paramWarnings[0].severity).toBe('warning');
    });

    it('should not warn when composite uses default params', () => {
      const source = `
        circuit MyNot {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
        circuit Top {
          input x: Bit
          output y: Bit
          impl {
            node n: MyNot
            connect x -> n.a
            connect n.out -> y
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const paramWarnings = result.diagnostics.filter(
        d => d.code === 'UNSUPPORTED_FEATURE' && d.message.includes('Parametric instantiation')
      );
      expect(paramWarnings.length).toBe(0);
    });
  });
});
