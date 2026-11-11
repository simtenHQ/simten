import { bus, circuit } from '@simten/core';
import { createDefinitions, internalsOf } from '@simten/core/internal';
import { Console, PaletteDisplay } from '@simten/core/std';
import { describe, expect, it } from 'vitest';
import { nodeAt, sideParts } from '../side-parts';

// A display and a console, nested one level down, as the NES example's
// screen sits inside the NesDemo box.
const Inner = circuit('SideInner', {
  inputs: { x: bus(6), y: bus(5), c: bus(6), d: bus(8) },
  nodes: { tv: PaletteDisplay({ width: 64, height: 32 }), log: Console },
  connect: ({ inputs, nodes: { tv, log } }) => [
    inputs.x.to(tv.x),
    inputs.y.to(tv.y),
    inputs.c.to(tv.color),
    inputs.d.to(log.data),
  ],
});
const Outer = circuit('SideOuter', {
  inputs: { x: bus(6), y: bus(5), c: bus(6), d: bus(8) },
  nodes: { box: Inner },
  connect: ({ inputs, nodes: { box } }) => [
    inputs.x.to(box.x),
    inputs.y.to(box.y),
    inputs.c.to(box.c),
    inputs.d.to(box.d),
  ],
});

const ir = (c: Parameters<typeof internalsOf>[0]) => internalsOf(c).ir;
const definitions = createDefinitions(
  [Outer, ...internalsOf(Outer).dependencies.values()].map((c) => ir(c)),
);

describe('side parts', () => {
  it('finds a nested node by its path', () => {
    expect(nodeAt(ir(Outer), definitions, 'box.tv')?.componentRef).toBe('PaletteDisplay');
    expect(nodeAt(ir(Outer), definitions, 'box.log')?.componentRef).toBe('Console');
    expect(nodeAt(ir(Outer), definitions, 'box.nope')).toBeUndefined();
  });

  // Both peripherals' state is text: a display's pixels used to be taken for
  // a console's.
  it('draws a nested display as a display and a console as a console', () => {
    const peripherals = new Map([
      ['box.tv', 'pixels'],
      ['box.log', 'hello'],
    ]);
    const parts = sideParts(peripherals, new Set(), ir(Outer), definitions);
    expect(parts.map((p) => [p.path, p.kind])).toEqual([
      ['box.tv', 'PaletteDisplay'],
      ['box.log', 'Console'],
    ]);
    expect(parts[0].arguments).toMatchObject({ width: 64, height: 32 });
  });

  it('leaves out what the canvas already draws, and keeps unresolved text as a console', () => {
    const peripherals = new Map([
      ['box.tv', 'pixels'],
      ['gone.uart', 'text'],
    ]);
    const parts = sideParts(peripherals, new Set(['box.tv']), ir(Outer), definitions);
    expect(parts).toEqual([{ path: 'gone.uart', kind: 'UART_TX' }]);
  });
});
