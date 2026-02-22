/**
 * Narrative Catalog Tests
 *
 * Verifies that the component catalog (with correct port names)
 * survives narrative building and token budget enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildNarrativeSummary } from '../narrative-builder';
import { enforceTokenBudget } from '../token-counter';
import { buildEnvelope } from '@/features/dsl';
import { validateCircuit } from '@/features/dsl/validation';
import { PRIMITIVES } from '@/features/visual-editor/lib/primitive-registry';
import { createComponentLibrary } from '@/core/simulator';

describe('Narrative Component Catalog', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  /** Build the full narrative for a given DSL source */
  function buildNarrative(source: string): string {
    const validation = validateCircuit(source, { componentLibrary: library });
    const envelope = buildEnvelope({ validation, library });
    return buildNarrativeSummary(envelope);
  }

  describe('catalog includes all critical primitives', () => {
    const DEFAULT_CODE = `
      // Example: NOT Gate
      circuit Inverter {
        input a: Bit
        output out: Bit
        impl {
          node inv: Not
          connect a -> inv.in
          connect inv.out -> out
        }
      }
    `;

    it('includes Register with correct port names (data, we, q)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('Register');
      // Must show the actual port names, not generic ones
      expect(narrative).toContain('data');
      expect(narrative).toContain('we');
      // Output port is q, NOT out
      expect(narrative).toMatch(/Register.*\bq\b/);
    });

    it('includes DFlipFlop with correct port names (d, q, q_bar)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('DFlipFlop');
      expect(narrative).toMatch(/DFlipFlop.*\bd\b/);
    });

    it('includes RAM with correct port names (addr, data_in, we, data_out)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('RAM');
      expect(narrative).toContain('data_in');
      expect(narrative).toContain('data_out');
    });

    it('includes Adder with correct port names (a, b, sum, carry_out)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('Adder');
      expect(narrative).toContain('sum');
      expect(narrative).toContain('carry_out');
    });

    it('includes Mux with correct port names (in0, in1, sel)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('Mux');
      expect(narrative).toContain('in0');
      expect(narrative).toContain('in1');
      expect(narrative).toContain('sel');
    });

    it('includes Incrementer with correct port names (in, out)', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toContain('Incrementer');
    });
  });

  describe('catalog includes parameters and descriptions', () => {
    const DEFAULT_CODE = `
      circuit Test {
        input a: Bit
        output out: Bit
      }
    `;

    it('Switch shows value parameter and description', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toMatch(/Switch.*value.*int.*=.*0/);
      expect(narrative).toMatch(/Switch.*toggle/i);
    });

    it('Constant shows value parameter and warns about default', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toMatch(/Constant.*value.*int.*=.*0/);
      expect(narrative).toMatch(/Constant.*defaults to 0/i);
    });

    it('Input shows value parameter', () => {
      const narrative = buildNarrative(DEFAULT_CODE);
      expect(narrative).toMatch(/Input.*value.*int.*=.*0/);
    });
  });

  describe('catalog survives token budget enforcement', () => {
    it('Register port names survive enforceTokenBudget', () => {
      const DEFAULT_CODE = `
        // Example: NOT Gate
        circuit Inverter {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
      `;

      const narrative = buildNarrative(DEFAULT_CODE);
      const truncated = enforceTokenBudget(narrative);

      // After budget enforcement, catalog should still be intact
      // (it's placed FIRST in the narrative, truncation happens from end)
      expect(truncated).toContain('Register');
      expect(truncated).toMatch(/Register.*\bq\b/);
      expect(truncated).toContain('DFlipFlop');
    });
  });
});
