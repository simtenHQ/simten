/**
 * Eval-Synth Tests
 *
 * Tests for parsing, validating, and transpiling eval functions to Verilog.
 */

import { describe, expect, it } from 'vitest';
import { getCircuitEval } from '../../circuit/eval-registry.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { Adder, And, Xor } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import {
  checkSynthesizable,
  emitVerilogFromEval,
  parseEvalSource,
  tryEmitFromEval,
  validateSynthAST,
} from '../eval-synth.js';
import { exportVerilog } from '../exporter.js';
import type { PrimitiveContext } from '../primitive-map.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeCtx(
  primitiveType: string,
  inputs: Record<string, string>,
  outputs: Record<string, string>,
  args: Record<string, any> = {},
): PrimitiveContext {
  return {
    nodeId: 'test_node',
    primitiveType,
    args,
    wires: {
      inputs: new Map(Object.entries(inputs)),
      outputs: new Map(Object.entries(outputs)),
    },
    clockName: 'clk',
    target: 'simulation',
  };
}

function libraryFor(c: { circuit: any; _dependencies: ReadonlyMap<string, any> }) {
  const circuitMap = new Map<string, Circuit>();
  const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  lib.addCircuit(c.circuit);
  for (const [, dep] of c._dependencies) lib.addCircuit(dep.circuit ?? dep);
  return lib;
}

// ── Parser ───────────────────────────────────────────────────────────────

describe('parseEvalSource', () => {
  it('parses simple arrow expression', () => {
    const fn = ({ a, b }: any) => ({ out: a & b });
    const parsed = parseEvalSource(fn);
    expect(parsed).not.toBeNull();
    expect(parsed!.paramNames).toEqual(['a', 'b']);
  });

  it('parses arrow with block body', () => {
    const fn = ({ a, b }: any) => {
      const result = a + b;
      return { sum: result & 0xff };
    };
    const parsed = parseEvalSource(fn);
    expect(parsed).not.toBeNull();
    expect(parsed!.paramNames).toEqual(['a', 'b']);
  });

  it('parses destructuring rename', () => {
    const fn = ({ in: a }: any) => ({ out: a ? 0 : 1 });
    const parsed = parseEvalSource(fn);
    expect(parsed).not.toBeNull();
    expect(parsed!.paramNames).toEqual(['a']);
  });

  it('parses switch/case with let', () => {
    const fn = ({ a, op }: any) => {
      let result: number;
      switch (op) {
        case 0:
          result = a + 1;
          break;
        case 1:
          result = a - 1;
          break;
        default:
          result = 0;
      }
      return { out: result };
    };
    const parsed = parseEvalSource(fn);
    expect(parsed).not.toBeNull();
    expect(parsed!.paramNames).toEqual(['a', 'op']);
  });

  it('returns null for non-function', () => {
    expect(parseEvalSource(42 as any)).toBeNull();
  });
});

// ── Validator ────────────────────────────────────────────────────────────

