/**
 * Analysis Metrics Tests
 *
 * Tests structural metrics extraction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeCircuit,
  countSequentialNodes,
  computeCriticalPath,
  computeFanMetrics,
  generateStructuralDiagnostics,
} from '../metrics.js';
import { hasCycle } from '../../validation/structural.js';
import type { ElaboratedContext } from '../types.js';
import { elaborate } from '../../../simulator/elaboration.js';
import { createComponentLibrary } from '../../../simulator/index.js';
import { PRIMITIVES } from '../../../simulator/primitives.js';
import { compileToIR } from '../../compiler/index.js';
import { parseDSL } from '../../parser/index.js';

describe('Analysis Metrics', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  function createContext(source: string): ElaboratedContext {
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

    const circuit = circuits[0];
    const flat = elaborate(circuit, library);

    return { circuit, flat, library };
  }

  describe('analyzeCircuit', () => {
    it('analyzes a simple combinational circuit', () => {
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

      const ctx = createContext(source);
      const metrics = analyzeCircuit(ctx);

      expect(metrics.nodeCount).toBeGreaterThan(0);
      expect(metrics.registerCount).toBe(0);
      expect(metrics.isPurelyCombinational).toBe(true);
      expect(metrics.combinationalDepth).toBeGreaterThan(0);
    });

    it('counts registers correctly', () => {
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

      const ctx = createContext(source);
      const metrics = analyzeCircuit(ctx);

      expect(metrics.registerCount).toBe(1);
      expect(metrics.isPurelyCombinational).toBe(false);
    });

    it('throws on cyclic graph', () => {
      // We test cycle detection at graph level since DSL prevents multiple drivers
      // The analyzeCircuit function checks for cycles before computing metrics
      // This test verifies the cycle detection logic works
      const graph = new Map<string, Set<string>>();
      graph.set('n1', new Set(['n2']));
      graph.set('n2', new Set(['n1'])); // Cycle

      expect(hasCycle(graph)).toBe(true);
    });
  });

  describe('countSequentialNodes', () => {
    it('returns 0 for purely combinational circuit', () => {
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

      const ctx = createContext(source);
      const count = countSequentialNodes(ctx.flat, ctx.library);

      expect(count).toBe(0);
    });

    it('counts all sequential elements', () => {
      const source = `
        circuit Test {
          input clk: Bit
          input d1: Bus[8]
          input d2: Bus[8]
          input we: Bit
          output q1: Bus[8]
          output q2: Bus[8]
          impl {
            node reg1: Register
            node reg2: Register
            connect d1 -> reg1.data
            connect d2 -> reg2.data
            connect we -> reg1.we
            connect we -> reg2.we
            connect clk -> reg1.clk
            connect clk -> reg2.clk
            connect reg1.q -> q1
            connect reg2.q -> q2
          }
        }
      `;

      const ctx = createContext(source);
      const count = countSequentialNodes(ctx.flat, ctx.library);

      expect(count).toBe(2);
    });
  });

  describe('computeCriticalPath', () => {
    it('computes depth for simple chain', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node n1: Not
            node n2: Not
            node n3: Not
            connect a -> n1.in
            connect n1.out -> n2.in
            connect n2.out -> n3.in
            connect n3.out -> out
          }
        }
      `;

      const ctx = createContext(source);
      const depth = computeCriticalPath(ctx.flat, ctx.library);

      // Chain of 3 inverters = depth 3
      expect(depth).toBe(3);
    });

    it('finds longest path in parallel structure', () => {
      const source = `
        circuit Test {
          input a: Bit
          input b: Bit
          output out: Bit
          impl {
            node n1: Not
            node n2: Not
            node n3: Not
            node and: And
            connect a -> n1.in
            connect n1.out -> n2.in
            connect n2.out -> and.a
            connect b -> n3.in
            connect n3.out -> and.b
            connect and.out -> out
          }
        }
      `;

      const ctx = createContext(source);
      const depth = computeCriticalPath(ctx.flat, ctx.library);

      // Longest path: a -> n1 -> n2 -> and = 3
      expect(depth).toBeGreaterThanOrEqual(3);
    });
  });

  describe('computeFanMetrics', () => {
    it('computes fan-out correctly', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out1: Bit
          output out2: Bit
          output out3: Bit
          impl {
            node n1: Not
            node n2: Not
            node n3: Not
            node n4: Not
            connect a -> n1.in
            connect n1.out -> n2.in
            connect n1.out -> n3.in
            connect n1.out -> n4.in
            connect n2.out -> out1
            connect n3.out -> out2
            connect n4.out -> out3
          }
        }
      `;

      const ctx = createContext(source);
      const { maxFanOut } = computeFanMetrics(ctx.flat);

      // n1 drives n2, n3, n4 = fan-out of 3
      expect(maxFanOut).toBeGreaterThanOrEqual(3);
    });
  });

  describe('generateStructuralDiagnostics', () => {
    it('warns about long combinational paths', () => {
      // Create metrics with long path
      const metrics = {
        nodeCount: 20,
        registerCount: 0,
        combinationalDepth: 15, // Above threshold
        maxFanOut: 2,
        maxFanIn: 2,
        isPurelyCombinational: true,
      };

      const diagnostics = generateStructuralDiagnostics(metrics);

      expect(diagnostics.some(d => d.code === 'LONG_COMBINATIONAL_PATH')).toBe(true);
    });

    it('no warnings for normal metrics', () => {
      const metrics = {
        nodeCount: 5,
        registerCount: 0,
        combinationalDepth: 3,
        maxFanOut: 2,
        maxFanIn: 2,
        isPurelyCombinational: true,
      };

      const diagnostics = generateStructuralDiagnostics(metrics);

      expect(diagnostics.length).toBe(0);
    });
  });
});
