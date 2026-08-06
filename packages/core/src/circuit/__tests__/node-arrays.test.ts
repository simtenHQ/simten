/**
 * Array-valued `nodes`.
 *
 * `{ n: [Nand, Nand] }` is sugar for `{ n0: Nand, n1: Nand }` — expanded inside
 * `circuit()` so that nothing downstream (elaboration, the simulator, the
 * Verilog exporter) ever sees an array. The first test is the one that matters:
 * it pins that equivalence structurally, so the sugar can never drift into
 * meaning something subtly different from what it claims to abbreviate.
 */

import { describe, expect, it } from 'vitest';
import { Led, Nand, Switch } from '../../std/index.js';
import { circuit } from '../circuit.js';

const BITS = [0, 1, 2, 3];

const Longhand = circuit('ByteNotLonghand', {
  nodes: {
    a0: Switch,
    a1: Switch,
    n0: Nand,
    n1: Nand,
    out0: Led,
    out1: Led,
  },
  connect: ({ nodes: { a0, a1, n0, n1, out0, out1 } }) => [
    a0.out.to(n0.a, n0.b),
    a1.out.to(n1.a, n1.b),
    n0.out.to(out0.in),
    n1.out.to(out1.in),
  ],
});

const WithArrays = circuit('ByteNotLonghand', {
  nodes: {
    a: Array.from({ length: 2 }, () => Switch),
    n: Array.from({ length: 2 }, () => Nand),
    out: Array.from({ length: 2 }, () => Led),
  },
  connect: ({ nodes: { a, n, out } }) =>
    a.flatMap((sw, i) => [sw.out.to(n[i].a, n[i].b), n[i].out.to(out[i].in)]),
});

describe('an array entry is exactly its longhand', () => {
  it('produces the same node ids and component references', () => {
    const ids = (c: typeof Longhand) =>
      c.circuit.nodes.map((n) => `${n.id}:${n.componentRef}`).sort();
    expect(ids(WithArrays)).toEqual(ids(Longhand));
  });

  it('produces the same connections', () => {
    // The IR flattens `.to(a, b)` into one Connection per target, so this
    // compares source→target pairs rather than fan-out groups.
    const wires = (c: typeof Longhand) =>
      c.circuit.connections
        .map(
          (conn) =>
            `${conn.source.nodeId}.${conn.source.portName}->${conn.target.nodeId}.${conn.target.portName}`,
        )
        .sort();
    expect(wires(WithArrays)).toEqual(wires(Longhand));
  });

  it('carries the same dependencies', () => {
    expect([...WithArrays._dependencies.keys()].sort()).toEqual(
      [...Longhand._dependencies.keys()].sort(),
    );
  });
});

describe('expansion rules', () => {
  it('numbers entries from zero', () => {
    const c = circuit('Numbered', { nodes: { g: Array.from({ length: 3 }, () => Nand) } });
    expect(c.circuit.nodes.map((n) => n.id)).toEqual(['g0', 'g1', 'g2']);
  });

  it('accepts an empty array as no nodes at all', () => {
    const c = circuit('Empty', { nodes: { g: [] as (typeof Nand)[] } });
    expect(c.circuit.nodes).toHaveLength(0);
  });

  it('mixes arrays and plain entries', () => {
    const c = circuit('Mixed', {
      nodes: { single: Switch, g: Array.from({ length: 2 }, () => Nand) },
      connect: ({ nodes: { single, g } }) => [single.out.to(g[0].a, g[0].b, g[1].a, g[1].b)],
    });
    expect(c.circuit.nodes.map((n) => n.id).sort()).toEqual(['g0', 'g1', 'single']);
  });

  it('rejects an expanded id that collides with a hand-written one', () => {
    expect(() =>
      circuit('Collide', {
        nodes: { g0: Switch, g: Array.from({ length: 2 }, () => Nand) },
      }),
    ).toThrow(/declared twice/);
  });

  it('still rejects a reserved name, checked on the declared key', () => {
    expect(() =>
      circuit('Reserved', { nodes: { inputs: Array.from({ length: 2 }, () => Nand) } }),
    ).toThrow(/reserved/);
  });
});

describe('BITS-style authoring', () => {
  it('scales to a width without touching the wiring', () => {
    const ByteNot = circuit('ByteNot', {
      nodes: {
        a: BITS.map(() => Switch),
        n: BITS.map(() => Nand),
        out: BITS.map(() => Led),
      },
      connect: ({ nodes: { a, n, out } }) =>
        a.flatMap((sw, i) => [sw.out.to(n[i].a, n[i].b), n[i].out.to(out[i].in)]),
    });
    expect(ByteNot.circuit.nodes).toHaveLength(BITS.length * 3);
    // Three wires per bit once fan-out is flattened: switch→n.a, switch→n.b,
    // n.out→lamp.
    expect(ByteNot.circuit.connections).toHaveLength(BITS.length * 3);
  });
});
