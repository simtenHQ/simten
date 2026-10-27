/**
 * Pure wiring: muxes, slices, extensions, splitters and combiners, the 2-to-4
 * decoder, and constants. No state and at most a select.
 */

import { type Emitter, getWidth, ones, pins } from './helpers.js';

/**
 * Bit splitter and combiner register one primitive per width
 * (`Splitter_4w`), so they are matched by shape rather than by name.
 */
export function perWidthEmitter(primitiveType: string): Emitter | undefined {
  const bits = /^(Splitter|Combiner)_(\d+)w$/.exec(primitiveType);
  if (!bits) return undefined;
  const width = Number(bits[2]);
  return ({ wires }) => {
    const { i, o } = pins(wires);
    const lines =
      bits[1] === 'Splitter'
        ? Array.from(
            { length: width },
            (_, bit) => `assign ${o(`bit${bit}`)} = ${i('in')}[${bit}];`,
          )
        : [
            `assign ${o('out')} = {${Array.from({ length: width }, (_, bit) => i(`bit${width - 1 - bit}`)).join(', ')}};`,
          ];
    return { lines, declarations: [] };
  };
}

export const wiringEmitters: Readonly<Record<string, Emitter>> = {
  // ── Multiplexing ─────────────────────────────────────────────────
  Mux: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('out')} = ${i('sel')} ? ${i('in1')} : ${i('in0')};`],
      declarations: [],
    };
  },

  // ── Bit manipulation ─────────────────────────────────────────────
  BitSlice: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const low = typeof args.low === 'number' ? args.low : 0;
    const high = typeof args.high === 'number' ? args.high : 7;
    return { lines: [`assign ${o('out')} = ${i('in')}[${high}:${low}];`], declarations: [] };
  },
  Concat: ({ wires }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('out')} = {${i('high')}, ${i('low')}};`], declarations: [] };
  },
  // Width adaptation. Bus width validation rejects an implicit bus(M) -> bus(N)
  // connection, so designs state the intent with one of these instead — which
  // means both have to survive export. Each is pure wiring: zero-extension
  // pads with constant 0s, sign-extension replicates the top bit, and yosys
  // folds either into the net with no logic.
  ZeroExtend: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const inWidth = typeof args.inWidth === 'number' ? args.inWidth : 8;
    const outWidth = typeof args.outWidth === 'number' ? args.outWidth : 16;
    const pad = outWidth - inWidth;
    return {
      lines: [
        pad > 0
          ? `assign ${o('out')} = {${pad}'b0, ${i('in')}};`
          : `assign ${o('out')} = ${i('in')}[${outWidth - 1}:0];`,
      ],
      declarations: [],
    };
  },
  SignExtend: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const inWidth = typeof args.inWidth === 'number' ? args.inWidth : 8;
    const outWidth = typeof args.outWidth === 'number' ? args.outWidth : 16;
    const pad = outWidth - inWidth;
    return {
      lines: [
        pad > 0
          ? `assign ${o('out')} = {{${pad}{${i('in')}[${inWidth - 1}]}}, ${i('in')}};`
          : `assign ${o('out')} = ${i('in')}[${outWidth - 1}:0];`,
      ],
      declarations: [],
    };
  },
  // in[offset +: width], by shift and mask so the net's width doesn't matter.
  Slice: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const width = getWidth(args, 1);
    return {
      lines: [`assign ${o('out')} = (${i('in')} >> ${offset}) & ${ones(width)};`],
      declarations: [],
    };
  },
  // in[shift +: outWidth]; a shift past the input reads 0.
  DynamicSlice: ({ wires, args }) => {
    const { i, o } = pins(wires);
    const outWidth = typeof args.outWidth === 'number' ? args.outWidth : 1;
    return {
      lines: [`assign ${o('out')} = (${i('in')} >> ${i('shift')}) & ${ones(outWidth)};`],
      declarations: [],
    };
  },
  NibbleSplitter: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [`assign ${o('out0')} = ${i('in')}[3:0];`, `assign ${o('out1')} = ${i('in')}[7:4];`],
      declarations: [],
    };
  },
  Splitter8to8: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: Array.from(
        { length: 8 },
        (_, bit) => `assign ${o(`bit${bit}`)} = ${i('in')}[${bit}];`,
      ),
      declarations: [],
    };
  },
  Combiner8to8: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [
        `assign ${o('out')} = {${Array.from({ length: 8 }, (_, bit) => i(`bit${7 - bit}`)).join(', ')}};`,
      ],
      declarations: [],
    };
  },
  AddressCombiner: ({ wires }) => {
    const { i, o } = pins(wires);
    return { lines: [`assign ${o('out')} = {${i('hi')}, ${i('lo')}};`], declarations: [] };
  },

  // ── Decoder ──────────────────────────────────────────────────────
  Decoder: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: [
        `assign ${o('out0')} = (${i('in')} == 2'd0);`,
        `assign ${o('out1')} = (${i('in')} == 2'd1);`,
        `assign ${o('out2')} = (${i('in')} == 2'd2);`,
        `assign ${o('out3')} = (${i('in')} == 2'd3);`,
      ],
      declarations: [],
    };
  },

  // ── Constants ────────────────────────────────────────────────────
  Constant: ({ wires, args }) => {
    const { o } = pins(wires);
    const w = getWidth(args);
    const value = typeof args.value === 'number' ? args.value : 0;
    if (w <= 1) {
      return { lines: [`assign ${o('out')} = 1'b${value ? 1 : 0};`], declarations: [] };
    }
    return { lines: [`assign ${o('out')} = ${w}'d${value};`], declarations: [] };
  },
};
