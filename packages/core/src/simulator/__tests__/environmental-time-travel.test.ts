/**
 * Environmental State Time-Travel
 *
 * The simulator engine's `snapshot()` / `restore()` round-trips SEQUENTIAL
 * state (registers, flip-flops, memory) and port values — but it does NOT
 * revert `node.arguments`. Switch / Button / Input primitives drive their
 * outputs from `node.arguments.value`, which mutates on `setNode`. So a
 * naive time-travel that only restores the engine leaves stale switch
 * positions, and the next tick would use the wrong input.
 *
 * The complete host-side recipe is engine restore + `captureEnvironmentalState`
 * / `restoreEnvironmentalState` (walks `metadata.interactiveArg` to find
 * which node args to snapshot). This test locks in both halves:
 *
 *   1. engine-only restore leaves switch ON when it should be OFF (the bug)
 *   2. pairing engine restore with environmental restore reproduces the
 *      original trace (the fix)
 *
 * The shift-register time-travel demo on the landing page relies on this
 * invariant: if sandbox-side restore skips env state, the visible switch
 * desyncs from actual circuit behavior.
 */

import { describe, expect, it } from 'vitest';
import { bit, circuit } from '../../circuit/index.js';
import { DFlipFlop, Switch } from '../../std/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import type { FlatCircuit } from '../../types/simulator.js';
import { captureEnvironmentalState, createSimulator, elaborate } from '../index.js';

/**
 * Walk a FlatCircuit's nodes and capture every interactive-arg value (Switch/
 * Button/Input). Analogous to core's `captureEnvironmentalState` but works on
 * post-elaboration FlatNode (`primitiveType`) instead of pre-elaboration Node
 * (`componentRef`). This is the pattern the sandbox uses.
 */
function captureFlatEnv(flat: FlatCircuit, library: CircuitLibrary): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const node of flat.nodes) {
    const def = library.resolveCircuit(node.primitiveType);
    const interactiveArg = def?.metadata?.interactiveArg;
    if (!interactiveArg) continue;
    result.set(node.id, node.arguments[interactiveArg]);
  }
  return result;
}

const SwitchedFF = circuit('SwitchedFF', {
  outputs: { q: bit },
  nodes: { sw: Switch(), dff: DFlipFlop() },
  connect: ({ outputs, nodes: { sw, dff } }) => [sw.out.to(dff.d), dff.q.to(outputs.q)],
});

function buildSim() {
  const circuitMap = new Map<string, Circuit>();
  const library: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  library.addCircuit(SwitchedFF.circuit);
  library.addCircuit(Switch().circuit);
  library.addCircuit(DFlipFlop().circuit);
  for (const [, dep] of SwitchedFF._dependencies) {
    library.addCircuit(dep.circuit);
  }

  const flat = elaborate(SwitchedFF.circuit, library);
  const sim = createSimulator(flat, { componentLibrary: library });
  return { sim, flat, library };
}

function qOut(sim: ReturnType<typeof createSimulator>): boolean {
  // Top-level output 'q' is wired to dff.q. The simulator exposes it via the
  // top-level alias under __top__.
  const v = sim.getOutput('__top__', 'q');
  return Boolean(v);
}

describe('environmental state time-travel', () => {
  // Regression: the sandbox (apps/sandbox/src/main.ts) previously fed its
  // post-elaboration FlatCircuit into core's captureEnvironmentalState and
  // walked FlatNodes as if they had `componentRef`. Silent failure mode: the
  // returned map was empty, so restore re-applied nothing and the UI's Switch
  // stayed stuck at whatever it was before rewind. This pins the mismatch.
  it('captureEnvironmentalState on a FlatCircuit silently returns empty (regression)', () => {
    const { sim, flat, library } = buildSim();
    sim.setNode('sw', true);
    sim.tick();

    // FlatNode has primitiveType, not componentRef — captureEnvironmentalState
    // reads componentRef and finds nothing. This is the behaviour that broke
    // the sandbox; assert it so future refactors don't mistakenly believe the
    // core helper works on FlatCircuits.
    const wrongWay = captureEnvironmentalState(flat as unknown as Circuit, library);
    expect(wrongWay.size).toBe(0);

    // The correct walk (primitiveType, the pattern in our captureFlatEnv
    // helper and now in the sandbox) captures the switch state.
    const rightWay = captureFlatEnv(flat, library);
    expect(rightWay.get('sw')).toBe(true);
  });

  it('engine-only restore leaves stale Switch value (the bug)', () => {
    const { sim } = buildSim();
    try {
      // Tick once with switch at its default (OFF) — DFF latches 0.
      sim.tick();
      const snap = sim.snapshot();
      expect(qOut(sim)).toBe(false);

      // Flip switch ON, tick — DFF latches 1.
      sim.setNode('sw', true);
      sim.tick();
      expect(qOut(sim)).toBe(true);

      // Engine-only restore. DFF state reverts to 0, but Switch's node
      // argument is still ON — the engine never touched it.
      sim.restore(snap);
      sim.runCombinational();
      expect(qOut(sim)).toBe(false); // DFF reverted correctly

      // Ticking again should (in a true rewind) reproduce the original
      // trace: switch was OFF, DFF latches 0. But with the stale switch
      // argument still ON, the DFF latches 1 — proving the bug.
      sim.tick();
      expect(qOut(sim)).toBe(true); // BUG: should be false if switch really reverted
    } finally {
      // SimulatorEngine has no dispose — it's a plain object.
    }
  });

  it('engine + environmental restore reproduces the trace (the fix)', () => {
    const { sim, flat, library } = buildSim();
    try {
      // Tick with switch OFF, capture BOTH halves.
      sim.tick();
      const simSnap = sim.snapshot();
      const envSnap = captureFlatEnv(flat, library);
      expect(qOut(sim)).toBe(false);

      // Flip switch, tick — circuit follows a different trajectory.
      sim.setNode('sw', true);
      sim.tick();
      expect(qOut(sim)).toBe(true);

      // Full restore: engine THEN environmental state.
      //
      // Two subtleties the host must get right:
      //   (a) The sim caches node-argument values in its numeric buffer at
      //       eval time. Mutating `node.arguments` alone doesn't invalidate
      //       that cache — only `sim.setNode` does. So the host must route
      //       env restores through setNode, not through the default
      //       callback `restoreEnvironmentalState` suggests.
      //   (b) `captureEnvironmentalState` stores `undefined` when a node's
      //       interactive arg was never set (initial Switch state). We
      //       can't pass undefined to setNode — substitute 0 (universal
      //       off for Switch/Button/Input primitives).
      //
      // These rules are replicated in apps/sandbox/src/main.ts handleRestore.
      sim.restore(simSnap);
      for (const node of flat.nodes) {
        const def = library.resolveCircuit(node.primitiveType);
        const interactiveArg = def?.metadata?.interactiveArg;
        if (!interactiveArg) continue;
        const saved = envSnap.get(node.id);
        const value = saved === undefined ? 0 : saved;
        sim.setNode(node.id, value as number | boolean);
      }
      sim.runCombinational();
      expect(qOut(sim)).toBe(false);

      // Now the ticks reproduce the original OFF trajectory.
      sim.tick();
      expect(qOut(sim)).toBe(false);

      // And a subsequent flip + tick moves forward as expected.
      sim.setNode('sw', true);
      sim.tick();
      expect(qOut(sim)).toBe(true);
    } finally {
      // SimulatorEngine has no dispose — it's a plain object.
    }
  });
});
