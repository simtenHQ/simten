/**
 * Wire colour across a composite boundary.
 *
 * Edges are projected from the unelaborated circuit, where a composite is one
 * node with ports. `portValues` comes from the flattened netlist, where that
 * boundary no longer exists — a `HalfAdder` named `h1` contributes `h1.x1.out`
 * and `h1.a1.out`, and never `h1.carry`.
 *
 * So a wire running from one composite into another had neither endpoint in the
 * map and drew as undefined, while the simulation was carrying a 1 along it.
 * Wires touching a primitive escaped, because that side resolved — which is why
 * only *some* composite wires looked dead, and why this needs a case with a
 * composite at BOTH ends to be a real regression test.
 */

import type { Circuit } from '@simten/core';
import type { FlatPortValueMap } from '@simten/core/simulator';
import { describe, expect, it } from 'vitest';
import { projectCircuitToReactFlow } from '../projection';

const TRUE = '#22c55e';
const UNDEFINED = '#cbd5e1';

const halfAdder: Circuit = {
  name: 'HalfAdder',
  inputs: [
    { name: 'a', portType: { kind: 'bit' } },
    { name: 'b', portType: { kind: 'bit' } },
  ],
  outputs: [
    { name: 'sum', portType: { kind: 'bit' } },
    { name: 'carry', portType: { kind: 'bit' } },
  ],
  nodes: [
    {
      id: 'x1',
      label: 'x1',
      componentRef: 'Xor',
      arguments: {},
      inputs: [
        { id: 'x1_a', name: 'a', portType: { kind: 'bit' } },
        { id: 'x1_b', name: 'b', portType: { kind: 'bit' } },
      ],
      outputs: [{ id: 'x1_out', name: 'out', portType: { kind: 'bit' } }],
    },
    {
      id: 'a1',
      label: 'a1',
      componentRef: 'And',
      arguments: {},
      inputs: [
        { id: 'a1_a', name: 'a', portType: { kind: 'bit' } },
        { id: 'a1_b', name: 'b', portType: { kind: 'bit' } },
      ],
      outputs: [{ id: 'a1_out', name: 'out', portType: { kind: 'bit' } }],
    },
  ],
  connections: [
    {
      id: 'c1',
      source: { nodeId: '', portName: 'a' },
      target: { nodeId: 'a1', portName: 'a' },
      portType: { kind: 'bit' },
    },
    {
      id: 'c2',
      source: { nodeId: 'a1', portName: 'out' },
      target: { nodeId: '', portName: 'carry' },
      portType: { kind: 'bit' },
    },
  ],
  implementation: { kind: 'composite' },
} as unknown as Circuit;

/** Two half adders wired carry → a. Both endpoints are composite boundaries. */
const top: Circuit = {
  name: 'Top',
  inputs: [],
  outputs: [],
  nodes: [
    {
      id: 'h1',
      label: 'h1',
      componentRef: 'HalfAdder',
      arguments: {},
      inputs: [{ id: 'h1_a', name: 'a', portType: { kind: 'bit' } }],
      outputs: [{ id: 'h1_carry', name: 'carry', portType: { kind: 'bit' } }],
    },
    {
      id: 'h2',
      label: 'h2',
      componentRef: 'HalfAdder',
      arguments: {},
      inputs: [{ id: 'h2_a', name: 'a', portType: { kind: 'bit' } }],
      outputs: [{ id: 'h2_carry', name: 'carry', portType: { kind: 'bit' } }],
    },
  ],
  connections: [
    {
      id: 'w1',
      source: { nodeId: 'h1', portName: 'carry' },
      target: { nodeId: 'h2', portName: 'a' },
      portType: { kind: 'bit' },
    },
  ],
  implementation: { kind: 'composite' },
} as unknown as Circuit;

const library = {
  resolveCircuit: (name: string) =>
    name === 'HalfAdder' ? halfAdder : ({ implementation: { kind: 'primitive' } } as Circuit),
  getAllPrimitiveNames: () => ['Xor', 'And'],
};

