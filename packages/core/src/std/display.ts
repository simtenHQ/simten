/**
 * Standard Library — Display Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

// All components in this file model simulation-only peripherals. They're tagged
// `meta.synthesizable: false` so the synth checker skips their eval bodies and
// the sandbox exposes the simulation state of any node on their bus to the
// main frame — the sim analog of memory-mapped framebuffers / debug peripherals.

/**
 * 4-bit seven-segment display. Renders the input value (0–15) as a hex
 * digit on the canvas. Simulation-only peripheral — not synthesizable to
 * Verilog.
 *
 * **Input:** `in` — `bus(4)`
 *
 * **Example:**
 * ```ts
 * circuit('NibbleDisplay', {
 *   inputs:  { value: bus(4) },
 *   nodes:   { seg: SevenSegment },
 *   connect: ({ inputs, nodes: { seg } }) => [
 *     inputs.value.to(seg.in),
 *   ],
 * })
 * ```
 */
export const SevenSegment = circuit('SevenSegment', {
  inputs: { in: bus(4) },
  meta: {
    category: 'display',
    icon: '7',
    description: '4-bit seven-segment display',
    synthesizable: false,
  },
});

/**
 * Hexadecimal display. Renders an 8-bit input as a two-digit hex byte on
 * the canvas. Simulation-only peripheral — not synthesizable to Verilog.
 *
 * **Input:** `in` — `bus(8)`
 *
 * **Example:**
 * ```ts
 * circuit('ByteDisplay', {
 *   inputs:  { value: bus(8) },
 *   nodes:   { hex: HexDisplay },
 *   connect: ({ inputs, nodes: { hex } }) => [
 *     inputs.value.to(hex.in),
 *   ],
 * })
 * ```
 */
export const HexDisplay = circuit('HexDisplay', {
  inputs: { in: bus(8) },
  meta: {
    category: 'display',
    icon: '0xFF',
    description: 'Hexadecimal display',
    synthesizable: false,
  },
});

/**
 * Pixel display. Memory-mapped framebuffer — wire its `addrB` port to the
 * address bus of a RAM/ROM, and `dataIn` to the data bus, and the canvas
 * displays the framebuffer contents. Simulation-only peripheral — not
 * synthesizable to Verilog.
 *
 * **Input:** `dataIn` — `bus(8)` (pixel data from framebuffer)
 * **Output:** `addrB` — `bus(16)` (address driven by scan logic)
 *
 * **Example:** RAM-backed screen
 * ```ts
 * circuit('Display', {
 *   nodes: { ram: RAM, screen: Screen },
 *   connect: ({ nodes: { ram, screen } }) => [
 *     screen.addrB.to(ram.addr),
 *     ram.data_out.to(screen.dataIn),
 *   ],
 * })
 * ```
 */
export const Screen = circuit('Screen', (_opts?: { width?: number; height?: number }) => ({
  inputs: { dataIn: bus(8) },
  outputs: { addrB: bus(16) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '🖥️', description: 'Pixel display', synthesizable: false },
  eval: () => ({ addrB: 0 }),
}));

/**
 * Hardware-accurate raster display with scan counters. Like `Screen`, but
 * also exposes the current scan position (`scanX`, `scanY`) and blanking
 * signals (`hblank`, `vblank`) so your circuit can implement per-pixel
 * logic, sprites, or CRT-style effects. Simulation-only peripheral — not
 * synthesizable to Verilog.
 *
 * **Input:** `dataIn` — `bus(8)`
 * **Outputs:** `addrB` — `bus(16)`; `scanX`, `scanY` — `bus(8)`;
 * `hblank`, `vblank` — `bit`
 */
export const RasterDisplay = circuit(
  'RasterDisplay',
  (_opts?: { width?: number; height?: number }) => ({
    inputs: { dataIn: bus(8) },
    outputs: { addrB: bus(16), scanX: bus(8), scanY: bus(8), hblank: bit, vblank: bit },
    state: { memory: new Map<number, number>() },
    meta: {
      category: 'display',
      icon: '📺',
      description: 'Hardware-accurate raster display with scan counters',
      synthesizable: false,
    },
    eval: () => ({ addrB: 0, scanX: 0, scanY: 0, hblank: 0, vblank: 0 }),
  }),
);

/**
 * Text console output. Append-only ASCII terminal — write a byte with
 * `we` high to push a character. Byte 0 (NUL) is ignored; byte 12 (FF)
 * clears the screen. Buffer holds the most recent 4 KB. Simulation-only
 * peripheral — not synthesizable to Verilog.
 *
 * **Inputs:** `data` — `bus(8)`; `we` — `bit`
 *
 * **Example:** UART-style print
 * ```ts
 * circuit('PrintByte', {
 *   inputs:  { ch: bus(8), strobe: bit },
 *   nodes:   { c: Console },
 *   connect: ({ inputs, nodes: { c } }) => [
 *     inputs.ch.to(c.data),
 *     inputs.strobe.to(c.we),
 *   ],
 * })
 * ```
 */
export const Console = circuit('Console', {
  inputs: { data: bus(8), we: bit },
  state: { text: '' as any },
  onTick: ({ data, we, text }) => {
    if (!we) return { text };
    const byte = (data as number) & 0xff;
    // ASCII control bytes that don't append a printable character:
    //   0  (NUL) — no-op, lets ROMs use 0 as a safe filler
    //   12 (FF)  — form feed, clears the terminal (one-shot redraw pattern)
    if (byte === 0) return { text };
    if (byte === 12) return { text: '' };
    const next = ((text as string) ?? '') + String.fromCharCode(byte);
    return { text: next.length > 4096 ? next.slice(-4096) : next };
  },
  meta: {
    category: 'display',
    icon: '📟',
    description: 'Text console output',
    synthesizable: false,
  },
});
