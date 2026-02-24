/**
 * Validation Pipeline Tests
 *
 * Tests the complete validation pipeline including:
 * - Phase progression and guarding
 * - Diagnostic generation
 * - Cycle detection
 * - Floating port detection
 * - Format outputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCircuit,
  isValid,
  canSimulate,
  formatForMonaco,
  formatForCLI,
  formatForLLM,
  isBlocking,
} from '../index.js';
import type { Diagnostic } from '../types.js';
import { createComponentLibrary } from '../../../simulator/index.js';
import { PRIMITIVES } from '../../../simulator/primitives.js';

describe('Validation Pipeline', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  describe('validateCircuit', () => {
    it('validates a simple valid circuit', () => {
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

      expect(result.valid).toBe(true);
      expect(result.canSimulate).toBe(true);
      expect(result.diagnostics.length).toBe(0);
      expect(result.circuits?.length).toBe(1);
    });

    it('reports syntax errors', () => {
      const source = `
        circuit Test {
          input a Bit  // Missing colon
          output out: Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.some(d => d.phase === 'syntax')).toBe(true);
    });

    it('reports semantic errors for unknown components', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node unknown: UnknownComponent
            connect a -> unknown.in
            connect unknown.out -> out
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'UNKNOWN_COMPONENT')).toBe(true);
    });

    it('reports duplicate names', () => {
      const source = `
        circuit Test {
          input a: Bit
          input a: Bit
          output out: Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.valid).toBe(false);
      expect(result.diagnostics.some(d => d.code === 'DUPLICATE_NAME')).toBe(true);
    });

    it('includes analysis context', () => {
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

      expect(result.analysis.circuitsDefined).toContain('Test');
      expect(result.analysis.componentsUsed).toContain('Not');
    });

    it('includes available components', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.availableComponents.length).toBeGreaterThan(0);
      expect(result.availableComponents.some(c => c.name === 'And')).toBe(true);
    });
  });

  describe('phase guarding', () => {
    it('does not run structural checks when type phase fails', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node unknown: UnknownComponent
            connect a -> unknown.in
            connect unknown.out -> out
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      // Should have semantic errors, but no structural phase errors
      expect(result.diagnostics.some(d => d.phase === 'semantic')).toBe(true);
      expect(result.diagnostics.every(d => d.phase !== 'structural')).toBe(true);
    });
  });

  describe('deterministic output', () => {
    it('produces consistent diagnostic ordering', () => {
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

      // Run validation multiple times
      const results = Array.from({ length: 5 }, () =>
        validateCircuit(source, { componentLibrary: library })
      );

      // All results should be identical
      const jsonResults = results.map(r => JSON.stringify(r.diagnostics));
      expect(new Set(jsonResults).size).toBe(1);
    });
  });

  describe('isBlocking', () => {
    it('identifies blocking errors', () => {
      const blockingDiagnostic: Diagnostic = {
        phase: 'syntax',
        code: 'SYNTAX_ERROR',
        severity: 'error',
        message: 'Syntax error',
      };

      expect(isBlocking(blockingDiagnostic)).toBe(true);
    });

    it('non-blocking warnings', () => {
      const warningDiagnostic: Diagnostic = {
        phase: 'structural',
        code: 'FLOATING_OUTPUT',
        severity: 'warning',
        message: 'Floating output',
      };

      expect(isBlocking(warningDiagnostic)).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('isValid returns true for valid circuits', () => {
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

      expect(isValid(source, library)).toBe(true);
    });

    it('isValid returns false for invalid circuits', () => {
      const source = `
        circuit Test {
          input a Bit  // Missing colon
        }
      `;

      expect(isValid(source, library)).toBe(false);
    });

    it('canSimulate reflects blocking error status', () => {
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

      expect(canSimulate(source, library)).toBe(true);
    });
  });
});

describe('Formatters', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  describe('formatForMonaco', () => {
    it('converts diagnostics to Monaco markers', () => {
      const source = `
        circuit Test {
          input a Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const markers = formatForMonaco(result);

      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0]).toHaveProperty('severity');
      expect(markers[0]).toHaveProperty('startLineNumber');
      expect(markers[0]).toHaveProperty('message');
    });

    it('skips diagnostics without location', () => {
      const result = validateCircuit('circuit Test {}', { componentLibrary: library });

      // Add a diagnostic without location
      result.diagnostics.push({
        phase: 'structural',
        code: 'INTERNAL_ERROR',
        severity: 'error',
        message: 'Internal error',
        // No location
      });

      const markers = formatForMonaco(result);
      // The internal error without location should be skipped
      expect(markers.every(m => m.startLineNumber > 0)).toBe(true);
    });
  });

  describe('formatForCLI', () => {
    it('formats valid result', () => {
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
      const output = formatForCLI(result, { colors: false });

      expect(output).toContain('No issues found');
    });

    it('formats errors without colors', () => {
      const source = `
        circuit Test {
          input a Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const output = formatForCLI(result, { colors: false });

      expect(output).toContain('error');
    });
  });

  describe('formatForLLM', () => {
    it('produces complete structure with all required fields', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });
      const llmContext = formatForLLM(result);

      // All fields must be present
      expect(llmContext).toHaveProperty('status');
      expect(llmContext).toHaveProperty('diagnostics');
      expect(llmContext).toHaveProperty('components');
      expect(llmContext).toHaveProperty('grammarSummary');
      expect(llmContext).toHaveProperty('analysis');

      // Arrays should be arrays, not undefined
      expect(Array.isArray(llmContext.diagnostics)).toBe(true);
      expect(Array.isArray(llmContext.components)).toBe(true);
    });

    it('sets correct status based on errors', () => {
      // Valid circuit with impl block
      const validSource = `
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
      const validResult = validateCircuit(validSource, { componentLibrary: library });
      expect(formatForLLM(validResult).status).toBe('valid');

      // With errors
      const errorSource = `
        circuit Test {
          input a Bit
        }
      `;
      const errorResult = validateCircuit(errorSource, { componentLibrary: library });
      expect(formatForLLM(errorResult).status).toBe('errors');
    });
  });

  describe('composite resolution', () => {
    it('resolves same-file composites through the full pipeline', () => {
      const source = `
        circuit Inner {
          input a: Bit
          output out: Bit
          impl {
            node buf: Buffer
            connect a -> buf.in
            connect buf.out -> out
          }
        }

        circuit Outer {
          input x: Bit
          output y: Bit
          impl {
            node inner: Inner
            connect x -> inner.a
            connect inner.out -> y
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.valid).toBe(true);
      expect(result.canSimulate).toBe(true);
      expect(result.circuits?.map(c => c.name)).toEqual(['Inner', 'Outer']);
    });

    it('resolves clock-driven composite with harness pattern', () => {
      const source = `
        circuit Counter {
          clock clk
          output count: Bus[8]
          impl {
            node reg: Register
            node adder: Adder
            node one: Constant(value=1)
            node we_on: Constant(value=1)
            connect reg.q -> adder.a
            connect one.out -> adder.b
            connect adder.sum -> reg.data
            connect we_on.out -> reg.we
            connect reg.q -> count
          }
        }

        circuit CounterHarness {
          impl {
            node dut: Counter
            node count_out: HexDisplay
            connect dut.count -> count_out.in
          }
        }
      `;

      const result = validateCircuit(source, { componentLibrary: library });

      expect(result.valid).toBe(true);
      expect(result.circuits?.map(c => c.name)).toEqual(['Counter', 'CounterHarness']);
    });
  });
});