describe('validateSynthAST', () => {
  it('accepts bitwise operations', () => {
    const fn = ({ a, b }: any) => ({ out: (a & b) | (a ^ b) });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('accepts arithmetic', () => {
    const fn = ({ a, b }: any) => ({ sum: a + b, diff: a - b });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b'], ['sum', 'diff']);
    expect(result.valid).toBe(true);
  });

  it('accepts ternary', () => {
    const fn = ({ a, b, sel }: any) => ({ out: sel ? a : b });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b', 'sel'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('accepts const declarations', () => {
    const fn = ({ a, b }: any) => {
      const sum = a + b;
      return { out: sum & 0xff };
    };
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('accepts switch/case with let-result', () => {
    const fn = ({ op, a, b }: any) => {
      let result: number;
      switch (op) {
        case 0:
          result = a + b;
          break;
        case 1:
          result = a - b;
          break;
        default:
          result = 0;
      }
      return { out: result };
    };
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['op', 'a', 'b'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('accepts comparison operators', () => {
    const fn = ({ a, b }: any) => ({
      eq: a === b ? 1 : 0,
      lt: a < b ? 1 : 0,
      gt: a > b ? 1 : 0,
    });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b'], ['eq', 'lt', 'gt']);
    expect(result.valid).toBe(true);
  });

  it('accepts logical operators', () => {
    const fn = ({ a, b }: any) => ({ out: a && b ? 1 : 0 });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a', 'b'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('accepts unary operators', () => {
    const fn = ({ a }: any) => ({ out: ~a, neg: !a });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out', 'neg']);
    expect(result.valid).toBe(true);
  });

  // ── Rejections ──

  it('rejects function calls', () => {
    const fn = ({ a }: any) => ({ out: Math.min(a, 255) });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not synthesizable'))).toBe(true);
  });

  it('rejects member expressions', () => {
    const fn = ({ a }: any) => ({ out: a.toString() });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
  });

  it('rejects loops', () => {
    // Can't directly test loop in an arrow fn that returns, but we can test
    // the validator against a parsed function with a loop
    const fn = ({ a }: any) => {
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += a;
      }
      return { out: sum };
    };
    const parsed = parseEvalSource(fn);
    if (parsed) {
      const result = validateSynthAST(parsed, ['a'], ['out']);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not synthesizable'))).toBe(true);
    }
  });

  it('rejects new expressions', () => {
    const fn = ({ a }: any) => {
      const m = new Map();
      return { out: a };
    };
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('new'))).toBe(true);
  });

  it('rejects var declarations', () => {
    // Use a function expression to get 'var'
    const fn = ({ a }: any) => {
      var x = a + 1;
      return { out: x };
    };
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('var'))).toBe(true);
  });

  it('rejects await', () => {
    // Async arrow function
    const fn = async ({ a }: any) => ({ out: await a });
    const parsed = parseEvalSource(fn);
    if (parsed) {
      const result = validateSynthAST(parsed, ['a'], ['out']);
      expect(result.valid).toBe(false);
    }
  });

  it('rejects string literals', () => {
    const fn = ({ a }: any) => ({ out: 'hello' as any });
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('string'))).toBe(true);
  });

  it('rejects references to undeclared identifiers', () => {
    const fn = ({ a }: any) => ({ out: a + globalVar });
    // globalVar doesn't exist so fn.toString() includes it
    const parsed = parseEvalSource(fn)!;
    const result = validateSynthAST(parsed, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('globalVar'))).toBe(true);
  });
});

// ── checkSynthesizable (high-level) ─────────────────────────────────────

