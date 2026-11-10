/**
 * The two controller ports and standard pads.
 *
 * A pad is an 8-bit parallel-in, serial-out shift register (a 4021) holding
 * the buttons, bit 0 first:
 *
 *   0 A   1 B   2 Select   3 Start   4 Up   5 Down   6 Left   7 Right
 *
 * Bit 0 of a $4016 write is the 2A03's OUT0 pin, the strobe to both pads.
 * While it is high the shift registers keep loading the buttons, so reads
 * return A. Once it goes low they hold, and each read of $4016 (pad 1) or
 * $4017 (pad 2) returns the next button in bit 0 and shifts. After 8 reads an
 * official pad returns 1. A button reads 1 when pressed.
 *
 * Bits 7-5 of the read are open bus, which is $40 here: the high byte of the
 * address, the last thing on the bus. Bits 4-1 read 0.
 *
 * `cs` is high for one tick per CPU access to $4016 or $4017, so each read
 * shifts once.
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
    cs: bit,
    rw: bit,
    port: bit,
    data_in: bus(8),
    pad1: bus(8),
    pad2: bus(8),
    strobe: bit,
    shift1: bus(8),
    shift2: bus(8),
  },
  outputs: { data_out: bus(8), next_strobe: bit, next_shift1: bus(8), next_shift2: bus(8) },
  meta: { category: 'nes', icon: 'J', description: 'NES controller ports: $4016, $4017' },
  eval: ({ cs, rw, port, data_in, pad1, pad2, strobe, shift1, shift2 }) => {
    const s1 = shift1 as number;
    const s2 = shift2 as number;
    const read1 = cs === 1 && rw === 1 && port === 0;
    const read2 = cs === 1 && rw === 1 && port === 1;
    const bit1 = strobe === 1 ? (pad1 as number) & 1 : s1 & 1;
    const bit2 = strobe === 1 ? (pad2 as number) & 1 : s2 & 1;

    // Strobe high: load. Otherwise a read shifts, filling with 1s.
    let next1 = s1;
    if (strobe === 1) next1 = pad1 as number;
    else if (read1) next1 = (s1 >> 1) | 0x80;
    let next2 = s2;
    if (strobe === 1) next2 = pad2 as number;
    else if (read2) next2 = (s2 >> 1) | 0x80;

    const write = cs === 1 && rw === 0 && port === 0;
    return {
      data_out: 0x40 | (port === 1 ? bit2 : bit1),
      next_strobe: write ? (data_in as number) & 1 : (strobe as number),
      next_shift1: next1,
      next_shift2: next2,
    };
  },
});

export const NesPads = circuit('NesPads', {
  inputs: { cs: bit, rw: bit, port: bit, data_in: bus(8), pad1: bus(8), pad2: bus(8) },
  outputs: { data_out: bus(8) },
  nodes: {
    strobe: Register({ width: 1 }),
    shift1: Register({ width: 8 }),
    shift2: Register({ width: 8 }),
    logic: NesPadsLogic,
    always: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.strobe.we, n.shift1.we, n.shift2.we),
    inputs.cs.to(n.logic.cs),
    inputs.rw.to(n.logic.rw),
    inputs.port.to(n.logic.port),
    inputs.data_in.to(n.logic.data_in),
    inputs.pad1.to(n.logic.pad1),
    inputs.pad2.to(n.logic.pad2),
    n.strobe.q.to(n.logic.strobe),
    n.shift1.q.to(n.logic.shift1),
    n.shift2.q.to(n.logic.shift2),
    n.logic.next_strobe.to(n.strobe.data),
    n.logic.next_shift1.to(n.shift1.data),
    n.logic.next_shift2.to(n.shift2.data),
    n.logic.data_out.to(outputs.data_out),
  ],
});
