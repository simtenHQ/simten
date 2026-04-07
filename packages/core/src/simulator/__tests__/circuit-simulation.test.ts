/**
 * End-to-end circuit simulation tests using the circuit() builder API.
 *
 * Circuit simulation tests. These verify the simulator
 * runs circuits correctly when defined with circuit().
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Adder, Register, DFlipFlop, Mux, Comparator, Constant } from '../../std/index.js';

// ============================================================================
// Combinational circuits
// ============================================================================

describe('combinational circuits', () => {
  it('simulates a half adder', () => {
    const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ in: inp, out, x1, a1 }) => [
        inp.a.to(x1.a, a1.a),
        inp.b.to(x1.b, a1.b),
        x1.out.to(out.sum),
        a1.out.to(out.carry),
      ],
    });

    const sim = simulate(HalfAdder);
    try {
      sim.set({ a: 0, b: 0 });
      expect(sim.get('sum')).toBe(0);
      expect(sim.get('carry')).toBe(0);

      sim.set({ a: 1, b: 0 });
      expect(sim.get('sum')).toBe(1);
      expect(sim.get('carry')).toBe(0);

      sim.set({ a: 1, b: 1 });
      expect(sim.get('sum')).toBe(0);
      expect(sim.get('carry')).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it('simulates a 2-to-1 mux', () => {
    const Mux2to1 = circuit('Mux2to1', {
      in: { a: bit, b: bit, sel: bit },
      out: { out: bit },
      nodes: { not1: Not, and1: And, and2: And, or1: Or },
      connect: ({ in: inp, out, not1, and1, and2, or1 }) => [
        inp.sel.to(not1.in, and2.b),
        inp.a.to(and1.a),
        not1.out.to(and1.b),
        inp.b.to(and2.a),
        and1.out.to(or1.a),
        and2.out.to(or1.b),
        or1.out.to(out.out),
      ],
    });

    const sim = simulate(Mux2to1);
    try {
      sim.set({ a: 1, b: 0, sel: 0 });
      expect(sim.get('out')).toBe(1);

      sim.set({ a: 1, b: 0, sel: 1 });
      expect(sim.get('out')).toBe(0);

      sim.set({ a: 0, b: 1, sel: 1 });
      expect(sim.get('out')).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it('simulates a composite circuit (full adder built from half adders)', () => {
    const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ in: inp, out, x1, a1 }) => [
        inp.a.to(x1.a, a1.a),
        inp.b.to(x1.b, a1.b),
        x1.out.to(out.sum),
        a1.out.to(out.carry),
      ],
    });

    const FullAdder = circuit('FullAdder', {
      in: { a: bit, b: bit, cin: bit },
      out: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
      connect: ({ in: inp, out, ha1, ha2, or1 }) => [
        inp.a.to(ha1.a),
        inp.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inp.cin.to(ha2.b),
        ha2.sum.to(out.sum),
        ha1.carry.to(or1.a),
        ha2.carry.to(or1.b),
        or1.out.to(out.cout),
      ],
    });

    const sim = simulate(FullAdder);
    try {
      // 1 + 1 + 0 = 10
      sim.set({ a: 1, b: 1, cin: 0 });
      expect(sim.get('sum')).toBe(0);
      expect(sim.get('cout')).toBe(1);

      // 1 + 1 + 1 = 11
      sim.set({ a: 1, b: 1, cin: 1 });
      expect(sim.get('sum')).toBe(1);
      expect(sim.get('cout')).toBe(1);

      // 0 + 0 + 0 = 00
      sim.set({ a: 0, b: 0, cin: 0 });
      expect(sim.get('sum')).toBe(0);
      expect(sim.get('cout')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});

// ============================================================================
// Sequential circuits
// ============================================================================

describe('sequential circuits', () => {
  it('simulates a 2-bit counter', () => {
    const Counter2Bit = circuit('Counter2Bit', {
      out: { bit0: bit, bit1: bit },
      nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
      connect: ({ out, dff0, dff1, inv, xor1 }) => [
        dff0.q.to(inv.in, xor1.b, out.bit0),
        inv.out.to(dff0.d),
        dff1.q.to(xor1.a, out.bit1),
        xor1.out.to(dff1.d),
      ],
    });

    const sim = simulate(Counter2Bit);
    try {
      // Cycle 0
      expect(sim.get('bit0')).toBe(0);
      expect(sim.get('bit1')).toBe(0);

      // Cycle 1: 01
      sim.tick();
      expect(sim.get('bit0')).toBe(1);
      expect(sim.get('bit1')).toBe(0);

      // Cycle 2: 10
      sim.tick();
      expect(sim.get('bit0')).toBe(0);
      expect(sim.get('bit1')).toBe(1);

      // Cycle 3: 11
      sim.tick();
      expect(sim.get('bit0')).toBe(1);
      expect(sim.get('bit1')).toBe(1);

      // Cycle 4: back to 00
      sim.tick();
      expect(sim.get('bit0')).toBe(0);
      expect(sim.get('bit1')).toBe(0);
    } finally {
      sim.dispose();
    }
  });

  it('simulates a 4-bit shift register', () => {
    const ShiftRegister4 = circuit('ShiftRegister4', {
      in: { din: bit },
      out: { q0: bit, q1: bit, q2: bit, q3: bit },
      nodes: { ff0: DFlipFlop, ff1: DFlipFlop, ff2: DFlipFlop, ff3: DFlipFlop },
      connect: ({ in: inp, out, ff0, ff1, ff2, ff3 }) => [
        inp.din.to(ff0.d),
        ff0.q.to(ff1.d, out.q0),
        ff1.q.to(ff2.d, out.q1),
        ff2.q.to(ff3.d, out.q2),
        ff3.q.to(out.q3),
      ],
    });

    const sim = simulate(ShiftRegister4);
    try {
      // Drive din high, shift through
      sim.set({ din: 1 });
      sim.tick();
      expect(sim.get('q0')).toBe(1);
      expect(sim.get('q1')).toBe(0);

      sim.tick();
      expect(sim.get('q0')).toBe(1);
      expect(sim.get('q1')).toBe(1);

      sim.tick();
      expect(sim.get('q2')).toBe(1);

      sim.tick();
      expect(sim.get('q3')).toBe(1);
    } finally {
      sim.dispose();
    }
  });
});

// ============================================================================
// Reset and snapshot
// ============================================================================

describe('reset and snapshots', () => {
  it('reset returns the simulator to initial state', () => {
    const Counter2Bit = circuit('Counter2Bit', {
      out: { bit0: bit, bit1: bit },
      nodes: { dff0: DFlipFlop, dff1: DFlipFlop, inv: Not, xor1: Xor },
      connect: ({ out, dff0, dff1, inv, xor1 }) => [
        dff0.q.to(inv.in, xor1.b, out.bit0),
        inv.out.to(dff0.d),
        dff1.q.to(xor1.a, out.bit1),
        xor1.out.to(dff1.d),
      ],
    });

    const sim = simulate(Counter2Bit);
    try {
      sim.tick();
      sim.tick();
      sim.tick();
      expect(sim.get('bit0')).toBe(1);
      expect(sim.get('bit1')).toBe(1);

      sim.reset();
      expect(sim.get('bit0')).toBe(0);
      expect(sim.get('bit1')).toBe(0);
    } finally {
      sim.dispose();
    }
  });
});