const metadata = {
  components: { h1: { position: { x: 0, y: 0 } }, h2: { position: { x: 200, y: 0 } } },
} as never;

describe('a wire between two composites', () => {
  it('is green when the flattened net behind it carries a 1', () => {
    // Only the internal net exists — exactly what the simulator produces.
    const portValues: FlatPortValueMap = new Map([['h1.a1.out', 1]]);

    const { edges } = projectCircuitToReactFlow(top, metadata, library, portValues);
    expect(edges).toHaveLength(1);
    expect(edges[0].style?.stroke).toBe(TRUE);
  });

  it('stays undefined when nothing behind it has a value', () => {
    const { edges } = projectCircuitToReactFlow(top, metadata, library, new Map());
    expect(edges[0].style?.stroke).toBe(UNDEFINED);
  });

  it('reaches through nested composites to the primitive underneath', () => {
    // Top -> Mid -> Inner -> And. The simulator flattens this to `m1.i1.g.out`
    // (verified against a real elaboration), so nothing along the way exists as
    // a key and the resolver has to descend twice.
    const port = (name: string) => ({ name, portType: { kind: 'bit' } });
    const node = (id: string, componentRef: string, ins: string[], outs: string[]) => ({
      id,
      label: id,
      componentRef,
      arguments: {},
      inputs: ins.map((n) => ({ id: `${id}_${n}`, ...port(n) })),
      outputs: outs.map((n) => ({ id: `${id}_${n}`, ...port(n) })),
    });
    const wire = (id: string, s: [string, string], t: [string, string]) => ({
      id,
      source: { nodeId: s[0], portName: s[1] },
      target: { nodeId: t[0], portName: t[1] },
      portType: { kind: 'bit' },
    });

    const inner = {
      name: 'Inner',
      inputs: [port('a')],
      outputs: [port('out')],
      nodes: [node('g', 'And', ['a'], ['out'])],
      connections: [wire('i1w', ['g', 'out'], ['', 'out'])],
      implementation: { kind: 'composite' },
    } as unknown as Circuit;

    const mid = {
      name: 'Mid',
      inputs: [port('a')],
      outputs: [port('out')],
      nodes: [node('i1', 'Inner', ['a'], ['out'])],
      connections: [wire('m1w', ['i1', 'out'], ['', 'out'])],
      implementation: { kind: 'composite' },
    } as unknown as Circuit;

    const nestedTop = {
      name: 'Top',
      inputs: [],
      outputs: [],
      nodes: [node('m1', 'Mid', ['a'], ['out']), node('m2', 'Mid', ['a'], ['out'])],
      connections: [wire('w', ['m1', 'out'], ['m2', 'a'])],
      implementation: { kind: 'composite' },
    } as unknown as Circuit;

    const nestedLibrary = {
      resolveCircuit: (name: string) =>
        name === 'Mid'
          ? mid
          : name === 'Inner'
            ? inner
            : ({ implementation: { kind: 'primitive' } } as Circuit),
      getAllPrimitiveNames: () => ['And'],
    };

    const { edges } = projectCircuitToReactFlow(
      nestedTop,
      metadata,
      nestedLibrary,
      new Map([['m1.i1.g.out', 1]]),
    );
    expect(edges[0].style?.stroke).toBe(TRUE);
  });

  it('does not hang on a circuit whose ports feed back on themselves', () => {
    const looped = {
      ...halfAdder,
      connections: [
        {
          id: 'loop',
          source: { nodeId: '', portName: 'carry' },
          target: { nodeId: '', portName: 'carry' },
          portType: { kind: 'bit' },
        },
      ],
    } as unknown as Circuit;

    const loopLibrary = { ...library, resolveCircuit: () => looped };
    expect(() => projectCircuitToReactFlow(top, metadata, loopLibrary, new Map())).not.toThrow();
  });
});
