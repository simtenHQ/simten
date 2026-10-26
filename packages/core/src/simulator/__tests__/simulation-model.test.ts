/**
 * The simulation model from decision 0002 (#427): every output is masked to
 * its port width, buses are at most 32 bits and read back unsigned, there is
 * one global rising-edge clock and anything else is a compile error, restore()
 * rewinds inputs and switches too, and the loop cap scales with the circuit.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit, mem, reg } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/types.js';
import { simulate } from '../../sim/simulate.js';
import { Buffer, DFlipFlop, Nand, Not, Switch } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { createSimulator, elaborate } from '../index.js';

/** Library of a built circuit and everything it depends on. */
function libraryOf(top: BuiltCircuit): CircuitLibrary {
  const byName = new Map<string, Circuit>();
  const add = (b: { circuit?: Circuit; _dependencies?: ReadonlyMap<string, unknown> }) => {
    if (!b?.circuit || byName.has(b.circuit.name)) return;
    byName.set(b.circuit.name, b.circuit);
    for (const dep of b._dependencies?.values() ?? []) add(dep as typeof b);
  };
  add(top);
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () => [...byName.keys()],
  };
}

function engineFor(top: BuiltCircuit) {
  const library = libraryOf(top);
  return createSimulator(elaborate(top.circuit, library), { componentLibrary: library });
}

describe('outputs are masked to their port width', () => {
  it('an unmasked add on an 8-bit port keeps the low 8 bits', () => {
    const Add8 = circuit('MaskAdd8', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { sum: bus(8) },
      eval: ({ a, b }) => ({ sum: a + b }),
    });
    const sim = simulate(Add8);
    try {
      sim.set({ a: 200, b: 100 });
      expect(sim.get('sum')).toBe(44);
    } finally {
      sim.dispose();
    }
  });

  it('a bit output keeps only bit 0', () => {
    const Wide = circuit('MaskBit', {
      inputs: { a: bus(8) },
      outputs: { y: bit },
      eval: ({ a }) => ({ y: a }),
    });
    const sim = simulate(Wide);
    try {
      sim.set({ a: 6 });
      expect(sim.get('y')).toBe(0);
      sim.set({ a: 7 });
      expect(sim.get('y')).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it('32-bit values read back unsigned, inside and out', () => {
    const Ones = circuit('Unsigned32', {
      inputs: { a: bus(32) },
      outputs: { y: bus(32), top: bit },
      // A JS bitwise result is signed; the port stores it unsigned, and the
      // next eval sees it unsigned too.
      eval: ({ a }) => ({ y: ~a, top: a >= 0x80000000 ? 1 : 0 }),
    });
    const sim = simulate(Ones);
    try {
      sim.set({ a: 0 });
      expect(sim.get('y')).toBe(0xffffffff);
      sim.set({ a: 0xffffffff });
      expect(sim.get('y')).toBe(0);
      expect(sim.get('top')).toBe(1);
    } finally {
      sim.dispose();
    }
  });

  it('a bus wider than 32 bits is a compile error suggesting a split', () => {
    const Wide = circuit('Wide64', {
      inputs: { a: bus(64) },
      outputs: { y: bus(64) },
      eval: ({ a }) => ({ y: a }),
    });
    expect(() => engineFor(Wide)).toThrow(/bus\(64\).*1 to 32 bits.*Split/);
  });
});

describe('one global rising-edge clock', () => {
  /** A fresh DFF-like primitive whose state block can be edited per test. */
  function flop(name: string) {
    return circuit(name, {
      inputs: { d: bit },
      outputs: { q: bit },
      state: { v: reg(1) },
      eval: ({ v }) => ({ q: v }),
      onTick: ({ d }) => ({ v: d }),
    });
  }

  it('a falling-edge state block is rejected, naming the node', () => {
    const Flop = flop('FallingFlop');
    Flop.circuit.state[0].edge = 'falling';
    const Top = circuit('FallingTop', {
      inputs: { d: bit },
      outputs: { q: bit },
      nodes: { ff: Flop },
      connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.d.to(ff.d), ff.q.to(outputs.q)],
    });
    expect(() => engineFor(Top)).toThrow(/Node 'ff' \(FallingFlop\).*falling clock edge/);
  });

  it('a state block on a clock other than its own is rejected', () => {
    const Flop = flop('GatedFlop');
    Flop.circuit.state[0].clockRef = 'gclk';
    const Top = circuit('GatedTop', {
      inputs: { d: bit },
      outputs: { q: bit },
      nodes: { ff: Flop },
      connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.d.to(ff.d), ff.q.to(outputs.q)],
    });
    expect(() => engineFor(Top)).toThrow(/Node 'ff' \(GatedFlop\).*'gclk'.*Gated or derived/);
  });

  it('a component with two clocks is rejected', () => {
    const Flop = flop('TwoClockFlop');
    Flop.circuit.clocks.push({ name: 'clk2' });
    const Top = circuit('TwoClockTop', {
      inputs: { d: bit },
      outputs: { q: bit },
      nodes: { ff: Flop },
      connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.d.to(ff.d), ff.q.to(outputs.q)],
    });
    expect(() => engineFor(Top)).toThrow(/Node 'ff' \(TwoClockFlop\) declares 2 clocks/);
  });
});

