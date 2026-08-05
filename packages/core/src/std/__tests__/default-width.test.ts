/**
 * A bare `Adder()` must keep its own 8-bit default even when a 32-bit Adder is
 * defined after it.
 *
 * The eval registry keys by component NAME and last write wins, so there is one
 * registered lambda per name no matter how many widths get instantiated, and
 * the simulator resolves it at `simulate()` time. An eval whose width default
 * read the factory closure — `width: w = width` — therefore handed every bare
 * instance the width of whichever instance was defined LAST.
 *
 * `@simten/core/std` re-exports rv32i-cpu.ts, which defines `Adder({ width: 32 })`
 * at module scope, so a bundler that ordered the stdlib after the app silently
 * widened every bare Adder in the app: 6 + 255 stopped wrapping to 5 and read
 * as 261. That is what made Pong's paddle jump to the top on the -1 (0xFF)
 * delta while +1 behaved. Module evaluation order differs between bundler and
 * node, which is why it reproduced in the browser and not in tests.
 *
 * The layout below reproduces that order: the bare instances are built at
 * module scope FIRST, the wide ones registered after, and only then does a test
 * body simulate. Building the bare instance inside the test body instead would
 * make it the last write and hide the bug.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { Adder, Subtractor } from '../arithmetic.js';
import { Concat } from '../routing.js';

const bareAdder = circuit('BareAdderTop', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { sum: bus(8), carry_out: bit },
  nodes: { add: Adder() },
  connect: ({ inputs, outputs, nodes: { add } }: any) => [
    inputs.a.to(add.a),
    inputs.b.to(add.b),
    add.sum.to(outputs.sum),
    add.carry_out.to(outputs.carry_out),
  ],
} as any);

const bareSubtractor = circuit('BareSubtractorTop', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { difference: bus(8), borrow_out: bit },
  nodes: { sub: Subtractor() },
  connect: ({ inputs, outputs, nodes: { sub } }: any) => [
    inputs.a.to(sub.a),
    inputs.b.to(sub.b),
    sub.difference.to(outputs.difference),
    sub.borrow_out.to(outputs.borrow_out),
  ],
} as any);

const bareConcat = circuit('BareConcatTop', {
  inputs: { high: bus(4), low: bus(4) },
  outputs: { out: bus(8) },
  nodes: { cat: Concat() },
  connect: ({ inputs, outputs, nodes: { cat } }: any) => [
    inputs.high.to(cat.high),
    inputs.low.to(cat.low),
    cat.out.to(outputs.out),
  ],
} as any);

// The last write for each name — what importing the stdlib does to a bundle.
Adder({ width: 32 });
Subtractor({ width: 32 });
Concat({ hiWidth: 32, loWidth: 32 });

describe('bare stdlib factories keep their own default width', () => {
  it('Adder() wraps at 8 bits: 6 + 255 = 5 carry 1', () => {
    const sim = simulate(bareAdder);
    sim.set({ a: 6, b: 255 });
    expect(sim.get('sum')).toBe(5);
    expect(sim.get('carry_out')).toBe(1);
    sim.dispose();
  });

  it('Subtractor() wraps at 8 bits: 5 - 6 = 255 borrow 1', () => {
    const sim = simulate(bareSubtractor);
    sim.set({ a: 5, b: 6 });
    expect(sim.get('difference')).toBe(255);
    expect(sim.get('borrow_out')).toBe(1);
    sim.dispose();
  });

  it('Concat() shifts the high half by its own 4-bit low half', () => {
    const sim = simulate(bareConcat);
    sim.set({ high: 0xa, low: 0x5 });
    expect(sim.get('out')).toBe(0xa5);
    sim.dispose();
  });
});
