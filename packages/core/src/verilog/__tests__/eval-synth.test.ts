/**
 * Eval-synth tests: Verilog translated from a primitive's own eval/onTick.
 *
 * The differential test checks the translations against iverilog; these pin
 * down what is translated and, above all, what is refused with a reason
 * instead of being translated wrongly (#429).
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import type { Circuit } from '../../circuit/builder-types.js';
import { bit, bus, circuit, mem, reg } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { And, MOS6502_ALU, Xor } from '../../std/index.js';
import { checkEvalSynthesizable } from '../eval-synth.js';
import { checkSynthesizable, exportVerilog } from '../exporter.js';

/** `inner` as the only node of a top circuit with the same ports. */
function wrap(inner: Circuit): Circuit {
  const { inputs, outputs } = internalsOf(inner).ir;
  const ports = (list: typeof inputs) => Object.fromEntries(list.map((p) => [p.name, p.portType]));
  return circuit('Top', {
    inputs: ports(inputs),
    outputs: ports(outputs),
    nodes: { u: inner },
    connect: ({ inputs: i, outputs: o, nodes: { u } }) => {
      const n = u as unknown as Record<string, { to: (...t: unknown[]) => unknown }>;
      const ins = i as unknown as Record<string, { to: (...t: unknown[]) => unknown }>;
      return [
        ...inputs.map((p) => ins[p.name].to(n[p.name])),
        ...outputs.map((p) => n[p.name].to((o as Record<string, unknown>)[p.name])),
      ] as never;
    },
  });
}

/** Why `inner` can't be exported, or undefined when it can. */
function reason(inner: Circuit): string | undefined {
  const { valid, errors } = checkSynthesizable(wrap(inner));
  return valid ? undefined : errors.join('\n');
}

const verilogOf = (inner: Circuit) => exportVerilog(wrap(inner)).verilog;

describe('eval-synth translates', () => {
  it('&& and ! on buses by value, not bitwise', () => {
    const C = circuit('Logical', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { both: bit, none: bit },
      eval: ({ a, b }) => ({ both: a && b ? 1 : 0, none: !a ? 1 : 0 }),
    });
    const v = verilogOf(C);
    expect(v).toContain('assign w_u_both = ((a ? b : 0) ? 1 : 0);');
    expect(v).toContain('assign w_u_none = ((a == 0) ? 1 : 0);');
  });

  it('JS >> on a 32-bit value as an arithmetic shift of its int32 reading', () => {
    const C = circuit('Sar', {
      inputs: { a: bus(32) },
      outputs: { y: bus(32) },
      eval: ({ a }) => ({ y: a >> 3 }),
    });
    expect(verilogOf(C)).toMatch(/>>> 3\)/);
  });

  it('a const at the width its value needs, with no width argument', () => {
    const C = circuit('WideConst', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a, b }) => {
        const sum = a + b;
        return { y: sum >> 1 };
      },
    });
    const v = verilogOf(C);
    expect(v).toContain('wire [8:0] u_sum;');
    expect(v).toContain("assign u_sum = ((a + b) + 9'd0);");
  });

  it('a let with its initial value, reassigned in branches', () => {
    const C = circuit('LetInit', {
      inputs: { a: bus(8), s: bit },
      outputs: { y: bus(8) },
      eval: ({ a, s }) => {
        let y = a;
        if (s) y = 0;
        return { y };
      },
    });
    expect(verilogOf(C)).toContain('assign u_y = (s ? 0 : a);');
  });

  it('an early return in onTick as a choice of next state', () => {
    const C = circuit('EarlyReturn', {
      inputs: { en: bit },
      outputs: { count: bus(8) },
      state: { n: reg(8) },
      eval: ({ n }) => ({ count: n }),
      onTick: ({ en, n }) => {
        if (!en) return { n };
        return { n: (n + 1) & 0xff };
      },
    });
    const v = verilogOf(C);
    expect(v).toMatch(/input clk,\s+input rst_n,/);
    expect(v).toContain('u_n <= u_n_ret;');
  });

  it('a primitive with onTick gets the clock and reset, and resets to its initial state', () => {
    const C = circuit('InitState', {
      inputs: { en: bit },
      outputs: { count: bus(8) },
      state: { n: reg(8, 42) },
      eval: ({ n }) => ({ count: n }),
      onTick: ({ en, n }) => ({ n: en ? (n + 1) & 0xff : n }),
    });
    const v = verilogOf(C);
    expect(v).toMatch(/input clk,\s+input rst_n,/);
    expect(v).toContain("initial u_n = 8'd42;");
    expect(v).toContain("u_n <= 8'd42;");
  });

  it('a memory, declared and zeroed, written in onTick', () => {
    const C = circuit('Mem', {
      inputs: { addr: bus(4), data: bus(8), we: bit },
      outputs: { q: bus(8) },
      state: { m: mem(16, 8, { 3: 7 }) },
      eval: ({ addr, m }) => ({ q: m[addr] }),
      onTick: ({ addr, data, we, m }) => {
        if (we) m[addr] = data;
        return { m };
      },
    });
    const v = verilogOf(C);
    expect(v).toContain('reg [7:0] u_m [0:15];');
    expect(v).toContain("u_m[3] = 8'd7;");
    expect(v).toContain('if (we) u_m[addr] <= data;');
  });

  it('an unconnected input as 0, not an undeclared register', () => {
    const C = circuit('Unconnected', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a, b }) => ({ y: a | b }),
    });
    const Top = circuit('UnconnectedTop', {
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      nodes: { u: C },
      connect: ({ inputs, outputs, nodes: { u } }) => [inputs.a.to(u.a), u.y.to(outputs.y)],
    });
    expect(exportVerilog(Top).verilog).toContain('assign w_u_y = (a | 0);');
  });

  it("every eval in the 6502's datapath", () => {
    expect(reason(MOS6502_ALU)).toBeUndefined();
  });
});

