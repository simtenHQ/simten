/**
 * Standard Library — Display Components
 */

import { component } from '../builder/component.js';
import { bit, bus } from '../builder/bit-bus.js';

export const SevenSegment = component('SevenSegment', {
  in: { in: bus(4) },
  meta: { category: 'display', icon: '7', description: '4-bit seven-segment display' },
});

export const HexDisplay = component('HexDisplay', {
  in: { in: bus(8) },
  meta: { category: 'display', icon: '0xFF', description: 'Hexadecimal display' },
});

export const Screen = component('Screen', {
  in: { dataIn: bus(8) },
  out: { addrB: bus(16) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '🖥️', description: 'Pixel display' },
  eval: ({ memory }) => ({ addrB: 0 }),
});

export const RasterDisplay = component('RasterDisplay', {
  in: { dataIn: bus(8) },
  out: { addrB: bus(16), scanX: bus(8), scanY: bus(8), hblank: bit, vblank: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'display', icon: '📺', description: 'Hardware-accurate raster display with scan counters' },
  eval: ({ memory }) => ({ addrB: 0, scanX: 0, scanY: 0, hblank: 0, vblank: 0 }),
});

export const Console = component('Console', {
  in: { data: bus(8), we: bit },
  state: { text: '' as any },
  meta: { category: 'display', icon: '📟', description: 'Text console output' },
});
