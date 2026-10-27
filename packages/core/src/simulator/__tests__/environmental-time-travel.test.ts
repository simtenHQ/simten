/**
 * Environmental State Time-Travel
 *
 * Switch / Input primitives drive their outputs from `node.arguments.value`,
 * which `setNode` writes. The engine's `snapshot()` / `restore()` carry those
 * values and the top-level inputs along with sequential state and port
 * values, so a rewind puts the switches back as well as the registers.
 *
 * The sandbox also restores them itself, through `captureEnvironmentalState`
 * style walks over `metadata.interactiveArg` and `setNode`. These tests pin
 * both: the engine alone reproduces the trace, and the host recipe layered
 * on top still does.
 *
 * The shift-register time-travel demo on the landing page relies on this
 * invariant: if restore skips env state, the visible switch desyncs from
 * actual circuit behavior.
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import { bit, circuit } from '../../circuit/index.js';
import type { CircuitDefinitions, CircuitIR } from '../../ir/circuit-ir.js';
import { DFlipFlop, Switch } from '../../std/index.js';
import { captureEnvironmentalState, createEngine, elaborate } from '../index.js';
import type { FlatCircuit } from '../types.js';

/**
 * Walk a FlatCircuit's nodes and capture every interactive-arg value (Switch/
 * Input). Analogous to core's `captureEnvironmentalState` but works on
 * post-elaboration FlatNode (`primitiveType`) instead of pre-elaboration Node
 * (`componentRef`). This is the pattern the sandbox uses.
 */
function captureFlatEnv(flat: FlatCircuit, definitions: CircuitDefinitions): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const node of flat.nodes) {
    const def = definitions.resolveCircuit(node.primitiveType);
    const interactiveArg = def?.metadata?.interactiveArg;
    if (!interactiveArg) continue;
    result.set(node.id, node.arguments[interactiveArg]);
  }
  return result;
}

const SwitchedFF = circuit('SwitchedFF', {
  outputs: { q: bit },
  nodes: { sw: Switch, dff: DFlipFlop() },
  connect: ({ outputs, nodes: { sw, dff } }) => [sw.out.to(dff.d), dff.q.to(outputs.q)],
});

function buildSim() {
  const circuitMap = new Map<string, CircuitIR>();
  const definitions: CircuitDefinitions & { addCircuit(c: CircuitIR): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  definitions.addCircuit(SwitchedFF.circuit);
  definitions.addCircuit(Switch.circuit);
  definitions.addCircuit(DFlipFlop().circuit);
  for (const [, dep] of SwitchedFF._dependencies) {
    definitions.addCircuit(dep.circuit);
  }

  const flat = elaborate(SwitchedFF.circuit, definitions);
  const sim = createEngine(flat, {
    library: { definitions, behaviors: libraryOf(SwitchedFF).behaviors },
  });
  return { sim, flat, definitions };
}

function qOut(sim: ReturnType<typeof createEngine>): boolean {
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
    const { sim, flat, definitions } = buildSim();
    sim.setNode('sw', 1);
    sim.tick();

    // FlatNode has primitiveType, not componentRef — captureEnvironmentalState
    // reads componentRef and finds nothing. This is the behavior that broke
    // the sandbox; assert it so future refactors don't mistakenly believe the
    // core helper works on FlatCircuits.
    const wrongWay = captureEnvironmentalState(flat as unknown as CircuitIR, definitions);
    expect(wrongWay.size).toBe(0);

    // The correct walk (primitiveType, the pattern in our captureFlatEnv
    // helper and now in the sandbox) captures the switch state.
    const rightWay = captureFlatEnv(flat, definitions);
    expect(rightWay.get('sw')).toBe(1);
  });

  it('engine restore puts the Switch back', () => {
    const { sim } = buildSim();
    try {
      // Tick once with switch at its default (OFF) — DFF latches 0.
      sim.tick();
      const snap = sim.snapshot();
      expect(qOut(sim)).toBe(false);

      // Flip switch ON, tick — DFF latches 1.
      sim.setNode('sw', 1);
      sim.tick();
      expect(qOut(sim)).toBe(true);

      // Engine-only restore. DFF state reverts to 0 and the Switch goes back
      // to OFF with it.
      sim.restore(snap);
      sim.runCombinational();
      expect(qOut(sim)).toBe(false); // DFF reverted correctly

      // Ticking again reproduces the original trace: switch was OFF, so the
      // DFF latches 0. (It used to latch 1 from the stale switch argument.)
      sim.tick();
      expect(qOut(sim)).toBe(false);
    } finally {
      // SimulatorEngine has no dispose — it's a plain object.
    }
  });

  it('engine + environmental restore reproduces the trace', () => {
    const { sim, flat, definitions } = buildSim();
    try {
      // Tick with switch OFF, capture BOTH halves.
      sim.tick();
      const simSnap = sim.snapshot();
      const envSnap = captureFlatEnv(flat, definitions);
      expect(qOut(sim)).toBe(false);

      // Flip switch, tick — circuit follows a different trajectory.
      sim.setNode('sw', 1);
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
      //       off for Switch/Input primitives).
      //
      // These rules are replicated in apps/sandbox/src/main.ts handleRestore.
      sim.restore(simSnap);
      for (const node of flat.nodes) {
        const def = definitions.resolveCircuit(node.primitiveType);
        const interactiveArg = def?.metadata?.interactiveArg;
        if (!interactiveArg) continue;
        const saved = envSnap.get(node.id);
        const value = saved === undefined ? 0 : saved;
        sim.setNode(node.id, value as number);
      }
      sim.runCombinational();
      expect(qOut(sim)).toBe(false);

      // Now the ticks reproduce the original OFF trajectory.
      sim.tick();
      expect(qOut(sim)).toBe(false);

      // And a subsequent flip + tick moves forward as expected.
      sim.setNode('sw', 1);
      sim.tick();
      expect(qOut(sim)).toBe(true);
    } finally {
      // SimulatorEngine has no dispose — it's a plain object.
    }
  });
});