describe('checkSynthesizable', () => {
  it('returns valid for simple combinational', () => {
    const fn = ({ a, b }: any) => ({ out: a & b });
    const result = checkSynthesizable(fn, ['a', 'b'], ['out']);
    expect(result.valid).toBe(true);
  });

  it('returns invalid with errors for function calls', () => {
    const fn = ({ a }: any) => ({ out: parseInt(a) });
    const result = checkSynthesizable(fn, ['a'], ['out']);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ── Transpiler ───────────────────────────────────────────────────────────

describe('emitVerilogFromEval', () => {
  it('transpiles simple AND', () => {
    const fn = ({ a, b }: any) => ({ out: a & b });
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx('MyAnd', { a: 'w_a', b: 'w_b' }, { out: 'w_out' });
    const result = emitVerilogFromEval(parsed, fn, ctx, ['a', 'b'], ['out']);
    expect(result.lines.some((l) => l.includes('assign w_out'))).toBe(true);
    expect(result.lines.some((l) => l.includes('w_a') && l.includes('w_b'))).toBe(true);
  });

  it('transpiles multi-output comparator', () => {
    const fn = ({ a, b }: any) => ({
      eq: a === b ? 1 : 0,
      lt: a < b ? 1 : 0,
    });
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx('MyCmp', { a: 'w_a', b: 'w_b' }, { eq: 'w_eq', lt: 'w_lt' });
    const result = emitVerilogFromEval(parsed, fn, ctx, ['a', 'b'], ['eq', 'lt']);
    expect(result.lines.some((l) => l.includes('assign w_eq'))).toBe(true);
    expect(result.lines.some((l) => l.includes('assign w_lt'))).toBe(true);
  });

  it('transpiles const intermediate wire', () => {
    const fn = ({ a, b, carry_in }: any) => {
      const result = a + b + carry_in;
      return { sum: result & 0xff, carry_out: (result >> 8) & 1 };
    };
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx(
      'MyAdd',
      { a: 'w_a', b: 'w_b', carry_in: 'w_cin' },
      { sum: 'w_sum', carry_out: 'w_cout' },
      { width: 8 },
    );
    const result = emitVerilogFromEval(
      parsed,
      fn,
      ctx,
      ['a', 'b', 'carry_in'],
      ['sum', 'carry_out'],
    );
    // Should have a wire declaration for the intermediate
    expect(result.declarations.some((d) => d.includes('wire'))).toBe(true);
    expect(result.lines.some((l) => l.includes('assign w_sum'))).toBe(true);
    expect(result.lines.some((l) => l.includes('assign w_cout'))).toBe(true);
  });

  it('transpiles switch/case to always block', () => {
    const fn = ({ a, b, op }: any) => {
      let result: number;
      switch (op) {
        case 0:
          result = a + b;
          break;
        case 1:
          result = a - b;
          break;
        default:
          result = 0;
      }
      return { out: result };
    };
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx(
      'MyALU',
      { a: 'w_a', b: 'w_b', op: 'w_op' },
      { out: 'w_out' },
      { width: 8 },
    );
    const result = emitVerilogFromEval(parsed, fn, ctx, ['a', 'b', 'op'], ['out']);
    const text = result.lines.join('\n');
    expect(text).toContain('always @(*)');
    expect(text).toContain('case (w_op)');
    expect(text).toContain('endcase');
    expect(result.declarations.some((d) => d.includes('reg'))).toBe(true);
  });

  it('strips >>> 0 unsigned coercion', () => {
    const fn = ({ a, b }: any) => ({ out: (a + b) >>> 0 });
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx('MyAdd', { a: 'w_a', b: 'w_b' }, { out: 'w_out' });
    const result = emitVerilogFromEval(parsed, fn, ctx, ['a', 'b'], ['out']);
    const text = result.lines.join('\n');
    // Should NOT contain >>> 0, just the addition
    expect(text).not.toContain('>>> 0');
    expect(text).not.toContain('>> 0');
    expect(text).toContain('w_a');
    expect(text).toContain('w_b');
  });

  it('handles destructuring rename ({ in: a })', () => {
    const fn = ({ in: a }: any) => ({ out: a ? 0 : 1 });
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx('MyNot', { in: 'w_in' }, { out: 'w_out' });
    const result = emitVerilogFromEval(parsed, fn, ctx, ['in'], ['out']);
    expect(result.lines.some((l) => l.includes('w_in'))).toBe(true);
    expect(result.lines.some((l) => l.includes('w_out'))).toBe(true);
  });

  it('emits numeric literals correctly', () => {
    // Note: V8 normalizes 0xFF to 255 in fn.toString(), so hex is lost.
    // The transpiler emits decimal. This is correct — Verilog accepts decimal.
    const fn = ({ a }: any) => ({ out: a & 0xff });
    const parsed = parseEvalSource(fn)!;
    const ctx = makeCtx('MyMask', { a: 'w_a' }, { out: 'w_out' });
    const result = emitVerilogFromEval(parsed, fn, ctx, ['a'], ['out']);
    const text = result.lines.join('\n');
    expect(text).toContain('assign w_out');
    expect(text).toContain('255');
  });
});

// ── tryEmitFromEval (integration) ────────────────────────────────────────

describe('tryEmitFromEval', () => {
  it('returns Verilog for a registered eval', () => {
    // Define a custom circuit — this registers its eval
    const MyGate = circuit('TestSynthGate', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: a && b ? 1 : 0 }),
    });

    const ctx = makeCtx('TestSynthGate', { a: 'w_a', b: 'w_b' }, { out: 'w_out' });
    const result = tryEmitFromEval(ctx, getCircuitEval);
    expect(result).not.toBeNull();
    expect(result!.lines.some((l) => l.includes('assign'))).toBe(true);
  });

  it('returns null for unknown primitive', () => {
    const ctx = makeCtx('NonExistent', {}, {});
    const result = tryEmitFromEval(ctx, getCircuitEval);
    expect(result).toBeNull();
  });

  it('transpiles sequential Register with eval + onTick', () => {
    // Register has stateKeys — now handled by eval-synth
    const ctx = makeCtx('Register', { data: 'w_d', we: 'w_we' }, { q: 'w_q' });
    const result = tryEmitFromEval(ctx, getCircuitEval);
    expect(result).not.toBeNull();
    const text = result!.lines.join('\n');
    expect(text).toContain('assign'); // eval outputs
    expect(text).toContain('always @(posedge'); // onTick
  });
});

// ── Stdlib eval validation ───────────────────────────────────────────────

describe('stdlib eval synthesizability', () => {
  it('And eval is synthesizable', () => {
    const entry = getCircuitEval('And');
    expect(entry).toBeDefined();
    const result = checkSynthesizable(entry!.evalFn, entry!.inputNames, entry!.outputNames);
    expect(result.valid).toBe(true);
  });

  it('Xor eval is synthesizable', () => {
    const entry = getCircuitEval('Xor');
    expect(entry).toBeDefined();
    const result = checkSynthesizable(entry!.evalFn, entry!.inputNames, entry!.outputNames);
    expect(result.valid).toBe(true);
  });

  // Parameterized factories — Verilog goes through primitive-map; eval is parameter-aware
  it.skip('Adder eval is synthesizable', () => {
    const entry = getCircuitEval('Adder');
    expect(entry).toBeDefined();
    const result = checkSynthesizable(entry!.evalFn, entry!.inputNames, entry!.outputNames);
    expect(result.valid).toBe(true);
  });
});

// ── End-to-end: custom circuit → Verilog ─────────────────────────────────

describe('end-to-end eval-synth export', () => {
  it('exports a circuit with custom eval via eval-synth', () => {
    // Define a custom primitive — NOT in primitive-map
    const MyXnor = circuit('TestXnor', {
      inputs: { a: bit, b: bit },
      outputs: { out: bit },
      eval: ({ a, b }) => ({ out: a === b ? 1 : 0 }),
    });

    // Build a composite that uses it
    const MyCircuit = circuit('TestSynthCircuit', {
      inputs: { x: bit, y: bit },
      outputs: { result: bit },
      nodes: { xnor: MyXnor },
      connect: ({ inputs, outputs, nodes: { xnor } }) => [
        inputs.x.to(xnor.a),
        inputs.y.to(xnor.b),
        xnor.out.to(outputs.result),
      ],
    });

    const { verilog } = exportVerilog(MyCircuit.circuit, libraryFor(MyCircuit));

    // Should contain synthesized logic, NOT a WARNING comment
    expect(verilog).toContain('module TestSynthCircuit');
    expect(verilog).not.toContain('WARNING: Unsupported primitive');
    expect(verilog).toContain('assign');
    expect(verilog).toContain('endmodule');
  });
});

// ── End-to-end: top-level primitive → simulate ──────────────────────────

describe('top-level primitive simulation', () => {
  it('elaborates and simulates a Doubler with eval', async () => {
    const { elaborate } = await import('../../simulator/elaboration.js');
    const { createSimulator } = await import('../../simulator/index.js');

    const Doubler = circuit('TestDoubler', {
      inputs: { a: bus(8) },
      outputs: { result: bus(16) },
      eval: ({ a }) => ({ result: (a << 1) >>> 0 }),
    });

    const lib = {
      resolveCircuit: (name: string) => (name === 'TestDoubler' ? Doubler.circuit : undefined),
      getAllPrimitiveNames: () => ['TestDoubler'],
    };

    const flat = elaborate(Doubler.circuit, lib);
    expect(flat.nodes.length).toBe(1);
    expect(flat.nodes[0].primitiveType).toBe('TestDoubler');

    const sim = createSimulator(flat, { componentLibrary: lib });
    sim.setNode('a', 5);
    sim.runCombinational();
    const vals = sim.getPortValues();
    expect(vals.get('__top__.result')).toBe(10);
  });

  it('elaborates and simulates a Register with state', async () => {
    const { elaborate } = await import('../../simulator/elaboration.js');
    const { createSimulator } = await import('../../simulator/index.js');
    const { reg } = await import('../../circuit/bit-bus.js');

    const MyReg = circuit('TestSimReg', {
      inputs: { data: bus(8), we: bit },
      outputs: { q: bus(8) },
      state: { value: reg(8) },
      eval: ({ value }) => ({ q: value as number }),
      onTick: ({ data, we, value }) => ({ value: we ? (data as number) : (value as number) }),
    });

    const lib = {
      resolveCircuit: (name: string) => (name === 'TestSimReg' ? MyReg.circuit : undefined),
      getAllPrimitiveNames: () => ['TestSimReg'],
    };

    const flat = elaborate(MyReg.circuit, lib);
    expect(flat.nodes.length).toBe(1);

    const sim = createSimulator(flat, { componentLibrary: lib });
    sim.setNode('data', 42);
    sim.setNode('we', 1);
    sim.tick(); // clock edge: value ← 42
    const vals = sim.getPortValues();
    expect(vals.get('__top__.q')).toBe(42);
  });
});

// Declare globalVar to avoid TS error in the undeclared identifier test
declare const globalVar: any;
