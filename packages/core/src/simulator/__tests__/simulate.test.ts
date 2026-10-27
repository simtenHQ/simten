/**
 * Tests for `simulate()` and the `Simulation` it returns.
 *
 * Verifies end-to-end: circuit() → simulate() → set/get/tick/snapshot/reset and
 * history, running through the real simulation pipeline, plus the node-level
 * view `nodesOf` gives the sandbox and tests.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { And, Console, Constant, DFlipFlop, Not, Register, Xor } from '../../std/index.js';
import { simulate } from '../simulate.js';
import { nodesOf, type Simulation } from '../simulation.js';

// ============================================================================
// Fixtures
// ============================================================================

const Inc8 = circuit('Inc8', {
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => ({ y: (a + 1) & 0xff }),
});

/** Free-running counter: q ← q + 1 every edge. */
const Counter = circuit('SimCounter', {
  outputs: { q: bus(8) },
  nodes: {
    reg: Register(),
    inc: Inc8,
    on: Constant({ value: 1 }),
  },
  connect: ({ outputs, nodes: { reg, inc, on } }) => [
    reg.q.to(inc.a, outputs.q),
    inc.y.to(reg.data),
    on.out.to(reg.we),
  ],
});

/** A register whose input also feeds an output combinationally. */
const Passthrough = circuit('SimPassthrough', {
  inputs: { d: bus(8), we: bit },
  outputs: { q: bus(8), inverted: bit },
  nodes: { reg: Register(), not: Not },
  connect: ({ inputs, outputs, nodes: { reg, not } }) => [
    inputs.d.to(reg.data),
    inputs.we.to(reg.we, not.in),
    reg.q.to(outputs.q),
    not.out.to(outputs.inverted),
  ],
});

const Terminal = circuit('SimTerminal', {
  inputs: { ch: bus(8), we: bit },
  outputs: {},
  nodes: { con: Console },
  connect: ({ inputs, nodes: { con } }) => [inputs.ch.to(con.data), inputs.we.to(con.we)],
});

function counterWithHistory(history: number): Simulation {
  const sim = simulate(Counter, { history });
  nodesOf(sim).set('reg', 0);
  return sim;
}

// ============================================================================
// Combinational circuits
// ============================================================================

describe('combinational circuits', () => {
  it('simulates a single AND gate', () => {
    const sim = simulate(And);

    sim.set({ a: 0, b: 0 });
    expect(sim.get('out')).toBe(0);

    sim.set({ a: 1, b: 0 });
    expect(sim.get('out')).toBe(0);

    sim.set({ a: 1, b: 1 });
    expect(sim.get('out')).toBe(1);

    expect(sim.isSequential).toBe(false);
  });

  it('simulates a single XOR gate', () => {
    const sim = simulate(Xor);

    sim.set({ a: 0, b: 0 });
    expect(sim.get('out')).toBe(0);

    sim.set({ a: 1, b: 0 });
    expect(sim.get('out')).toBe(1);

    sim.set({ a: 0, b: 1 });
    expect(sim.get('out')).toBe(1);

    sim.set({ a: 1, b: 1 });
    expect(sim.get('out')).toBe(0);
  });

  it('simulates a HalfAdder composite', () => {
    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x: Xor, a: And },
      connect: ({ inputs, outputs, nodes: { x, a } }) => [
        inputs.a.to(x.a, a.a),
        inputs.b.to(x.b, a.b),
        x.out.to(outputs.sum),
        a.out.to(outputs.carry),
      ],
    });

    const sim = simulate(HalfAdder);

    sim.set({ a: 0, b: 0 });
    expect(sim.read()).toEqual({ sum: 0, carry: 0 });

    sim.set({ a: 1, b: 0 });
    expect(sim.read()).toEqual({ sum: 1, carry: 0 });

    sim.set({ a: 0, b: 1 });
    expect(sim.read()).toEqual({ sum: 1, carry: 0 });

    sim.set({ a: 1, b: 1 });
    expect(sim.read()).toEqual({ sum: 0, carry: 1 });
  });

  it('simulates a user-defined eval component', () => {
    const ReLU = circuit('ReLU', {
      inputs: { x: bus(16) },
      outputs: { y: bus(16) },
      eval: ({ x }) => ({ y: x > 0 ? x : 0 }),
    });

    const sim = simulate(ReLU);

    sim.set({ x: 5 });
    expect(sim.get('y')).toBe(5);

    sim.set({ x: 0 });
    expect(sim.get('y')).toBe(0);
  });

  it('read() returns all outputs', () => {
    const sim = simulate(And);
    sim.set({ a: 1, b: 1 });
    expect(sim.read()).toEqual({ out: 1 });
  });

  it('tick settles and leaves the cycle at 0', () => {
    const sim = simulate(And);
    sim.set({ a: 1, b: 1 });
    sim.tick(5);
    expect(sim.get('out')).toBe(1);
    expect(sim.cycle).toBe(0);
  });
});

// ============================================================================
// Exact names
// ============================================================================