describe('eval-synth refuses, with the reason, what it would translate wrongly', () => {
  const refused: [string, Circuit, RegExp][] = [
    [
      'a call',
      circuit('Call', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        eval: ({ a }) => ({ y: Math.max(a, 3) }),
      }),
      /eval: it calls Math\.max\(\)/,
    ],
    [
      'division',
      circuit('Div', {
        inputs: { a: bus(8), b: bus(8) },
        outputs: { y: bus(8) },
        eval: ({ a, b }) => ({ y: a / b }),
      }),
      /operator '\/'/,
    ],
    [
      'a loop',
      circuit('Loop', {
        inputs: { a: bus(8) },
        outputs: { y: bit },
        eval: ({ a }) => {
          let p = 0;
          for (let i = 0; i < 8; i++) p ^= (a >> i) & 1;
          return { y: p };
        },
      }),
      /ForStatement/,
    ],
    [
      'a state value that outgrows its register',
      circuit('Grow', {
        inputs: { en: bit },
        outputs: { y: bus(8) },
        state: { n: reg(8) },
        eval: ({ n }) => ({ y: n }),
        onTick: ({ n }) => ({ n: n + 1 }),
      }),
      /state 'n' can be set outside its 8 bits/,
    ],
    [
      'an output returned on some paths only',
      circuit('Partial', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8), z: bus(8) },
        eval: (({ a }: { a: number }) => {
          if (a) return { y: a, z: 0 };
          return { y: 0 };
        }) as never,
      }),
      /returns 'z' on some paths but not on others/,
    ],
    [
      'a path with no return',
      circuit('NoReturn', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        eval: (({ a }: { a: number }) => {
          if (a) return { y: 1 };
        }) as never,
      }),
      /does not return on every path/,
    ],
    [
      '=== between a boolean and a number',
      circuit('StrictBool', {
        inputs: { a: bus(8), b: bus(8) },
        outputs: { y: bit },
        eval: ({ a, b }) => ({ y: a > b === (1 as unknown) ? 1 : 0 }),
      }),
      /never finds equal/,
    ],
    [
      'a product past 2^53',
      circuit('BigProduct', {
        inputs: { a: bus(32), b: bus(32) },
        outputs: { y: bus(32) },
        eval: ({ a, b }) => ({ y: a * b }),
      }),
      /can exceed 2\^53/,
    ],
    [
      'a name it never defines',
      circuit('Undefined', {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        eval: (({ a, scale }: { a: number; scale: number }) => ({ y: a * scale })) as never,
      }),
      /reads 'scale', which is not an input, state or argument/,
    ],
    [
      'a switch case that falls through',
      circuit('FallThrough', {
        inputs: { a: bus(2) },
        outputs: { y: bus(8) },
        // Built from text: written out here, the fall-through is a lint error.
        eval: Function(
          'return ({ a }) => { let y = 0; switch (a) { case 0: y = 1; case 1: y = 2; break; } return { y }; }',
        )(),
      }),
      /falls through/,
    ],
  ];

  for (const [what, inner, why] of refused) {
    it(what, () => {
      expect(reason(inner)).toMatch(why);
      const { unsupported, verilog } = exportVerilog(wrap(inner));
      expect(unsupported).toEqual({ [inner.name]: ['u'] });
      expect(verilog).toMatch(why);
    });
  }
});

