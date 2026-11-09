/**
 * A factory's eval or onTick that reads a variable from the factory (#118).
 * Every instance of a factory shares one behavior, so the variable held one
 * instance's value for all of them: `AddK({ k: 1 })` and `AddK({ k: 100 })`
 * both added 1. Instances that disagree on such a variable are now an error.
 */

import { describe, expect, it } from 'vitest';
import * as rtl from '../../import/primitives.js';
import type { PortType } from '../../ir/circuit-ir.js';
import { simulate } from '../../simulator/simulate.js';
import * as std from '../../std/index.js';
import type { Circuit } from '../builder-types.js';
import { capturedFactoryVariables } from '../captured-options.js';
import { bit, bus, circuit } from '../index.js';
import { internalsOf, isCircuit } from '../internals.js';

/** A circuit with input `a` and output `y`, the shape every test circuit here has. */
type AToY = Circuit<{ a: PortType }, { y: PortType }>;
type Factory = (opts?: { k?: number }) => AToY;

/** Two nodes side by side with a = 5 into both; returns their outputs. */
function sideBySide(p: AToY, q: AToY): [number, number] {
  const Top = circuit('SideBySide', {
    inputs: { a: bus(8) },
    outputs: { y1: bus(8), y2: bus(8) },
    nodes: { p, q },
    connect: ({ inputs, outputs, nodes }) => [
      inputs.a.to(nodes.p.a, nodes.q.a),
      nodes.p.y.to(outputs.y1),
      nodes.q.y.to(outputs.y2),
    ],
  });
  const sim = simulate(Top);
  sim.set({ a: 5 });
  return [sim.get('y1'), sim.get('y2')];
}

const CapturingAddK: Factory = circuit('AddK', ({ k = 0 }: { k?: number } = {}) => ({
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => ({ y: (a as number) + k }),
}));

