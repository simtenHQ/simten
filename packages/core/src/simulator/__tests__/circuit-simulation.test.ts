/**
 * End-to-end circuit simulation tests using the circuit() API.
 *
 * Circuit simulation tests. These verify the simulator
 * runs circuits correctly when defined with circuit().
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/simulate.js';
import {
  Adder,
  And,
  Comparator,
  Constant,
  DFlipFlop,
  Mux,
  Not,
  Or,
  Register,
  Xor,
} from '../../std/index.js';

// ============================================================================
// Combinational circuits
// ============================================================================

describe('combinational circuits', () => {
  it('simulates a half adder', () => {
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
        inputs.a.to(x1.a, a1.a),
        inputs.b.to(x1.b, a1.b),
        x1.out.to(outputs.sum),
        a1.out.to(outputs.carry),
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
      inputs: { a: bit, b: bit, sel: bit },
      outputs: { out: bit },
      nodes: { not1: Not, and1: And, and2: And, or1: Or },
      connect: ({ inputs, outputs, nodes: { not1, and1, and2, or1 } }) => [
        inputs.sel.to(not1.in, and2.b),
        inputs.a.to(and1.a),
        not1.out.to(and1.b),
        inputs.b.to(and2.a),
        and1.out.to(or1.a),
        and2.out.to(or1.b),
        or1.out.to(outputs.out),
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
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x1: Xor, a1: And },
      connect: ({ inputs, outputs, nodes: { x1, a1 } }) => [
        inputs.a.to(x1.a, a1.a),
        inputs.b.to(x1.b, a1.b),
        x1.out.to(outputs.sum),
        a1.out.to(outputs.carry),
      ],
    });

    const FullAdder = circuit('FullAdder', {
      inputs: { a: bit, b: bit, cin: bit },
      outputs: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or1: Or },
      connect: ({ inputs, outputs, nodes: { ha1, ha2, or1 } }) => [
        inputs.a.to(ha1.a),
        inputs.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inputs.cin.to(ha2.b),
        ha2.sum.to(outputs.sum),
        ha1.carry.to(or1.a),
        ha2.carry.to(or1.b),
        or1.out.to(outputs.cout),
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
      outputs: { bit0: bit, bit1: bit },
      nodes: { dff0: DFlipFlop(), dff1: DFlipFlop(), inv: Not, xor1: Xor },
      connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
        dff0.q.to(inv.in, xor1.b, outputs.bit0),
        inv.out.to(dff0.d),
        dff1.q.to(xor1.a, outputs.bit1),
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
      inputs: { din: bit },
      outputs: { q0: bit, q1: bit, q2: bit, q3: bit },
      nodes: { ff0: DFlipFlop(), ff1: DFlipFlop(), ff2: DFlipFlop(), ff3: DFlipFlop() },
      connect: ({ inputs, outputs, nodes: { ff0, ff1, ff2, ff3 } }) => [
        inputs.din.to(ff0.d),
        ff0.q.to(ff1.d, outputs.q0),
        ff1.q.to(ff2.d, outputs.q1),
        ff2.q.to(ff3.d, outputs.q2),
        ff3.q.to(outputs.q3),
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
      outputs: { bit0: bit, bit1: bit },
      nodes: { dff0: DFlipFlop(), dff1: DFlipFlop(), inv: Not, xor1: Xor },
      connect: ({ outputs, nodes: { dff0, dff1, inv, xor1 } }) => [
        dff0.q.to(inv.in, xor1.b, outputs.bit0),
        inv.out.to(dff0.d),
        dff1.q.to(xor1.a, outputs.bit1),
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
