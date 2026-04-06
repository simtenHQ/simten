/**
 * Standard Library — Routing / Plexers / Utilities
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const Mux = circuit('Mux', {
  in: { in0: bit, in1: bit, sel: bit },
  out: { out: bit },
  meta: { category: 'plexers', icon: 'MUX', description: 'Multiplexer — sel=0 picks in0, sel=1 picks in1' },
  eval: ({ in0, in1, sel }) => ({ out: sel ? in1 : in0 }),
});

export const Decoder = circuit('Decoder', {
  in: { in: bus(2) },
  out: { out0: bit, out1: bit, out2: bit, out3: bit },
  meta: { category: 'plexers', icon: 'DEC', description: '2-to-4 decoder' },
  eval: ({ in: val }) => ({
    out0: val === 0 ? 1 : 0,
    out1: val === 1 ? 1 : 0,
    out2: val === 2 ? 1 : 0,
    out3: val === 3 ? 1 : 0,
  }),
});

export const Splitter = circuit('Splitter', {
  in: { in: bus(8) },
  out: { out0: bus(4), out1: bus(4) },
  meta: { category: 'utilities', icon: '⊢', description: 'Bus splitter' },
  eval: ({ in: val }) => ({ out0: val & 0xF, out1: (val >> 4) & 0xF }),
});

export const Splitter8to8 = circuit('Splitter8to8', {
  in: { in: bus(8) },
  out: { bit0: bit, bit1: bit, bit2: bit, bit3: bit, bit4: bit, bit5: bit, bit6: bit, bit7: bit },
  meta: { category: 'utilities', icon: '⊢8', description: 'Splits 8-bit bus into 8 individual bits' },
  eval: ({ in: val }) => ({
    bit0: (val >> 0) & 1, bit1: (val >> 1) & 1, bit2: (val >> 2) & 1, bit3: (val >> 3) & 1,
    bit4: (val >> 4) & 1, bit5: (val >> 5) & 1, bit6: (val >> 6) & 1, bit7: (val >> 7) & 1,
  }),
});

export const Combiner8to8 = circuit('Combiner8to8', {
  in: { bit0: bit, bit1: bit, bit2: bit, bit3: bit, bit4: bit, bit5: bit, bit6: bit, bit7: bit },
  out: { out: bus(8) },
  meta: { category: 'utilities', icon: '⊣8', description: 'Combines 8 bits into an 8-bit bus' },
  eval: ({ bit0, bit1, bit2, bit3, bit4, bit5, bit6, bit7 }) => ({
    out: (bit0 & 1) | ((bit1 & 1) << 1) | ((bit2 & 1) << 2) | ((bit3 & 1) << 3) |
         ((bit4 & 1) << 4) | ((bit5 & 1) << 5) | ((bit6 & 1) << 6) | ((bit7 & 1) << 7),
  }),
});

export const Concat = circuit('Concat', {
  in: { high: bus(4), low: bus(4) },
  out: { out: bus(8) },
  meta: { category: 'utilities', icon: '||', description: 'Concatenate two buses' },
  eval: ({ high, low }) => ({ out: (high << 4) | low }),
});

export const BitSlice = circuit('BitSlice', {
  in: { in: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'utilities', icon: '[]', description: 'Extract bits [low..high] from input' },
  eval: ({ in: val }) => ({ out: val }),
});

export const AddressCombiner = circuit('AddressCombiner', {
  in: { lo: bus(8), hi: bus(8) },
  out: { out: bus(16) },
  meta: { category: 'utilities', icon: '⊕16', description: 'Combines two 8-bit buses into 16-bit' },
  eval: ({ lo, hi }) => ({ out: ((hi & 0xFF) << 8) | (lo & 0xFF) }),
});

export const Probe = circuit('Probe', {
  in: { in: bit },
  out: { out: bit },
  meta: { category: 'utilities', icon: '🔍', description: 'Debug observation point' },
  eval: ({ in: val }) => ({ out: val }),
});