describe('factory variables read by eval or onTick', () => {
  it('rejects two instances that differ in an option the eval captures, naming it', () => {
    const build = () => sideBySide(CapturingAddK({ k: 1 }), CapturingAddK({ k: 100 }));
    expect(build).toThrow(/Instances of 'AddK' differ in 'k', but its eval reads 'k'/);
    expect(build).toThrow(/Destructure 'k' from the eval's argument instead/);
  });

  it('compares a renamed option by its option name', () => {
    const Shift = circuit('Shift', ({ by: n = 0 }: { by?: number } = {}) => ({
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a }) => ({ y: ((a as number) << n) & 0xff }),
    }));
    expect(() => sideBySide(Shift({ by: 1 }), Shift({ by: 2 }))).toThrow(
      /differ in 'by', but its eval reads 'n'/,
    );
  });

  it('rejects a default instance next to one that sets the option', () => {
    expect(() => sideBySide(CapturingAddK(), CapturingAddK({ k: 5 }))).toThrow(/differ in 'k'/);
  });

  it('rejects instances that disagree one level down', () => {
    const Wrap = (k: number) =>
      circuit(`Wrap${k}`, {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        nodes: { inner: CapturingAddK({ k }) },
        connect: ({ inputs, outputs, nodes: { inner } }) => [
          inputs.a.to(inner.a),
          inner.y.to(outputs.y),
        ],
      });
    expect(() => sideBySide(Wrap(1), Wrap(2))).toThrow(/Instances of 'AddK' differ in 'k'/);
  });

  it('keeps a captured option that every instance agrees on', () => {
    expect(sideBySide(CapturingAddK({ k: 3 }), CapturingAddK({ k: 3 }))).toEqual([8, 8]);
  });

  it('gives each instance its own option when the eval destructures it', () => {
    const AddK: Factory = circuit('AddK', (_opts: { k?: number } = {}) => ({
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a, k = 0 }) => ({ y: (a as number) + (k as number) }),
    }));
    expect(sideBySide(AddK({ k: 1 }), AddK({ k: 100 }))).toEqual([6, 105]);
  });

  it('rejects a variable the factory computes, once instances differ in any option', () => {
    const Masked = circuit('Masked', ({ width = 8 }: { width?: number } = {}) => {
      const mask = (1 << width) - 1;
      return {
        inputs: { a: bus(8) },
        outputs: { y: bus(8) },
        eval: ({ a }) => ({ y: (a as number) & mask }),
      };
    });
    expect(() => sideBySide(Masked({ width: 2 }), Masked({ width: 4 }))).toThrow(
      /reads 'mask', a variable declared in the factory/,
    );
  });

  it('rejects an onTick that reads the whole options object', () => {
    const Load = circuit('Load', (opts: { k?: number } = {}) => ({
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      state: { s: 0 },
      eval: ({ s }) => ({ y: s as number }),
      onTick: () => ({ s: opts.k ?? 0 }),
    }));
    expect(() => sideBySide(Load({ k: 1 }), Load({ k: 2 }))).toThrow(
      /its onTick reads 'opts' from the factory/,
    );
  });

  it('does not count module-scope helpers, shadowed names or property keys', () => {
    const behavior =
      '({ a, width: w = 8 }) => { const pick = (width) => ({ width }).width; ' +
      'return { y: a & maskOf(pick(w)), n: w.width }; }';
    const factory = `({ width = 8 }) => { const mask = 1; return { eval: ${behavior} }; }`;
    expect(capturedFactoryVariables(factory, behavior)).toEqual([]);
    // The same eval written outside the factory can't see its variables at all.
    expect(capturedFactoryVariables('({ k }) => ({})', '({ a }) => ({ y: a + k })')).toEqual([]);
  });

  it('reads method shorthand and default values', () => {
    const factory = '({ k = 0 }) => ({ eval({ a, b = k }) { return { y: a + b }; } })';
    const behavior = 'eval({ a, b = k }) { return { y: a + b }; }';
    expect(capturedFactoryVariables(factory, behavior)).toEqual([
      { name: 'k', binding: 'option', option: 'k' },
    ]);
  });

  it('finds no captured variables in std or the RTL import primitives', () => {
    const offenders: string[] = [];
    for (const [name, value] of [...Object.entries(std), ...Object.entries(rtl)]) {
      if (typeof value !== 'function') continue;
      let built: unknown;
      try {
        built = (value as () => unknown)();
      } catch {
        continue; // needs options (Pmux, Mem, romFrom*), not a circuit() factory
      }
      if (!isCircuit(built)) continue;
      for (const c of internalsOf(built).captured ?? []) {
        offenders.push(`${name}: ${c.behavior} reads '${c.name}'`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('runs two UART_RX instances at their own bit rates', () => {
    // UART_RX read its bit period from the factory, so the second instance
    // sampled at the first one's rate.
    const send = (cycles: number) => {
      const bits = [0, 0, 1, 0, 1, 0, 0, 0, 1, 1]; // start, 0x8A LSB first, stop
      return bits.flatMap((b) => Array<number>(cycles).fill(b));
    };
    const Top = circuit('TwoUarts', {
      inputs: { slow: bit, fast: bit },
      outputs: { slowData: bus(8), fastData: bus(8) },
      nodes: { s: std.UART_RX({ cyclesPerBit: 8 }), f: std.UART_RX({ cyclesPerBit: 4 }) },
      connect: ({ inputs, outputs, nodes: { s, f } }) => [
        inputs.slow.to(s.rx),
        inputs.fast.to(f.rx),
        s.data.to(outputs.slowData),
        f.data.to(outputs.fastData),
      ],
    });
    const sim = simulate(Top);
    const slow = [1, 1, ...send(8), 1, 1, 1, 1];
    const fast = [1, 1, ...send(4)];
    for (let i = 0; i < slow.length; i++) {
      sim.set({ slow: slow[i], fast: fast[i] ?? 1 });
      sim.tick();
    }
    expect(sim.get('fastData')).toBe(0x8a);
    expect(sim.get('slowData')).toBe(0x8a);
  });
});
