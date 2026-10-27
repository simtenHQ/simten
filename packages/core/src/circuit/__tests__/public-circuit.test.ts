/**
 * A built circuit shows its name and ports and nothing else (#480). Its IR,
 * dependencies, options and behavior are internals, read with `internalsOf`.
 */

import { describe, expect, it } from 'vitest';
import { simulate } from '../../simulator/simulate.js';
import { Register, Xor } from '../../std/index.js';
import { bit, bus } from '../bit-bus.js';
import { circuit } from '../circuit.js';
import { internalsOf } from '../internals.js';

const Parity = circuit('Parity', {
  inputs: { a: bit, b: bit, d: bus(4) },
  outputs: { odd: bit, d_out: bus(4) },
  nodes: { x: Xor },
  connect: ({ inputs, outputs, nodes: { x } }) => [
    inputs.a.to(x.a),
    inputs.b.to(x.b),
    x.out.to(outputs.odd),
    inputs.d.to(outputs.d_out),
  ],
});

describe('a built circuit', () => {
  it('has exactly a name, inputs and outputs', () => {
    expect(Object.keys(Parity)).toEqual(['name', 'inputs', 'outputs']);
    expect(Parity.name).toBe('Parity');
    expect(Parity.inputs).toEqual({ a: bit, b: bit, d: bus(4) });
    expect(Parity.outputs).toEqual({ odd: bit, d_out: bus(4) });
  });

  it('is frozen, ports included', () => {
    expect(Object.isFrozen(Parity)).toBe(true);
    expect(Object.isFrozen(Parity.inputs)).toBe(true);
    expect(Object.isFrozen(Parity.inputs.d)).toBe(true);
    expect(() => {
      (Parity as { name: string }).name = 'Other';
    }).toThrow(TypeError);
  });

  it('keeps its IR, dependencies and options internal', () => {
    const reg = Register({ width: 16 });
    const { ir, dependencies, args } = internalsOf(reg);
    expect(ir.name).toBe('Register');
    expect(dependencies.size).toBe(0);
    expect(args).toEqual({ width: 16 });
    expect(internalsOf(Parity).dependencies.has('Xor')).toBe(true);
  });

  it("is a factory's result, not the factory", () => {
    expect(typeof Register).toBe('function');
    expect(Register().name).toBe('Register');
  });
});

describe('internalsOf', () => {
  it("throws for an object circuit() didn't make", () => {
    const lookalike = { name: 'Fake', inputs: {}, outputs: {} };
    expect(() => internalsOf(lookalike)).toThrow("'Fake' wasn't made by circuit()");
  });
});

describe('snapshot and restore', () => {
  it('round-trips through the opaque Snapshot', () => {
    const Counter = circuit('SnapCounter', {
      outputs: { q: bus(8) },
      state: { count: 0 },
      eval: ({ count }) => ({ q: count }),
      onTick: ({ count }) => ({ count: (count + 1) & 0xff }),
    });
    const sim = simulate(Counter);
    sim.tickN(3);
    const snap = sim.snapshot();
    sim.tickN(5);
    expect(sim.get('q')).toBe(8);
    sim.restore(snap);
    expect(sim.get('q')).toBe(3);
    sim.tick();
    expect(sim.get('q')).toBe(4);
  });
});
