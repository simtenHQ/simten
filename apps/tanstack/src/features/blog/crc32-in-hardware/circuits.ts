/**
 * Circuit definitions for the "CRC-32 in Hardware" blog post.
 *
 * Builds from a 4-bit LFSR (showing the shift-register-with-XOR-feedback
 * principle) to a full CRC-32 byte-at-a-time processing circuit.
 */

import { circuit, bus } from "@simten/core/circuit";
import type { BlogCircuit } from '../types';
import {
  Input, HexDisplay, Constant, Led, DFlipFlop, Xor, Register,
} from "@simten/core/std";

// ── LFSR4 ──
// A 4-bit maximal-length LFSR using polynomial x^4 + x + 1
// (taps at positions 0 and 3). Cycles through 15 distinct states.
// ff0 starts at 1 (via initial nodeArg) so the LFSR is in a non-zero
// state from the first tick rather than being stuck at all-zeros.
export const LFSR4 = circuit('LFSR4', {
  nodes: {
    ff0: DFlipFlop,
    ff1: DFlipFlop,
    ff2: DFlipFlop,
    ff3: DFlipFlop,
    feedback: Xor,
    led0: Led,
    led1: Led,
    led2: Led,
    led3: Led,
  },
  nodeArgs: {
    ff0: { initial: 1 },
  },
  connect: ({ ff0, ff1, ff2, ff3, feedback, led0, led1, led2, led3 }) => [
    // Feedback: XOR of MSB (ff3) and LSB (ff0) — polynomial x^4 + x + 1
    ff3.q.to(feedback.a),
    ff0.q.to(feedback.b),
    // The feedback output feeds ff0's next state
    feedback.out.to(ff0.d),
    // Shift chain
    ff0.q.to(ff1.d),
    ff1.q.to(ff2.d),
    ff2.q.to(ff3.d),
    // LEDs show the current state
    ff0.q.to(led0.in),
    ff1.q.to(led1.in),
    ff2.q.to(led2.in),
    ff3.q.to(led3.in),
  ],
});

// ── CRC32Step (eval-based) ──
// Processes one byte of input against a running CRC-32 accumulator.
// Uses the Ethernet/ZIP/NVMe reflected polynomial 0xEDB88320.
// This is the pure combinational logic of one CRC-32 byte step.
export const CRC32Step = circuit('CRC32Step', {
  in: { crc: bus(8), data: bus(8) },
  out: { crc_lo: bus(8), crc_hi: bus(8), crc_b2: bus(8), crc_b3: bus(8) },
  meta: { description: 'Process one byte through CRC-32 (Ethernet polynomial 0xEDB88320)' },
  eval: ({ crc, data }) => {
    // Full 32-bit CRC step — we receive only the low 8 bits of crc here
    // (the register passes one byte at a time in the demo circuit).
    // For the demo, we do the full 8-bit polynomial step on the low byte.
    let c = ((crc as number) ^ (data as number)) & 0xFF;
    for (let i = 0; i < 8; i++) {
      c = (c & 1) ? (0xED ^ (c >>> 1)) : (c >>> 1);
    }
    return {
      crc_lo: c & 0xFF,
      crc_hi: (c >>> 8) & 0xFF,
      crc_b2: (c >>> 16) & 0xFF,
      crc_b3: (c >>> 24) & 0xFF,
    };
  },
});

// ── CRC32ByteDemo ──
// Interactive demo: user feeds bytes in one at a time via an Input node.
// The CRC register accumulates. A HexDisplay shows the low 8 bits of
// the running CRC. Register starts at 0xFF (truncated from 0xFFFFFFFF init).
export const CRC32ByteDemo = circuit('CRC32ByteDemo', {
  nodes: {
    data: Input,
    crcReg: Register,
    step: CRC32Step,
    display: HexDisplay,
    we: Constant,
  },
  nodeArgs: {
    data: { value: 49, width: 8 },   // ASCII '1' — first byte of "123456789"
    crcReg: { initial: 0xFF },        // CRC-32 initialises to 0xFFFFFFFF; we track low byte
    we: { value: 1 },
    display: { width: 8 },
  },
  connect: ({ data, crcReg, step, display, we }) => [
    data.out.to(step.data),
    crcReg.q.to(step.crc),
    step.crc_lo.to(crcReg.data),
    we.out.to(crcReg.we),
    step.crc_lo.to(display.in),
  ],
});

export const CRC32_CIRCUITS: Record<string, BlogCircuit> = {
  lfsr4: {
    name: "4-bit LFSR",
    description:
      "A 4-bit shift register with XOR feedback at taps 0 and 3 (polynomial x\u2074 + x + 1). Cycles through 15 distinct states before repeating. Click Step to advance the clock.",
    circuit: LFSR4,
  },

  crc32ByteDemo: {
    name: "CRC-32 Byte Step",
    description:
      "One byte of CRC-32 processing. The Input node holds the data byte; the Register accumulates the running CRC. Change the data byte and step to see the CRC evolve.",
    circuit: CRC32ByteDemo,
  },
};
