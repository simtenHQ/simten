/**
 * circuit() builder fixes from #428: factory default state, same-name
 * definitions, runtime port direction, bad `connect` returns, fixed state
 * widths, and differently built composites under one name.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { Register } from '../../std/index.js';
import { executeJsCode } from '../execute.js';
import { bit, bus, circuit, reg } from '../index.js';

const Inv = circuit('B428_Inv', {
  inputs: { a: bit },
  outputs: { out: bit },
  eval: ({ a }) => ({ out: a ? 0 : 1 }),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('factory default state (#428)', () => {
  const Counter = circuit('B428_Counter', ({ value = 7 }: { value?: number } = {}) => ({
    outputs: { q: bus(8) },
    state: { value },
    eval: ({ value }) => ({ q: value as number }),
    onTick: ({ value }) => ({ value: ((value as number) + 1) & 0xff }),
  }));

  it('starts at the default the factory resolved', () => {
    expect(simulate(Counter()).get('q')).toBe(7);
  });

  it('keeps the default inside a parent circuit', () => {
    const Top = circuit('B428_CounterTop', {
      outputs: { q: bus(8) },
      nodes: { c: Counter() },
      connect: ({ outputs, nodes: { c } }) => [c.q.to(outputs.q)],
    });
    const sim = simulate(Top);
    expect(sim.get('q')).toBe(7);
    sim.tick();
    expect(sim.get('q')).toBe(8);
  });

  it('still lets an explicit argument win', () => {
    expect(simulate(Counter({ value: 3 })).get('q')).toBe(3);
  });

  it('keeps a reg() initial whose option has a different name', () => {
    const Seeded = circuit('B428_Seeded', ({ seed = 5 }: { seed?: number } = {}) => ({
      outputs: { q: bus(8) },
      state: { value: reg(8, seed) },
      eval: ({ value }) => ({ q: value as number }),
      onTick: ({ value }) => ({ value }),
    }));
    expect(simulate(Seeded()).get('q')).toBe(5);
    expect(simulate(Seeded({ seed: 9 })).get('q')).toBe(9);
  });

  it('adds nothing to the arguments when the default is the type default', () => {
    expect(Register()._args).toEqual({});
    expect(Counter()._args).toEqual({ value: 7 });
  });
});

describe('same-name definitions (#428)', () => {
  it('warns when two different primitives share a name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    circuit('B428_Twice', { inputs: { a: bit }, outputs: { o: bit }, eval: ({ a }) => ({ o: a }) });
    circuit('B428_Twice', {
      inputs: { a: bit },
      outputs: { o: bit },
      eval: ({ a }) => ({ o: a ? 0 : 1 }),
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Two different circuits are named 'B428_Twice'"),
    );
  });

  it('does not warn for specialisations of one factory', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Buf = circuit('B428_Buf', ({ width = 4 }: { width?: number } = {}) => ({
      inputs: { a: bus(width) },
      outputs: { o: bus(width) },
      eval: ({ a }) => ({ o: a }),
    }));
    Buf({ width: 4 });
    Buf({ width: 16 });
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when the editor reruns edited source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = (body: string) =>
      `const Edit = circuit('B428_Edit', { inputs: { a: bit }, outputs: { o: bit }, eval: ({ a }) => ({ o: ${body} }) });`;
    expect(executeJsCode(source('a')).error).toBeNull();
    expect(executeJsCode(source('a ? 0 : 1')).error).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('port direction is checked at build time (#428)', () => {
  it('rejects untyped code that reverses a connection, naming both ends', () => {
    const { error } = executeJsCode(`
      const Inv = circuit('B428_DirInv', {
        inputs: { a: bit }, outputs: { out: bit },
        eval: ({ a }) => ({ out: a ? 0 : 1 }),
      });
      const Top = circuit('B428_Dir', {
        inputs: { a: bit }, outputs: { o: bit },
        nodes: { n: Inv },
        connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.a), outputs.o.to(n.out)],
      });
    `);
    expect(error).toContain('Connection o -> n.out runs the wrong way');
    expect(error).toContain('circuit output `o` can only be driven');
    expect(error).toContain("output `out` of node 'n' (B428_DirInv) is a driver");
  });
});

describe('a bad connect return is a validation error (#428)', () => {
  const build = (ret: unknown) => () =>
    circuit('B428_BadConnect', {
      inputs: { a: bit },
      outputs: { o: bit },
      nodes: { n: Inv },
      connect: (() => ret) as never,
    });

  it('reports a non-array', () => {
    expect(build(undefined)).toThrow(
      /validation failed:\n {2}- connect must return an array of connections, got undefined/,
    );
  });

  it('reports a nested array', () => {
    expect(build([[]])).toThrow(/connect returned a nested array at index 0.*spread/);
  });

  it('reports an entry that is not a connection', () => {
    expect(build([null])).toThrow(/connect returned null at index 0, which is not a connection/);
    expect(build([{ source: 'a' }])).toThrow(/connect returned an object at index 0/);
  });
});

describe('fixed widths of untyped state (#428)', () => {
  // A plain number or Map does not say its width, so these defaults are fixed.
  // Pinned so a change to them is deliberate: use reg() and mem() for a width.
  it('a plain number is bus(32) and a Map is a 16/8-bit memory', () => {
    const S = circuit('B428_State', {
      outputs: { q: bus(8) },
      state: { n: 0, m: new Map<number, number>() },
      eval: ({ n }) => ({ q: n }),
      onTick: ({ n, m }) => ({ n, m }),
    });
    const [n, m] = S.circuit.state;
    expect(n.stateType).toEqual({ kind: 'bus', width: 32 });
    expect(m.stateType).toEqual({ kind: 'memory', addressWidth: 16, dataWidth: 8 });
  });
});

describe('differently built composites under one name (#428)', () => {
  const Chain = circuit('B428_Chain', ({ n = 1 }: { n?: number } = {}) => ({
    inputs: { a: bit },
    outputs: { out: bit },
    nodes: { g: Array.from({ length: n }, () => Inv) },
    connect: ({ inputs, outputs, nodes: { g } }) => [
      inputs.a.to(g[0].a),
      ...g.slice(1).map((x, i) => g[i].out.to(x.a)),
      g[g.length - 1].out.to(outputs.out),
    ],
  }));

  it('is an error, not a silent simulation of the first one', () => {
    expect(() =>
      circuit('B428_ChainTop', {
        inputs: { a: bit },
        outputs: { x: bit, y: bit },
        nodes: { one: Chain({ n: 1 }), two: Chain({ n: 2 }) },
        connect: ({ inputs, outputs, nodes: { one, two } }) => [
          inputs.a.to(one.a, two.a),
          one.out.to(outputs.x),
          two.out.to(outputs.y),
        ],
      }),
    ).toThrow(/Two different definitions of 'B428_Chain' are used here/);
  });

  it('allows the same specialisation twice', () => {
    const Top = circuit('B428_ChainSame', {
      inputs: { a: bit },
      outputs: { x: bit, y: bit },
      nodes: { one: Chain({ n: 2 }), two: Chain({ n: 2 }) },
      connect: ({ inputs, outputs, nodes: { one, two } }) => [
        inputs.a.to(one.a, two.a),
        one.out.to(outputs.x),
        two.out.to(outputs.y),
      ],
    });
    const sim = simulate(Top);
    sim.set({ a: 1 });
    expect([sim.get('x'), sim.get('y')]).toEqual([1, 1]);
  });

  it('allows primitives of different widths under one name', () => {
    expect(() =>
      circuit('B428_Regs', {
        inputs: { d: bus(16), we: bit },
        outputs: { q: bus(16) },
        nodes: { a: Register({ width: 8 }), b: Register({ width: 16 }) },
        connect: ({ inputs, outputs, nodes: { a, b } }) => [
          inputs.we.to(a.we, b.we),
          inputs.d.to(b.data),
          b.q.to(outputs.q),
        ],
      }),
    ).not.toThrow();
  });
});
