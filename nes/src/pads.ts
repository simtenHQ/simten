/**
 * The two controller ports and standard pads.
 *
 * A pad is an 8-bit parallel-in, serial-out shift register (a 4021) holding
 * the buttons, bit 0 first:
 *
 *   0 A   1 B   2 Select   3 Start   4 Up   5 Down   6 Left   7 Right
 *
 * The 2A03's OUT0 pin (bit 0 of a $4016 write) is the strobe to both pads.
 * While it is high the shift registers keep loading the buttons, so reads
 * return A. Once it goes low they hold, and each read of $4016 (pad 1) or
 * $4017 (pad 2) returns the next button in bit 0 and shifts. After 8 reads an
 * official pad returns 1. A button reads 1 when pressed.
 *
 * The 2A03 signals those reads on /OE1 and /OE2 (`oe1`, `oe2`), high for the
 * whole read cycle; the pad shifts at its end, on M2. `data_out` is what the
 * ports put on the data bus while one of them is enabled: the bit in D0, and
 * $40 in bits 7-5 (open bus: the high byte of the address, the last thing on
 * the bus). Bits 4-1 read 0.
 */

import { bit, bus, circuit } from '@simten/core';
import { Constant, Register } from '@simten/core/std';

/** Bits of `pad1` and `pad2`, one per button. */
export const BUTTON = {
  A: 0x01,
  B: 0x02,
  SELECT: 0x04,
  START: 0x08,
  UP: 0x10,
  DOWN: 0x20,
  LEFT: 0x40,
  RIGHT: 0x80,
} as const;

const NesPadsLogic = circuit('NesPadsLogic', {
  inputs: {
    m2: bit,
    out0: bit,
    oe1: bit,
    oe2: bit,
    pad1: bus(8),
    pad2: bus(8),
    shift1: bus(8),
    shift2: bus(8),
  },
  outputs: { data_out: bus(8), next_shift1: bus(8), next_shift2: bus(8) },
  meta: { category: 'nes', icon: 'J', description: 'NES controller ports: $4016, $4017' },
  eval: ({ m2, out0, oe1, oe2, pad1, pad2, shift1, shift2 }) => {
    const s1 = shift1 as number;
    const s2 = shift2 as number;
    const bit1 = out0 === 1 ? (pad1 as number) & 1 : s1 & 1;
    const bit2 = out0 === 1 ? (pad2 as number) & 1 : s2 & 1;

    // Strobe high: load. Otherwise the end of a read shifts, filling with 1s.
    let next1 = s1;
    if (out0 === 1) next1 = pad1 as number;
    else if (m2 === 1 && oe1 === 1) next1 = (s1 >> 1) | 0x80;
    let next2 = s2;
    if (out0 === 1) next2 = pad2 as number;
    else if (m2 === 1 && oe2 === 1) next2 = (s2 >> 1) | 0x80;

    return {
      data_out: 0x40 | (oe2 === 1 ? bit2 : bit1),
      next_shift1: next1,
      next_shift2: next2,
    };
  },
});

export const NesPads = circuit('NesPads', {
  inputs: { m2: bit, out0: bit, oe1: bit, oe2: bit, pad1: bus(8), pad2: bus(8) },
  outputs: { data_out: bus(8) },
  nodes: {
    shift1: Register({ width: 8 }),
    shift2: Register({ width: 8 }),
    logic: NesPadsLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.shift1.we, n.shift2.we),
    inputs.m2.to(n.logic.m2),
    inputs.out0.to(n.logic.out0),
    inputs.oe1.to(n.logic.oe1),
    inputs.oe2.to(n.logic.oe2),
    inputs.pad1.to(n.logic.pad1),
    inputs.pad2.to(n.logic.pad2),
    n.shift1.q.to(n.logic.shift1),
    n.shift2.q.to(n.logic.shift2),
    n.logic.next_shift1.to(n.shift1.data),
    n.logic.next_shift2.to(n.shift2.data),
    n.logic.data_out.to(outputs.data_out),
  ],
});
