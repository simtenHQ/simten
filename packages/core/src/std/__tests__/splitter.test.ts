/**
 * Splitter and Combiner: the general bit splitter and its inverse.
 *
 * Their port set changes with `width`, so each width registers as its own
 * primitive. The mixed-width case is the one that matters: two widths in one
 * circuit must not share an evaluator.
 */
import { describe, expect, it } from 'vitest';
import { circuitToSource } from '../../circuit/circuit-to-source.js';
import { bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../simulator/simulate.js';
import { emitPrimitive } from '../../verilog/primitive-map.js';
import { Combiner, Splitter } from '../routing.js';

// Splits a 4-bit and an 8-bit value, reverses the 4-bit one's bits and swaps
// the 8-bit one's nibbles, then combines both again.
const Mixed = circuit('MixedWidths', {
  inputs: { small: bus(4), big: bus(8) },
  outputs: { smallOut: bus(4), bigOut: bus(8) },
  nodes: {
    s4: Splitter({ width: 4 }),
    c4: Combiner({ width: 4 }),
    s8: Splitter({ width: 8 }),
    c8: Combiner({ width: 8 }),
  },
  connect: ({ inputs, outputs, nodes: { s4, c4, s8, c8 } }) => [
    inputs.small.to(s4.in),
    s4.bit0.to(c4.bit3),
    s4.bit1.to(c4.bit2),
    s4.bit2.to(c4.bit1),
    s4.bit3.to(c4.bit0),
    c4.out.to(outputs.smallOut),
    inputs.big.to(s8.in),
    s8.bit0.to(c8.bit4),
    s8.bit1.to(c8.bit5),
    s8.bit2.to(c8.bit6),
    s8.bit3.to(c8.bit7),
    s8.bit4.to(c8.bit0),
    s8.bit5.to(c8.bit1),
    s8.bit6.to(c8.bit2),
    s8.bit7.to(c8.bit3),
    c8.out.to(outputs.bigOut),
  ],
});

const reverse4 = (v: number) => ((v & 1) << 3) | ((v & 2) << 1) | ((v & 4) >> 1) | ((v & 8) >> 3);

describe('Splitter and Combiner', () => {
  it('registers one primitive per width', () => {
    expect(Splitter({ width: 4 }).circuit.name).toBe('Splitter_4w');
    expect(Combiner({ width: 8 }).circuit.name).toBe('Combiner_8w');
    expect(Object.keys(Splitter({ width: 4 }).circuit.outputs ?? {})).toHaveLength(4);
  });

  it('splits and recombines every value, at two widths in one circuit', () => {
    const sim = simulate(Mixed);
    for (let v = 0; v < 16; v++) {
      const big = v * 17 + 3;
      sim.set({ small: v, big: big & 0xff });
      expect(sim.get('smallOut')).toBe(reverse4(v));
      expect(sim.get('bigOut')).toBe((((big & 0xf) << 4) | ((big >> 4) & 0xf)) & 0xff);
    }
    sim.dispose();
  });

  it('exports to Verilog as plain wiring', () => {
    const wires = {
      inputs: new Map([['in', 'x']]),
      outputs: new Map([
        ['bit0', 'b0'],
        ['bit3', 'b3'],
      ]),
    };
    const split = emitPrimitive({
      behaviors: new Map(),
      nodeId: 's',
      primitiveType: 'Splitter_4w',
      args: { width: 4 },
      wires,
      clockName: 'clk',
      resetName: 'rst_n',
      target: 'simulation',
    });
    expect(split.lines).toContain('assign b0 = x[0];');
    expect(split.lines).toContain('assign b3 = x[3];');
  });

  // Type-level: these only need to compile. Each `@ts-expect-error` line must
  // be rejected, so a port that doesn't exist at this width is an editor error,
  // and the real ones are concrete keys the editor can autocomplete.
  it('types exactly the ports its width has', () => {
    const s4 = Splitter({ width: 4 });
    const c4 = Combiner({ width: 4 });
    const s8 = Splitter();
    const ok: (keyof typeof s4.outputs)[] = ['bit0', 'bit1', 'bit2', 'bit3'];
    // @ts-expect-error a 4-bit Splitter has no bit4
    const s4Bad: keyof typeof s4.outputs = 'bit4';
    // @ts-expect-error a 4-bit Combiner has no bit4
    const c4Bad: keyof typeof c4.inputs = 'bit4';
    // No width means 8 bits.
    const s8Last: keyof typeof s8.outputs = 'bit7';
    // @ts-expect-error the default 8-bit Splitter has no bit8
    const s8Bad: keyof typeof s8.outputs = 'bit8';

    const Typed = circuit('SplitterTypes', {
      inputs: { x: bus(4) },
      outputs: { y: bus(4) },
      nodes: { s: Splitter({ width: 4 }), c: Combiner({ width: 4 }) },
      connect: ({ inputs, outputs, nodes: { s, c } }) => [
        inputs.x.to(s.in),
        s.bit0.to(c.bit0),
        s.bit1.to(c.bit1),
        s.bit2.to(c.bit2),
        s.bit3.to(c.bit3),
        c.out.to(outputs.y),
      ],
    });
    // The port really isn't there, so this one also fails when it runs.
    expect(() =>
      circuit('SplitterTypesBad', {
        inputs: { x: bus(4) },
        nodes: { s: Splitter({ width: 4 }), c: Combiner({ width: 4 }) },
        connect: ({ inputs, nodes: { s, c } }) => [
          inputs.x.to(s.in),
          // @ts-expect-error a 4-bit Splitter has no bit4 to read from
          s.bit4.to(c.bit0),
        ],
      }),
    ).toThrow();
    expect([ok, s4Bad, c4Bad, s8Last, s8Bad, Typed.circuit.name]).toBeDefined();
  });

  it('accepts any bitN when the width is not a literal', () => {
    const width: number = 6;
    const s = Splitter({ width });
    // Not knowable at compile time, so the type can't be narrower.
    const key: keyof typeof s.outputs = 'bit5';
    expect(key).toBe('bit5');
  });

  it('writes back to source as the factory call', () => {
    const source = circuitToSource(Mixed);
    expect(source).toContain('Splitter({ width: 4 })');
    expect(source).toContain('Combiner({ width: 8 })');
    expect(source).not.toContain('Splitter_4w');
  });
});
