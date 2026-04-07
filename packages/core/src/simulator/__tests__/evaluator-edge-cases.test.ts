/**
 * Evaluator Edge-Case Tests
 *
 * Simulates circuits using each primitive with edge-case inputs
 * and checks outputs against known correct values.
 *
 * This directly exercises the fast evaluator code path.
 * Catches bugs like BusNot returning -43 instead of 213 for ~42.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/index.js';
import {
  BusNot, BusAnd, BusOr, BusXor,
  Adder, Subtractor, LeftShifter, RightShifter,
  Incrementer, Comparator, Multiplier, Mux, Xor, Constant,
} from '../../std/index.js';

/** Helper: simulate a 1-tick combinational circuit, return output values */
function sim<C extends BuiltCircuit>(
  built: C,
  inputs: Record<string, number | boolean>,
): Record<string, number | boolean> {
  const s = simulate(built);
  try {
    s.set(inputs as any);
    const out: Record<string, number | boolean> = {};
    for (const port of built.circuit.outputs) {
      const v = s.get(port.name as any);
      out[port.name] = port.portType.kind === 'bit' ? Boolean(v) : (v as number);
    }
    return out;
  } finally {
    s.dispose();
  }
}

describe('Evaluator Edge Cases', () => {

  // --- Bitwise bus operations ---

  describe('BusNot', () => {
    const c = circuit('TestBusNot', {
      in: { a: bus(8) },
      out: { z: bus(8) },
      nodes: { n: BusNot },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.in),
        n.out.to(out.z),
      ],
    });

    it('~42 = 213 (not -43)', () => {
      expect(sim(c, { a: 42 }).z).toBe(213);
    });

    it('~0 = 255 (not -1)', () => {
      expect(sim(c, { a: 0 }).z).toBe(255);
    });

    it('~255 = 0', () => {
      expect(sim(c, { a: 255 }).z).toBe(0);
    });

    it('~128 = 127', () => {
      expect(sim(c, { a: 128 }).z).toBe(127);
    });
  });

  describe('BusAnd', () => {
    const c = circuit('TestBusAnd', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(8) },
      nodes: { n: BusAnd },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.out.to(out.z),
      ],
    });

    it('255 & 0 = 0', () => {
      expect(sim(c, { a: 255, b: 0 }).z).toBe(0);
    });

    it('0xAA & 0x55 = 0', () => {
      expect(sim(c, { a: 0xAA, b: 0x55 }).z).toBe(0);
    });

    it('0xFF & 0xFF = 255', () => {
      expect(sim(c, { a: 255, b: 255 }).z).toBe(255);
    });
  });

  describe('BusOr', () => {
    const c = circuit('TestBusOr', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(8) },
      nodes: { n: BusOr },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.out.to(out.z),
      ],
    });

    it('0xAA | 0x55 = 0xFF', () => {
      expect(sim(c, { a: 0xAA, b: 0x55 }).z).toBe(0xFF);
    });

    it('0 | 0 = 0', () => {
      expect(sim(c, { a: 0, b: 0 }).z).toBe(0);
    });
  });

  describe('BusXor', () => {
    const c = circuit('TestBusXor', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(8) },
      nodes: { n: BusXor },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.out.to(out.z),
      ],
    });

    it('0xFF ^ 0xFF = 0', () => {
      expect(sim(c, { a: 255, b: 255 }).z).toBe(0);
    });

    it('42 ^ 42 = 0', () => {
      expect(sim(c, { a: 42, b: 42 }).z).toBe(0);
    });

    it('0xAA ^ 0x55 = 0xFF', () => {
      expect(sim(c, { a: 0xAA, b: 0x55 }).z).toBe(0xFF);
    });
  });

  // --- Arithmetic with overflow/carry ---

  describe('Adder', () => {
    const c = circuit('TestAdder', {
      in: { a: bus(8), b: bus(8) },
      out: { sum: bus(8), carry: bit },
      nodes: { n: Adder, gnd: Constant },
      connect: ({ in: inp, out, n, gnd }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        gnd.out.to(n.carry_in),
        n.sum.to(out.sum),
        n.carry_out.to(out.carry),
      ],
    });

    it('200 + 100 = 44 with carry', () => {
      const r = sim(c, { a: 200, b: 100 });
      expect(r.sum).toBe(44);
      expect(r.carry).toBe(true);
    });

    it('0 + 0 = 0 no carry', () => {
      const r = sim(c, { a: 0, b: 0 });
      expect(r.sum).toBe(0);
      expect(r.carry).toBe(false);
    });

    it('255 + 1 = 0 with carry', () => {
      const r = sim(c, { a: 255, b: 1 });
      expect(r.sum).toBe(0);
      expect(r.carry).toBe(true);
    });

    it('127 + 127 = 254 no carry', () => {
      const r = sim(c, { a: 127, b: 127 });
      expect(r.sum).toBe(254);
      expect(r.carry).toBe(false);
    });
  });

  describe('Subtractor', () => {
    const c = circuit('TestSubtractor', {
      in: { a: bus(8), b: bus(8) },
      out: { diff: bus(8), borrow: bit },
      nodes: { n: Subtractor, gnd: Constant },
      connect: ({ in: inp, out, n, gnd }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        gnd.out.to(n.borrow_in),
        n.difference.to(out.diff),
        n.borrow_out.to(out.borrow),
      ],
    });

    it('10 - 20 = 246 with borrow (unsigned wrap)', () => {
      const r = sim(c, { a: 10, b: 20 });
      expect(r.diff).toBe(246);
      expect(r.borrow).toBe(true);
    });

    it('0 - 1 = 255 with borrow', () => {
      const r = sim(c, { a: 0, b: 1 });
      expect(r.diff).toBe(255);
      expect(r.borrow).toBe(true);
    });

    it('100 - 50 = 50 no borrow', () => {
      const r = sim(c, { a: 100, b: 50 });
      expect(r.diff).toBe(50);
      expect(r.borrow).toBe(false);
    });
  });

  // --- Shifters ---

  describe('LeftShifter', () => {
    const c = circuit('TestLeftShifter', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(8) },
      nodes: { n: LeftShifter },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.value),
        inp.b.to(n.shift),
        n.result.to(out.z),
      ],
    });

    it('255 << 4 = 240 (masked to 8 bits)', () => {
      expect(sim(c, { a: 255, b: 4 }).z).toBe(240);
    });

    it('1 << 7 = 128', () => {
      expect(sim(c, { a: 1, b: 7 }).z).toBe(128);
    });

    it('1 << 8 = 0 (shifted out)', () => {
      expect(sim(c, { a: 1, b: 8 }).z).toBe(0);
    });
  });

  describe('RightShifter', () => {
    const c = circuit('TestRightShifter', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(8) },
      nodes: { n: RightShifter },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.value),
        inp.b.to(n.shift),
        n.result.to(out.z),
      ],
    });

    it('255 >> 4 = 15', () => {
      expect(sim(c, { a: 255, b: 4 }).z).toBe(15);
    });

    it('128 >> 7 = 1', () => {
      expect(sim(c, { a: 128, b: 7 }).z).toBe(1);
    });

    it('1 >> 8 = 0 (shifted out)', () => {
      expect(sim(c, { a: 1, b: 8 }).z).toBe(0);
    });
  });

  // --- Incrementer ---

  describe('Incrementer', () => {
    const c = circuit('TestIncrementer', {
      in: { a: bus(8) },
      out: { z: bus(8) },
      nodes: { n: Incrementer },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.in),
        n.out.to(out.z),
      ],
    });

    it('255 + 1 = 0 (wraps)', () => {
      expect(sim(c, { a: 255 }).z).toBe(0);
    });

    it('0 + 1 = 1', () => {
      expect(sim(c, { a: 0 }).z).toBe(1);
    });
  });

  // --- Comparator ---

  describe('Comparator', () => {
    const c = circuit('TestComparator', {
      in: { a: bus(8), b: bus(8) },
      out: { lt: bit, eq: bit, gt: bit },
      nodes: { n: Comparator },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.lt.to(out.lt),
        n.eq.to(out.eq),
        n.gt.to(out.gt),
      ],
    });

    it('0 vs 255', () => {
      const r = sim(c, { a: 0, b: 255 });
      expect(r.lt).toBe(true);
      expect(r.eq).toBe(false);
      expect(r.gt).toBe(false);
    });

    it('255 vs 255', () => {
      const r = sim(c, { a: 255, b: 255 });
      expect(r.lt).toBe(false);
      expect(r.eq).toBe(true);
      expect(r.gt).toBe(false);
    });

    it('200 vs 100', () => {
      const r = sim(c, { a: 200, b: 100 });
      expect(r.lt).toBe(false);
      expect(r.eq).toBe(false);
      expect(r.gt).toBe(true);
    });
  });

  // --- Multiplier ---

  describe('Multiplier', () => {
    const c = circuit('TestMultiplier', {
      in: { a: bus(8), b: bus(8) },
      out: { z: bus(16) },
      nodes: { n: Multiplier },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.product.to(out.z),
      ],
    });

    it('255 * 255 = 65025', () => {
      expect(sim(c, { a: 255, b: 255 }).z).toBe(65025);
    });

    it('16 * 16 = 256', () => {
      expect(sim(c, { a: 16, b: 16 }).z).toBe(256);
    });

    it('7 * 6 = 42', () => {
      expect(sim(c, { a: 7, b: 6 }).z).toBe(42);
    });
  });

  // --- Mux ---

  describe('Mux', () => {
    // Mux in the new stdlib is bit-only
    const c = circuit('TestMux', {
      in: { a: bit, b: bit, sel: bit },
      out: { z: bit },
      nodes: { n: Mux },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.in0),
        inp.b.to(n.in1),
        inp.sel.to(n.sel),
        n.out.to(out.z),
      ],
    });

    it('sel=0 picks in0', () => {
      expect(sim(c, { a: true, b: false, sel: false }).z).toBe(true);
    });

    it('sel=1 picks in1', () => {
      expect(sim(c, { a: false, b: true, sel: true }).z).toBe(true);
    });
  });

  // --- Bit-level logic gates (boundary values) ---

  describe('Xor', () => {
    const c = circuit('TestXor', {
      in: { a: bit, b: bit },
      out: { z: bit },
      nodes: { n: Xor },
      connect: ({ in: inp, out, n }) => [
        inp.a.to(n.a),
        inp.b.to(n.b),
        n.out.to(out.z),
      ],
    });

    it('true ^ true = false', () => {
      expect(sim(c, { a: true, b: true }).z).toBe(false);
    });

    it('true ^ false = true', () => {
      expect(sim(c, { a: true, b: false }).z).toBe(true);
    });
  });
});
