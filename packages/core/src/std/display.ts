/**
 * Standard Library — Display Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

// All components in this file model simulation-only peripherals. They're tagged
// `meta.synthesizable: false` so the synth checker skips their eval bodies and
// the sandbox exposes the simulation state of any node on their bus to the
// main frame — the sim analog of memory-mapped framebuffers / debug peripherals.

export const SevenSegment = circuit('SevenSegment', {
  inputs: { in: bus(4) },
  meta: { category: 'display', icon: '7', description: '4-bit seven-segment display', synthesizable: false },
});

export const HexDisplay = circuit('HexDisplay', {
  inputs: { in: bus(8) },
  meta: { category: 'display', icon: '0xFF', description: 'Hexadecimal display', synthesizable: false },
});

export const Screen = circuit('Screen', {
  inputs: { dataIn: bus(8) },
  outputs: { addrB: bus(16) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '🖥️', description: 'Pixel display', synthesizable: false },
  eval: () => ({ addrB: 0 }),
});

export const RasterDisplay = circuit('RasterDisplay', {
  inputs: { dataIn: bus(8) },
  outputs: { addrB: bus(16), scanX: bus(8), scanY: bus(8), hblank: bit, vblank: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '📺', description: 'Hardware-accurate raster display with scan counters', synthesizable: false },
  eval: () => ({ addrB: 0, scanX: 0, scanY: 0, hblank: 0, vblank: 0 }),
});

export const Console = circuit('Console', {
  inputs: { data: bus(8), we: bit },
  state: { text: '' as any },
  onTick: ({ data, we, text }) => {
    if (!we) return { text };
    const byte = (data as number) & 0xFF;
    // ASCII control bytes that don't append a printable character:
    //   0  (NUL) — no-op, lets ROMs use 0 as a safe filler
    //   12 (FF)  — form feed, clears the terminal (one-shot redraw pattern)
    if (byte === 0) return { text };
    if (byte === 12) return { text: '' };
    const next = ((text as string) ?? '') + String.fromCharCode(byte);
    return { text: next.length > 4096 ? next.slice(-4096) : next };
  },
  meta: { category: 'display', icon: '📟', description: 'Text console output', synthesizable: false },
});
