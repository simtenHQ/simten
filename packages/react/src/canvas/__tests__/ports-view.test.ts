/**
 * The canvas draws a circuit's own ports (#531): a control on each input it
 * reads, an indicator on each output it drives, the circuit as one box, and
 * each of them reading the session's values as the session keys them.
 */

import { bit, bus, circuit, simulate } from '@simten/core';
import { internalsOf, nodesOf } from '@simten/core/internal';
import { And, Xor } from '@simten/core/std';
import { describe, expect, it } from 'vitest';
import { projectCircuit } from '../circuit-to-flow';
import { hasPorts, portsView, withPortParts } from '../ports-view';

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
const definitions = withPortParts({
  resolveCircuit: (name) => (name === IR.name ? IR : undefined),
  getAllPrimitiveNames: () => [],
});

describe('portsView', () => {
  it('draws a switch per input it reads, the circuit as one box, a lamp per output', () => {
    const view = portsView(IR);
    expect(view.nodes.map((n) => [n.id, n.componentRef, n.port]).sort()).toEqual([
      ['a', 'Switch', 'a'],
      ['b', 'Switch', 'b'],
      ['carry', 'Led', 'carry'],
      ['circuit', 'ViewHalfAdder', undefined],
      ['sum', 'Led', 'sum'],
    ]);
    expect(
      view.connections.map(
        (c) => `${c.source.nodeId}.${c.source.portName}>${c.target.nodeId}.${c.target.portName}`,
      ),
    ).toEqual([
      'a.out>circuit.a',
      'b.out>circuit.b',
      'circuit.sum>sum.in',
      'circuit.carry>carry.in',
    ]);
    expect(hasPorts(IR)).toBe(true);
  });

  it('labels the box with the circuit name and makes it the top level', () => {
    const box = portsView(IR).nodes.find((n) => n.id === 'circuit');
    expect(box?.label).toBe('ViewHalfAdder');
    expect(box?.path).toBe('');
  });

  it("reads each port's value from the session as the session keys it", () => {
    const sim = simulate(HalfAdder);
    sim.set({ a: 1, b: 1 });
    const ports = nodesOf(sim).ports();

    const view = portsView(IR);
    const positions = Object.fromEntries(view.nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    const { nodes, edges } = projectCircuit(view, positions, definitions);
    const readPort = (id: string) => {
      const key = nodes.find((n) => n.id === id)?.data.valueKey;
      return key === undefined ? undefined : ports.get(key);
    };
    expect([readPort('a'), readPort('b'), readPort('sum'), readPort('carry')]).toEqual([
      1, 1, 0, 1,
    ]);
    expect(nodes.find((n) => n.id === 'a')?.data.valueKey).toBe('__top__.a');
    // Every wire is on one of the circuit's own ports.
    expect(edges.map((e) => e.data?.keys[0])).toEqual([
      '__top__.a',
      '__top__.b',
      '__top__.sum',
      '__top__.carry',
    ]);
    // A port's switch is set by the port's name.
    expect(nodes.find((n) => n.id === 'a')?.data.path).toBe('a');
  });
});
