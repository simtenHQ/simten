/**
 * The figlet demo circuit, and the source string rendered beside it.
 *
 * An npm package's output baked into a hardware ROM at build time, streamed
 * out one byte at a time by a Console primitive. Your dependency is now a ROM.
 *
 * The circuit and the source string have to stay in step, which is the only
 * reason they live in one file. Extracted from the old Hero component, whose
 * demo picker was deleted along with it.
 */

import { bit, bus, circuit } from '@simten/core/circuit';
import {
  Adder,
  Console as ConsolePrimitive,
  Constant,
  Register,
  ROM,
  romFromBytes,
} from '@simten/core/std';
import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small';

// figlet, a real npm package, renders ASCII-art text at module-load time.
// We bake the resulting bytes into a hardware ROM and stream them through a
// hardware Console, character by character, like a typewriter.
//
// The point: circuits are TypeScript, so the entire npm registry is available
// to you at design time.
figlet.parseFont('Small', smallFont);
const banner = figlet.textSync('Simten', { font: 'Small' });
// ROM layout: prefix a form-feed (clear-screen) byte so each pass through
// the 8-bit counter wipes the terminal before redrawing the banner.
// Remaining addresses past the banner are NULs (Console treats them as no-op).
const FF = 12;
const ascii = [...banner].map((c) => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) => {
  if (i === 0) return FF;
  return i <= ascii.length ? ascii[i - 1] : 0;
});

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

export const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: ConsolePrimitive },
  connect: ({ nodes: { src, term } }) => [src.byte.to(term.data), src.strobe.to(term.we)],
});

// Source string used by the splash hero picker; same content as DEMOS[0].code
// below, exported so ClaudeDemoSection can render it without duplicating the
// figlet ROM-generation logic. Kept as a free const rather than read out of
// DEMOS at runtime to avoid a circular-feeling self-reference.
export const FIGLET_DEMO_CODE = `// Bakes an npm package's output into a ROM.
import figlet from 'figlet';
import smallFont from 'figlet/fonts/Small.js';
figlet.parseFont('Small', smallFont);

// Render ASCII-art at compile time with a real npm package,
// then stream the bytes through hardware, letter by letter.
const banner = figlet.textSync('Simten', { font: 'Small' });
const ascii = [...banner].map(c => c.charCodeAt(0));
const bannerBytes = Array.from({ length: 256 }, (_, i) =>
  i === 0 ? 12 : i <= ascii.length ? ascii[i - 1] : 0
);

const FigletStream = circuit('FigletStream', {
  outputs: { byte: bus(8), strobe: bit },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(bannerBytes) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.byte),
    we.out.to(outputs.strobe),
  ],
});

const FigletDemo = circuit('FigletDemo', {
  nodes: { src: FigletStream, term: Console },
  connect: ({ nodes: { src, term } }) => [
    src.byte.to(term.data),
    src.strobe.to(term.we),
  ],
});`;
