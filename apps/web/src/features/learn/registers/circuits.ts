/**
 * Circuit definitions for the "Registers" learn page.
 *
 * DFlipFlop and Register come straight from the stdlib — they're already
 * the primitives the page is teaching, so we use them directly via the
 * embed's auto-harness rather than wrapping them. The Counter circuit
 * does need a definition because it's a feedback composition (Register
 * + Adder + Constant loop) that demonstrates the capstone "first useful
 * sequential circuit" idea.
 */

import { circuit, bus } from "@simten/core/circuit";
import { Register, Adder, Constant } from "@simten/core/std";

// ── Counter: Register + Adder loop ─────────────────────────────────────
// Each tick, the register's current value flows through the adder
// (+1, with carry-in tied low), and the result feeds back into the
// register's data input. write-enable is held high so every tick
// captures the new value.
export const Counter = circuit("Counter", {
  outputs: { count: bus(8) },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(outputs.count),
  ],
});
