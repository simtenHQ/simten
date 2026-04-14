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
  in: { in: bus(4) },
  meta: { category: 'display', icon: '7', description: '4-bit seven-segment display', synthesizable: false },
});

export const HexDisplay = circuit('HexDisplay', {
  in: { in: bus(8) },
  meta: { category: 'display', icon: '0xFF', description: 'Hexadecimal display', synthesizable: false },
});

export const Screen = circuit('Screen', {
  in: { dataIn: bus(8) },
  out: { addrB: bus(16) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '🖥️', description: 'Pixel display', synthesizable: false },
  eval: ({ memory }) => ({ addrB: 0 }),
});

export const RasterDisplay = circuit('RasterDisplay', {
  in: { dataIn: bus(8) },
  out: { addrB: bus(16), scanX: bus(8), scanY: bus(8), hblank: bit, vblank: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '📺', description: 'Hardware-accurate raster display with scan counters', synthesizable: false },
  eval: ({ memory }) => ({ addrB: 0, scanX: 0, scanY: 0, hblank: 0, vblank: 0 }),
});

export const Console = circuit('Console', {
  in: { data: bus(8), we: bit },
  state: { text: '' as any },
  meta: { category: 'display', icon: '📟', description: 'Text console output', synthesizable: false },
});