describe('restore', () => {
  it('rewinds top-level inputs', () => {
    const Latch = circuit('RestoreInputs', {
      inputs: { d: bit },
      outputs: { q: bit },
      nodes: { ff: DFlipFlop() },
      connect: ({ inputs, outputs, nodes: { ff } }) => [inputs.d.to(ff.d), ff.q.to(outputs.q)],
    });
    const engine = engineFor(Latch);
    engine.setNode('d', 0);
    engine.tick();
    const snap = engine.snapshot();
    engine.setNode('d', 1);
    engine.tick();
    expect(engine.getOutput('__top__', 'q')).toBe(1);

    engine.restore(snap);
    engine.tick();
    expect(engine.getOutput('__top__', 'q')).toBe(0);
  });

  it('a switch first set after the snapshot goes back to its default', () => {
    const Top = circuit('RestoreLateSwitch', {
      outputs: { q: bit },
      nodes: { sw: Switch, ff: DFlipFlop() },
      connect: ({ outputs, nodes: { sw, ff } }) => [sw.out.to(ff.d), ff.q.to(outputs.q)],
    });
    const engine = engineFor(Top);
    const snap = engine.snapshot();
    engine.setNode('sw', 1);
    engine.tick();
    expect(engine.getOutput('__top__', 'q')).toBe(1);

    engine.restore(snap);
    engine.tick();
    expect(engine.getOutput('__top__', 'q')).toBe(0);
  });

  it('snapshots do not share the clocks map', () => {
    const engine = engineFor(DFlipFlop());
    engine.tick();
    const a = engine.snapshot();
    const b = engine.snapshot();
    expect(a.sequentialState.clocks).not.toBe(b.sequentialState.clocks);
    engine.restore(a);
    expect(engine.snapshot().sequentialState.clocks).not.toBe(a.sequentialState.clocks);
  });

  it('an in-place write to memory in a multi-block state does not rewrite history', () => {
    const Logger = circuit('MultiBlockLogger', {
      inputs: { d: bus(8) },
      outputs: { count: bus(8) },
      state: { log: mem(16, 8), n: reg(8) },
      eval: ({ n }) => ({ count: n }),
      onTick: ({ d, log, n }) => {
        log[n] = d;
        return { log, n: (n + 1) & 0xff };
      },
    });
    const engine = engineFor(Logger);
    engine.setNode('d', 11);
    engine.tick();
    const snap = engine.snapshot();
    // The logger is the only stateful node, so its state is the only entry.
    const logAt = (s: typeof snap) => {
      const [state] = [...s.sequentialState.currentState.values()];
      return (state as unknown as { log: Map<number, number> }).log;
    };
    expect(logAt(snap).get(0)).toBe(11);
    expect(logAt(snap).has(1)).toBe(false);

    engine.setNode('d', 22);
    engine.tick();
    expect(logAt(engine.snapshot()).get(1)).toBe(22);
    // The earlier snapshot still has only the first write.
    expect(logAt(snap).has(1)).toBe(false);
  });
});

describe('propagation loop cap', () => {
  it('an oscillating ring of inverters fails with a clear error', () => {
    // A three-inverter ring with a Nand as the first stage, so it settles while
    // `en` is low and oscillates once it goes high.
    const Ring = circuit('InverterRing', {
      inputs: { en: bit },
      outputs: { y: bit },
      nodes: { n1: Nand, n2: Not, n3: Not },
      connect: ({ inputs, outputs, nodes: { n1, n2, n3 } }) => [
        inputs.en.to(n1.a),
        n1.out.to(n2.in),
        n2.out.to(n3.in),
        n3.out.to(n1.b, outputs.y),
      ],
    });
    const engine = engineFor(Ring);
    engine.setNode('en', 1);
    expect(engine.runCombinational().error).toMatch(
      /did not stabilize after 10000 evaluations.*oscillating.*Still changing: n\d/,
    );

    const ticking = engineFor(Ring);
    ticking.setNode('en', 1);
    expect(() => ticking.tick()).toThrow(/oscillating/);
  });

  it('a large stable circuit does not trip the cap', () => {
    // 20 000 buffers in a chain: one evaluation each, twice the old fixed cap.
    const length = 20000;
    const nodes: Record<string, typeof Buffer> = {};
    for (let i = 0; i < length; i++) nodes[`b${i}`] = Buffer;
    const Chain = circuit('LongBufferChain', {
      inputs: { a: bit },
      outputs: { y: bit },
      nodes,
      connect: ({ inputs, outputs, nodes }: any) => {
        const c = [inputs.a.to(nodes.b0.in)];
        for (let i = 0; i < length - 1; i++) c.push(nodes[`b${i}`].out.to(nodes[`b${i + 1}`].in));
        c.push(nodes[`b${length - 1}`].out.to(outputs.y));
        return c;
      },
    });
    const engine = engineFor(Chain);
    engine.setNode('a', 1);
    expect(engine.runCombinational().error).toBeUndefined();
    expect(engine.getOutput('__top__', 'y')).toBe(1);
  });
});
