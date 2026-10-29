/**
 * The canvas draws a circuit's own ports (#531): a control on each input it
 * reads, an indicator on each output it drives, the circuit as `dut`, and the
 * session's values moved onto them.
 */

import { bit, bus, circuit, simulate } from '@simten/core';
import { internalsOf, nodesOf } from '@simten/core/internal';
import { And, Xor } from '@simten/core/std';
import { describe, expect, it } from 'vitest';
import { hasPorts, portsView, portsViewValues } from '../ports-view';

const HalfAdder = circuit('ViewHalfAdder', {
  inputs: { a: bit, b: bit, unused: bus(4) },
  outputs: { sum: bit, carry: bit },
  nodes: { x: Xor, n: And },
  connect: ({ inputs, outputs, nodes: { x, n } }) => [
    inputs.a.to(x.a, n.a),
    inputs.b.to(x.b, n.b),
    x.out.to(outputs.sum),
    n.out.to(outputs.carry),
  ],
});
const IR = internalsOf(HalfAdder).ir;

describe('portsView', () => {
  it('draws a switch per input it reads, the circuit as dut, a lamp per output', () => {
    const view = portsView(IR);
    expect(view.nodes.map((n) => [n.id, n.componentRef]).sort()).toEqual([
      ['a', 'Switch'],
      ['b', 'Switch'],
      ['carry', 'Led'],
      ['dut', 'ViewHalfAdder'],
      ['sum', 'Led'],
    ]);
    expect(
      view.connections.map(
        (c) => `${c.source.nodeId}.${c.source.portName}>${c.target.nodeId}.${c.target.portName}`,
      ),
    ).toEqual(['a.out>dut.a', 'b.out>dut.b', 'dut.sum>sum.in', 'dut.carry>carry.in']);
    expect(hasPorts(IR)).toBe(true);
  });

  it('moves the session values onto the drawing', () => {
    const sim = simulate(HalfAdder);
    sim.set({ a: 1, b: 1 });
    const view = portsViewValues(IR, nodesOf(sim).ports());
    expect(view.get('a.out')).toBe(1);
    expect(view.get('b.out')).toBe(1);
    expect(view.get('sum.in')).toBe(0);
    expect(view.get('carry.in')).toBe(1);
    // The insides, for the drill-down into `dut`.
    expect(view.get('dut.x.out')).toBe(0);
    expect(view.get('dut.n.out')).toBe(1);
  });
});
