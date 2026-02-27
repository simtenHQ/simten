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
import { simulateCircuit } from '../../api/simulate.js';

/** Helper: simulate a 1-tick combinational circuit, return output values */
function sim(source: string, inputs: Record<string, number | boolean>): Record<string, number | boolean> {
  const result = simulateCircuit({ source, ticks: 1, inputs });
  if ('error' in result) throw new Error(result.error);
  const out: Record<string, number | boolean> = {};
  for (const [key, rle] of Object.entries(result.signals)) {
    out[key] = rle[0].value;
  }
  return out;
}

describe('Evaluator Edge Cases', () => {

  // --- Bitwise bus operations ---

  describe('BusNot', () => {
    const circuit = `circuit T { input a: Bus[8] output z: Bus[8] impl { node n: BusNot connect a -> n.in connect n.out -> z } }`;

    it('~42 = 213 (not -43)', () => {
      expect(sim(circuit, { a: 42 }).z).toBe(213);
    });

    it('~0 = 255 (not -1)', () => {
      expect(sim(circuit, { a: 0 }).z).toBe(255);
    });

    it('~255 = 0', () => {
      expect(sim(circuit, { a: 255 }).z).toBe(0);
    });

    it('~128 = 127', () => {
      expect(sim(circuit, { a: 128 }).z).toBe(127);
    });
  });

  describe('BusAnd', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[8] impl { node n: BusAnd connect a -> n.a connect b -> n.b connect n.out -> z } }`;

    it('255 & 0 = 0', () => {
      expect(sim(circuit, { a: 255, b: 0 }).z).toBe(0);
    });

    it('0xAA & 0x55 = 0', () => {
      expect(sim(circuit, { a: 0xAA, b: 0x55 }).z).toBe(0);
    });

    it('0xFF & 0xFF = 255', () => {
      expect(sim(circuit, { a: 255, b: 255 }).z).toBe(255);
    });
  });

  describe('BusOr', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[8] impl { node n: BusOr connect a -> n.a connect b -> n.b connect n.out -> z } }`;

    it('0xAA | 0x55 = 0xFF', () => {
      expect(sim(circuit, { a: 0xAA, b: 0x55 }).z).toBe(0xFF);
    });

    it('0 | 0 = 0', () => {
      expect(sim(circuit, { a: 0, b: 0 }).z).toBe(0);
    });
  });

  describe('BusXor', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[8] impl { node n: BusXor connect a -> n.a connect b -> n.b connect n.out -> z } }`;

    it('0xFF ^ 0xFF = 0', () => {
      expect(sim(circuit, { a: 255, b: 255 }).z).toBe(0);
    });

    it('42 ^ 42 = 0', () => {
      expect(sim(circuit, { a: 42, b: 42 }).z).toBe(0);
    });

    it('0xAA ^ 0x55 = 0xFF', () => {
      expect(sim(circuit, { a: 0xAA, b: 0x55 }).z).toBe(0xFF);
    });
  });

  // --- Arithmetic with overflow/carry ---

  describe('Adder', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output sum: Bus[8] output carry: Bit impl { node n: Adder node gnd: Constant(value=0) connect a -> n.a connect b -> n.b connect gnd.out -> n.carry_in connect n.sum -> sum connect n.carry_out -> carry } }`;

    it('200 + 100 = 44 with carry', () => {
      const r = sim(circuit, { a: 200, b: 100 });
      expect(r.sum).toBe(44);
      expect(r.carry).toBe(true);
    });

    it('0 + 0 = 0 no carry', () => {
      const r = sim(circuit, { a: 0, b: 0 });
      expect(r.sum).toBe(0);
      expect(r.carry).toBe(false);
    });

    it('255 + 1 = 0 with carry', () => {
      const r = sim(circuit, { a: 255, b: 1 });
      expect(r.sum).toBe(0);
      expect(r.carry).toBe(true);
    });

    it('127 + 127 = 254 no carry', () => {
      const r = sim(circuit, { a: 127, b: 127 });
      expect(r.sum).toBe(254);
      expect(r.carry).toBe(false);
    });
  });

  describe('Subtractor', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output diff: Bus[8] output borrow: Bit impl { node n: Subtractor node gnd: Constant(value=0) connect a -> n.a connect b -> n.b connect gnd.out -> n.borrow_in connect n.difference -> diff connect n.borrow_out -> borrow } }`;

    it('10 - 20 = 246 with borrow (unsigned wrap)', () => {
      const r = sim(circuit, { a: 10, b: 20 });
      expect(r.diff).toBe(246);
      expect(r.borrow).toBe(true);
    });

    it('0 - 1 = 255 with borrow', () => {
      const r = sim(circuit, { a: 0, b: 1 });
      expect(r.diff).toBe(255);
      expect(r.borrow).toBe(true);
    });

    it('100 - 50 = 50 no borrow', () => {
      const r = sim(circuit, { a: 100, b: 50 });
      expect(r.diff).toBe(50);
      expect(r.borrow).toBe(false);
    });
  });

  // --- Shifters ---

  describe('LeftShifter', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[8] impl { node n: LeftShifter connect a -> n.value connect b -> n.shift connect n.result -> z } }`;

    it('255 << 4 = 240 (masked to 8 bits)', () => {
      expect(sim(circuit, { a: 255, b: 4 }).z).toBe(240);
    });

    it('1 << 7 = 128', () => {
      expect(sim(circuit, { a: 1, b: 7 }).z).toBe(128);
    });

    it('1 << 8 = 0 (shifted out)', () => {
      expect(sim(circuit, { a: 1, b: 8 }).z).toBe(0);
    });
  });

  describe('RightShifter', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[8] impl { node n: RightShifter connect a -> n.value connect b -> n.shift connect n.result -> z } }`;

    it('255 >> 4 = 15', () => {
      expect(sim(circuit, { a: 255, b: 4 }).z).toBe(15);
    });

    it('128 >> 7 = 1', () => {
      expect(sim(circuit, { a: 128, b: 7 }).z).toBe(1);
    });

    it('1 >> 8 = 0 (shifted out)', () => {
      expect(sim(circuit, { a: 1, b: 8 }).z).toBe(0);
    });
  });

  // --- Incrementer ---

  describe('Incrementer', () => {
    const circuit = `circuit T { input a: Bus[8] output z: Bus[8] impl { node n: Incrementer connect a -> n.in connect n.out -> z } }`;

    it('255 + 1 = 0 (wraps)', () => {
      expect(sim(circuit, { a: 255 }).z).toBe(0);
    });

    it('0 + 1 = 1', () => {
      expect(sim(circuit, { a: 0 }).z).toBe(1);
    });
  });

  // --- Comparator ---

  describe('Comparator', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output lt: Bit output eq: Bit output gt: Bit impl { node n: Comparator connect a -> n.a connect b -> n.b connect n.lt -> lt connect n.eq -> eq connect n.gt -> gt } }`;

    it('0 vs 255', () => {
      const r = sim(circuit, { a: 0, b: 255 });
      expect(r.lt).toBe(true);
      expect(r.eq).toBe(false);
      expect(r.gt).toBe(false);
    });

    it('255 vs 255', () => {
      const r = sim(circuit, { a: 255, b: 255 });
      expect(r.lt).toBe(false);
      expect(r.eq).toBe(true);
      expect(r.gt).toBe(false);
    });

    it('200 vs 100', () => {
      const r = sim(circuit, { a: 200, b: 100 });
      expect(r.lt).toBe(false);
      expect(r.eq).toBe(false);
      expect(r.gt).toBe(true);
    });
  });

  // --- Multiplier ---

  describe('Multiplier', () => {
    // Multiplier output is Bus[16] (double width)
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] output z: Bus[16] impl { node n: Multiplier connect a -> n.a connect b -> n.b connect n.product -> z } }`;

    it('255 * 255 = 65025', () => {
      expect(sim(circuit, { a: 255, b: 255 }).z).toBe(65025);
    });

    it('16 * 16 = 256', () => {
      expect(sim(circuit, { a: 16, b: 16 }).z).toBe(256);
    });

    it('7 * 6 = 42', () => {
      expect(sim(circuit, { a: 7, b: 6 }).z).toBe(42);
    });
  });

  // --- Mux ---

  describe('Mux', () => {
    const circuit = `circuit T { input a: Bus[8] input b: Bus[8] input sel: Bit output z: Bus[8] impl { node n: Mux(width=8) connect a -> n.in0 connect b -> n.in1 connect sel -> n.sel connect n.out -> z } }`;

    it('sel=0 picks in0', () => {
      expect(sim(circuit, { a: 42, b: 99, sel: false }).z).toBe(42);
    });

    it('sel=1 picks in1', () => {
      expect(sim(circuit, { a: 42, b: 99, sel: true }).z).toBe(99);
    });
  });

  // --- Bit-level logic gates (boundary values) ---

  describe('Xor', () => {
    const circuit = `circuit T { input a: Bit input b: Bit output z: Bit impl { node n: Xor connect a -> n.a connect b -> n.b connect n.out -> z } }`;

    it('true ^ true = false', () => {
      expect(sim(circuit, { a: true, b: true }).z).toBe(false);
    });

    it('true ^ false = true', () => {
      expect(sim(circuit, { a: true, b: false }).z).toBe(true);
    });
  });
});