describe('checkEvalSynthesizable (one eval, by port names)', () => {
  it('accepts std gates', () => {
    for (const c of [And, Xor]) {
      const { evalFn, inputNames, outputNames } = internalsOf(c).behavior!;
      expect(checkEvalSynthesizable(evalFn, inputNames, outputNames)).toEqual({
        valid: true,
        errors: [],
      });
    }
  });

  it('gives the reason for one it refuses', () => {
    const result = checkEvalSynthesizable(({ a }) => ({ y: Math.abs(a as number) }), ['a'], ['y']);
    expect(result).toEqual({ valid: false, errors: ['eval: it calls Math.abs()'] });
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

    // The exporter reads the circuit's own behavior, so the user's eval is
    // translated rather than left as an unsupported primitive.
    const { verilog, unsupported } = exportVerilog(MyCircuit);
    expect(unsupported).toBeUndefined();

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
    const { createEngine } = await import('../../simulator/index.js');

    const Doubler = circuit('TestDoubler', {
      inputs: { a: bus(8) },
      outputs: { result: bus(16) },
      eval: ({ a }) => ({ result: (a << 1) >>> 0 }),
    });

    const definitions = {
      resolveCircuit: (name: string) =>
        name === 'TestDoubler' ? internalsOf(Doubler).ir : undefined,
      getAllPrimitiveNames: () => ['TestDoubler'],
    };

    const flat = elaborate(internalsOf(Doubler).ir, definitions);
    expect(flat.nodes.length).toBe(1);
    expect(flat.nodes[0].primitiveType).toBe('TestDoubler');

    const sim = createEngine(flat, {
      library: { definitions, behaviors: libraryOf(Doubler).behaviors },
    });
    sim.setNode('a', 5);
    sim.runCombinational();
    const vals = sim.getPortValues();
    expect(vals.get('__top__.result')).toBe(10);
  });

  it('elaborates and simulates a Register with state', async () => {
    const { elaborate } = await import('../../simulator/elaboration.js');
    const { createEngine } = await import('../../simulator/index.js');
    const { reg } = await import('../../circuit/bit-bus.js');

    const MyReg = circuit('TestSimReg', {
      inputs: { data: bus(8), we: bit },
      outputs: { q: bus(8) },
      state: { value: reg(8) },
      eval: ({ value }) => ({ q: value as number }),
      onTick: ({ data, we, value }) => ({ value: we ? (data as number) : (value as number) }),
    });

    const definitions = {
      resolveCircuit: (name: string) => (name === 'TestSimReg' ? internalsOf(MyReg).ir : undefined),
      getAllPrimitiveNames: () => ['TestSimReg'],
    };

    const flat = elaborate(internalsOf(MyReg).ir, definitions);
    expect(flat.nodes.length).toBe(1);

    const sim = createEngine(flat, {
      library: { definitions, behaviors: libraryOf(MyReg).behaviors },
    });
    sim.setNode('data', 42);
    sim.setNode('we', 1);
    sim.tick(); // clock edge: value ← 42
    const vals = sim.getPortValues();
    expect(vals.get('__top__.q')).toBe(42);
  });
});
