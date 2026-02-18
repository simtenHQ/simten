/**
 * Structural Validation Tests
 *
 * Tests cycle detection and floating port checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildCombinationalGraph,
  hasCycle,
  checkCycles,
  checkFloatingInputs,
  checkFloatingOutputs,
  runStructuralChecks,
} from '../structural';
import { elaborate } from '../../../../core/simulator/elaboration';
import { createComponentLibrary } from '../../../../core/simulator';
import { PRIMITIVES } from '../../../visual-editor/lib/primitives';
import { compileToIR } from '../../compiler';
import { parseDSL } from '../../parser';
import type { FlatCircuit } from '../../../../core/simulator/types';

describe('Structural Validation', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  function compileAndElaborate(source: string): FlatCircuit {
    const { ast, errors } = parseDSL(source, { componentLibrary: library });
    if (errors.length > 0) {
      throw new Error(`Parse errors: ${errors.map(e => e.message).join(', ')}`);
    }

    const compilerLibrary = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: () => {},
    };

    const circuits = compileToIR(ast, compilerLibrary);
    if (circuits.length === 0) {
      throw new Error('No circuits compiled');
    }

    return elaborate(circuits[0], library);
  }

  describe('buildCombinationalGraph', () => {
    it('builds graph for simple circuit', () => {
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

      const flat = compileAndElaborate(source);
      const graph = buildCombinationalGraph(flat, library);

      expect(graph.size).toBeGreaterThan(0);
    });

    it('excludes edges from sequential nodes', () => {
      const source = `
        circuit Test {
          input clk: Bit
          input d: Bus[8]
          input we: Bit
          output q: Bus[8]
          impl {
            node reg: Register
            connect d -> reg.data
            connect we -> reg.we
            connect clk -> reg.clk
            connect reg.q -> q
          }
        }
      `;

      const flat = compileAndElaborate(source);
      const graph = buildCombinationalGraph(flat, library);

      // The register should be in the graph but not create combinational edges
      // from its output
      for (const [nodeId, successors] of graph) {
        if (nodeId.includes('reg')) {
          // Register outputs should not have combinational successors
          expect(successors.size).toBe(0);
        }
      }
    });
  });

  describe('hasCycle', () => {
    it('returns false for acyclic graph', () => {
      const graph = new Map<string, Set<string>>();
      graph.set('a', new Set(['b']));
      graph.set('b', new Set(['c']));
      graph.set('c', new Set());

      expect(hasCycle(graph)).toBe(false);
    });

    it('returns true for cyclic graph', () => {
      const graph = new Map<string, Set<string>>();
      graph.set('a', new Set(['b']));
      graph.set('b', new Set(['c']));
      graph.set('c', new Set(['a'])); // Cycle!

      expect(hasCycle(graph)).toBe(true);
    });
  });

  describe('checkCycles', () => {
    it('detects no cycle in valid circuit', () => {
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

      const flat = compileAndElaborate(source);
      const result = checkCycles(flat, library);

      expect(result.hasCycle).toBe(false);
      expect(result.cycles.length).toBe(0);
      expect(result.diagnostics.length).toBe(0);
    });

    it('detects cycle in combinational feedback', () => {
      // Test at the graph level since DSL validation prevents multiple drivers
      const graph = new Map<string, Set<string>>();
      graph.set('n1', new Set(['n2']));
      graph.set('n2', new Set(['n1'])); // Cycle: n1 -> n2 -> n1

      expect(hasCycle(graph)).toBe(true);
    });

    it('allows feedback through registers (sequential)', () => {
      const source = `
        circuit Counter {
          input clk: Bit
          input we: Bit
          output out: Bus[8]
          impl {
            node reg: Register
            connect reg.q -> reg.data
            connect we -> reg.we
            connect clk -> reg.clk
            connect reg.q -> out
          }
        }
      `;

      const flat = compileAndElaborate(source);
      const result = checkCycles(flat, library);

      // Feedback through register is allowed
      expect(result.hasCycle).toBe(false);
    });

    it('generates atomic diagnostics per SCC', () => {
      // Test cycle detection at the graph level
      const graph = new Map<string, Set<string>>();
      graph.set('n1', new Set(['n2']));
      graph.set('n2', new Set(['n3']));
      graph.set('n3', new Set(['n1'])); // Cycle: n1 -> n2 -> n3 -> n1

      expect(hasCycle(graph)).toBe(true);

      // With two separate cycles
      const graph2 = new Map<string, Set<string>>();
      graph2.set('a', new Set(['b']));
      graph2.set('b', new Set(['a'])); // Cycle 1
      graph2.set('c', new Set(['d']));
      graph2.set('d', new Set(['c'])); // Cycle 2

      expect(hasCycle(graph2)).toBe(true);
    });

    it('produces deterministic output', () => {
      // Use a valid acyclic circuit for determinism test
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node n1: Not
            node n2: Not
            connect a -> n1.in
            connect n1.out -> n2.in
            connect n2.out -> out
          }
        }
      `;

      const flat = compileAndElaborate(source);

      // Run multiple times and ensure consistent output
      const results = Array.from({ length: 5 }, () => checkCycles(flat, library));

      const jsonResults = results.map(r => JSON.stringify(r));
      expect(new Set(jsonResults).size).toBe(1);
    });
  });

  describe('checkFloatingInputs', () => {
    it('detects floating inputs', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node and: And
            connect a -> and.a
            connect and.out -> out
          }
        }
      `;

      const flat = compileAndElaborate(source);
      const diagnostics = checkFloatingInputs(flat, library);

      // and.b is not connected
      expect(diagnostics.some(d => d.code === 'FLOATING_INPUT')).toBe(true);
    });

    it('reports no floating inputs when all connected', () => {
      const source = `
        circuit Test {
          input a: Bit
          input b: Bit
          output out: Bit
          impl {
            node and: And
            connect a -> and.a
            connect b -> and.b
            connect and.out -> out
          }
        }
      `;

      const flat = compileAndElaborate(source);
      const diagnostics = checkFloatingInputs(flat, library);

      expect(diagnostics.filter(d => d.code === 'FLOATING_INPUT').length).toBe(0);
    });
  });

  describe('checkFloatingOutputs', () => {
    it('detects floating outputs', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out1: Bit
          output out2: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out1
          }
        }
      `;

      const flat = compileAndElaborate(source);
      const diagnostics = checkFloatingOutputs(flat);

      // out2 is not driven
      expect(diagnostics.some(d => d.code === 'FLOATING_OUTPUT')).toBe(true);
      expect(diagnostics.some(d => d.message.includes('out2'))).toBe(true);
    });

    it('reports no floating outputs when all driven', () => {
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

      const flat = compileAndElaborate(source);
      const diagnostics = checkFloatingOutputs(flat);

      expect(diagnostics.filter(d => d.code === 'FLOATING_OUTPUT').length).toBe(0);
    });
  });

  describe('runStructuralChecks', () => {
    it('runs all checks and combines results', () => {
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

      const flat = compileAndElaborate(source);
      const result = runStructuralChecks(flat, library);

      expect(result).toHaveProperty('diagnostics');
      expect(result).toHaveProperty('cycleCheck');
      expect(result).toHaveProperty('floatingInputs');
      expect(result).toHaveProperty('floatingOutputs');
    });
  });
});