describe('exact names', () => {
  /** Counter one level down: its `q` port is `inner.q`, not a top-level port. */
  const Wrapped = circuit('SimWrapped', {
    inputs: { en: bit },
    outputs: { ready: bit },
    nodes: { inner: Counter, not: Not },
    connect: ({ inputs, outputs, nodes: { not } }) => [
      inputs.en.to(not.in),
      not.out.to(outputs.ready),
    ],
  });

  it('get throws for a name that is not a top-level output, listing the outputs', () => {
    const sim: Simulation = simulate(Wrapped);
    expect(() => sim.get('q')).toThrow(
      "get('q'): SimWrapped has no output named 'q'. Its outputs: ready",
    );
    expect(() => sim.get('en')).toThrow(/no output named 'en'/);
  });

  it('set throws for a name that is not a top-level input, listing the inputs', () => {
    const sim: Simulation = simulate(Passthrough);
    expect(() => sim.set({ dd: 1 })).toThrow(
      "set('dd'): SimPassthrough has no input named 'dd'. Its inputs: d, we",
    );
    expect(() => sim.set({ reg: 1 })).toThrow(/no input named 'reg'/);
  });

  it('a set with one unknown name writes none of them', () => {
    const sim: Simulation = simulate(Passthrough);
    expect(() => sim.set({ we: 1, dd: 1 })).toThrow(/no input named 'dd'/);
    expect(sim.get('inverted')).toBe(1);
  });

  it('a circuit with no inputs says so', () => {
    const sim: Simulation = simulate(Counter);
    expect(() => sim.set({ q: 1 })).toThrow('Its inputs: (none)');
  });

  it('nodesOf(sim).set takes an exact path and names the paths a short name matches', () => {
    const sim = simulate(Wrapped);
    nodesOf(sim).set('inner.reg', 5);
    expect(nodesOf(sim).ports().get('inner.reg.q')).toBe(5);
    expect(() => nodesOf(sim).set('reg', 1)).toThrow(
      'setNode: "reg" is not a top-level input or a node path. Inputs: en. Nodes ending in "reg": inner.reg.',
    );
    expect(() => nodesOf(sim).set('nope', 1)).toThrow(/"nope" is not a top-level input/);
  });
});

// ============================================================================
// Sequential circuits
// ============================================================================

describe('sequential circuits', () => {
  it('simulates a DFlipFlop', () => {
    const sim = simulate(DFlipFlop());

    expect(sim.isSequential).toBe(true);
    expect(sim.cycle).toBe(0);

    // Set D=1, tick (rising edge captures)
    sim.set({ d: 1 });
    sim.tick();
    expect(sim.get('q')).toBe(1);
    expect(sim.cycle).toBe(1);

    // Set D=0, tick
    sim.set({ d: 0 });
    sim.tick();
    expect(sim.get('q')).toBe(0);
    expect(sim.cycle).toBe(2);
  });

  it('simulates a Register', () => {
    const sim = simulate(Register());

    // Write enable off — data doesn't capture
    sim.set({ data: 42, we: 0 });
    sim.tick();
    expect(sim.get('q')).toBe(0); // initial state

    // Write enable on — data captures
    sim.set({ data: 42, we: 1 });
    sim.tick();
    expect(sim.get('q')).toBe(42);

    // New data without WE — holds previous value
    sim.set({ data: 99, we: 0 });
    sim.tick();
    expect(sim.get('q')).toBe(42);
  });

  it('tick(n) advances n cycles', () => {
    const sim = simulate(DFlipFlop());
    sim.set({ d: 1 });
    sim.tick(5);
    expect(sim.cycle).toBe(5);
    expect(sim.get('q')).toBe(1);
  });

  it('get after set returns the settled value, before any tick', () => {
    const sim = simulate(Passthrough);
    expect(sim.get('inverted')).toBe(1);

    sim.set({ d: 7, we: 1 });
    // The combinational path follows the write; the register waits for the edge.
    expect(sim.get('inverted')).toBe(0);
    expect(sim.get('q')).toBe(0);
    expect(sim.cycle).toBe(0);

    sim.tick();
    expect(sim.read()).toEqual({ q: 7, inverted: 0 });
  });

  it('reset returns to initial state', () => {
    const sim = simulate(DFlipFlop());

    sim.set({ d: 1 });
    sim.tick();
    sim.tick();
    expect(sim.cycle).toBe(2);

    sim.reset();
    expect(sim.cycle).toBe(0);
    expect(sim.get('q')).toBe(0);
  });
});

// ============================================================================
// Snapshot / restore
// ============================================================================

describe('snapshot and restore', () => {
  it('saves and restores state', () => {
    const sim = simulate(DFlipFlop());

    sim.set({ d: 1 });
    sim.tick();
    const snap = sim.snapshot();
    expect(sim.get('q')).toBe(1);

    // Advance further
    sim.set({ d: 0 });
    sim.tick();
    expect(sim.get('q')).toBe(0);
    expect(sim.cycle).toBe(2);

    // Restore
    sim.restore(snap);
    expect(sim.get('q')).toBe(1);
    expect(sim.cycle).toBe(1);
  });
});

// ============================================================================
// History
// ============================================================================

