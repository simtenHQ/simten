/**
 * Tests for the typed simulate() API.
 *
 * Verifies end-to-end: circuit() → simulate() → set/get/tick/run/snapshot/reset
 * running through the real simulation pipeline.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { simulate } from '../simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { And, Or, Xor, Not, Register, DFlipFlop, Led, Switch } from '../../std/index.js';
import type { SimulationHandle } from '../simulate.js';

// Track handles for cleanup
const handles: SimulationHandle[] = [];
function tracked<I, O>(h: SimulationHandle<I, O>): SimulationHandle<I, O> {
  handles.push(h as any);
  return h;
}
afterEach(() => {
  handles.forEach(h => h.dispose());
  handles.length = 0;
});

// ============================================================================
// Combinational circuits
// ============================================================================

describe('combinational circuits', () => {
  it('simulates a single AND gate', () => {
    const sim = tracked(simulate(And));

    sim.set({ a: 0, b: 0 });
    expect(sim.get('out')).toBe(0);

    sim.set({ a: 1, b: 0 });
    expect(sim.get('out')).toBe(0);

    sim.set({ a: 1, b: 1 });
    expect(sim.get('out')).toBe(1);

    expect(sim.isSequential).toBe(false);
  });

  it('simulates a single XOR gate', () => {
    const sim = tracked(simulate(Xor));

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

    const sim = tracked(simulate(HalfAdder));

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

    const sim = tracked(simulate(ReLU));

    sim.set({ x: 5 });
    expect(sim.get('y')).toBe(5);

    sim.set({ x: 0 });
    expect(sim.get('y')).toBe(0);
  });

  it('read() returns all outputs', () => {
    const sim = tracked(simulate(And));
    sim.set({ a: 1, b: 1 });
    expect(sim.read()).toEqual({ out: 1 });
  });
});

// ============================================================================
// Sequential circuits
// ============================================================================

describe('sequential circuits', () => {
  it('simulates a DFlipFlop', () => {
    const sim = tracked(simulate(DFlipFlop()));

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
    const sim = tracked(simulate(Register()));

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

  it('tickN advances multiple cycles', () => {
    const sim = tracked(simulate(DFlipFlop()));
    sim.set({ d: 1 });
    sim.tickN(5);
    expect(sim.cycle).toBe(5);
  });

  it('reset returns to initial state', () => {
    const sim = tracked(simulate(DFlipFlop()));

    sim.set({ d: 1 });
    sim.tick();
    sim.tick();
    expect(sim.cycle).toBe(2);

    sim.reset();
    expect(sim.cycle).toBe(0);
  });
});

// ============================================================================
// Snapshot / restore
// ============================================================================

describe('snapshot and restore', () => {
  it('saves and restores state', () => {
    const sim = tracked(simulate(DFlipFlop()));

    sim.set({ d: 1 });
    sim.tick();
    const snap = sim.snapshot();
    expect(sim.get('q')).toBe(1);

    // Advance further
    sim.set({ d: 0 });
    sim.tick();
    expect(sim.get('q')).toBe(0);

    // Restore
    sim.restore(snap);
    expect(sim.get('q')).toBe(1);
  });
});

// ============================================================================
// Watch
// ============================================================================

describe('watch', () => {
  it('notifies on state changes', () => {
    const sim = tracked(simulate(DFlipFlop()));
    let callCount = 0;
    const unsub = sim.watch(() => { callCount++; });

    sim.set({ d: 1 });
    sim.tick();
    expect(callCount).toBeGreaterThan(0);

    unsub();
  });

  it('watchPort notifies when specific port changes', () => {
    const sim = tracked(simulate(DFlipFlop()));
    const values: number[] = [];
    const unsub = sim.watchPort('q', (v) => { values.push(v); });

    sim.set({ d: 1 });
    sim.tick(); // q changes 0→1

    sim.set({ d: 1 });
    sim.tick(); // q stays 1 — should not notify

    sim.set({ d: 0 });
    sim.tick(); // q changes 1→0

    expect(values).toEqual([1, 0]);

    unsub();
  });
});

// ============================================================================
// Auto-run
// ============================================================================

describe('auto-run', () => {
  it('starts and stops', () => {
    const sim = tracked(simulate(DFlipFlop()));
    expect(sim.isRunning).toBe(false);

    sim.run({ speed: 100 });
    expect(sim.isRunning).toBe(true);

    sim.stop();
    expect(sim.isRunning).toBe(false);
  });
});