describe('history', () => {
  it('is off by default: nothing to step to', () => {
    const sim = simulate(DFlipFlop());
    sim.set({ d: 1 });
    sim.tick(3);
    expect(sim.history).toEqual({ length: 0, index: -1 });
    expect(sim.stepBack()).toBe(false);
    expect(sim.stepForward()).toBe(false);
    expect(sim.seek(0)).toBe(false);
    expect(sim.get('q')).toBe(1);
    expect(sim.cycle).toBe(3);
  });

  it('records the start and one entry per tick call', () => {
    const sim = counterWithHistory(10);
    expect(sim.history).toEqual({ length: 1, index: 0 });
    sim.tick();
    sim.tick(100);
    expect(sim.history).toEqual({ length: 3, index: 2 });
    expect(sim.cycle).toBe(101);

    expect(sim.stepBack()).toBe(true);
    expect(sim.cycle).toBe(1);
    expect(sim.get('q')).toBe(1);
    expect(sim.stepBack()).toBe(true);
    expect(sim.cycle).toBe(0);
    expect(sim.get('q')).toBe(0);
    expect(sim.stepBack()).toBe(false);

    expect(sim.stepForward()).toBe(true);
    expect(sim.stepForward()).toBe(true);
    expect(sim.get('q')).toBe(101);
    expect(sim.stepForward()).toBe(false);
  });

  it('seek jumps to an index and rejects ones out of range', () => {
    const sim = counterWithHistory(10);
    for (let i = 0; i < 4; i++) sim.tick();
    expect(sim.seek(-1)).toBe(false);
    expect(sim.seek(5)).toBe(false);
    expect(sim.seek(1.5)).toBe(false);
    expect(sim.history.index).toBe(4);
    expect(sim.seek(2)).toBe(true);
    expect(sim.get('q')).toBe(2);
    expect(sim.history).toEqual({ length: 5, index: 2 });
  });

  it('ticking after a step back drops the steps ahead', () => {
    const sim = counterWithHistory(10);
    for (let i = 0; i < 5; i++) sim.tick();
    sim.seek(2);
    sim.tick(10);
    expect(sim.history).toEqual({ length: 4, index: 3 });
    expect(sim.get('q')).toBe(12);
    expect(sim.stepForward()).toBe(false);
  });

  it('keeps at most `history` entries, dropping the oldest', () => {
    const sim = counterWithHistory(3);
    for (let i = 0; i < 5; i++) sim.tick();
    expect(sim.history).toEqual({ length: 3, index: 2 });
    sim.seek(0);
    expect(sim.get('q')).toBe(3);
  });

  it('reset starts history over from cycle 0', () => {
    const sim = counterWithHistory(10);
    sim.tick(3);
    sim.reset();
    expect(sim.history).toEqual({ length: 1, index: 0 });
    expect(sim.stepBack()).toBe(false);
  });

  it('rewinds inputs along with state', () => {
    const sim = simulate(Register(), { history: 10 });
    sim.set({ data: 5, we: 1 });
    sim.tick();
    sim.set({ data: 9, we: 1 });
    sim.tick();
    sim.stepBack();
    // The inputs from entry 1 come back, so the next edge captures 5 again.
    sim.tick();
    expect(sim.get('q')).toBe(5);
  });

  it('a combinational circuit records nothing', () => {
    const sim = simulate(And, { history: 10 });
    sim.set({ a: 1, b: 1 });
    sim.tick();
    expect(sim.history).toEqual({ length: 0, index: -1 });
  });
});

// ============================================================================
// nodesOf
// ============================================================================

describe('nodesOf', () => {
  it('writes a register by path and settles before the next read', () => {
    const sim = simulate(Counter);
    nodesOf(sim).set('reg', 41);
    expect(sim.get('q')).toBe(41);
    sim.tick();
    expect(sim.get('q')).toBe(42);
  });

  it('reads internal ports by path', () => {
    const sim = simulate(Counter);
    nodesOf(sim).set('reg', 9);
    const ports = nodesOf(sim).ports();
    expect(ports.get('reg.q')).toBe(9);
    expect(ports.get('inc.y')).toBe(10);
    expect(ports.get('__top__.q')).toBe(9);
  });

  it('advance then record is tick(n): one history entry', () => {
    const a = counterWithHistory(10);
    const b = counterWithHistory(10);
    a.tick(7);
    nodesOf(b).advance(3);
    nodesOf(b).advance(4);
    expect(b.history).toEqual({ length: 1, index: 0 });
    nodesOf(b).record();
    expect(b.history).toEqual(a.history);
    expect(b.cycle).toBe(a.cycle);
    expect(b.read()).toEqual(a.read());
  });

  it('reports peripheral-bus state', () => {
    const sim = simulate(Terminal);
    expect(nodesOf(sim).peripherals().get('con')).toBe('');
    sim.set({ ch: 72, we: 1 });
    sim.tick();
    sim.set({ ch: 105 });
    sim.tick();
    expect(nodesOf(sim).peripherals().get('con')).toBe('Hi');
  });

  it('throws for an object simulate() did not make', () => {
    const fake = { ...simulate(And) };
    expect(() => nodesOf(fake)).toThrow(/isn't a Simulation/);
  });
});
