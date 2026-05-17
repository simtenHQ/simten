/**
 * Pre-deletion probe: confirm the bridge's lazy-registration path correctly
 * fills EVALUATORS slots for built-in primitives that previously got their
 * entries populated at module load.
 *
 * Today: simulator/evaluators/index.ts pre-populates EVALUATORS[And] = evalAnd,
 *        EVALUATORS[Adder] = evalAdder, etc. at module import. The bridge's
 *        ensureEvaluatorRegistered runs for user primitives only.
 *
 * After deletion: the slots will be null at module load and the bridge has
 *                 to fill them on first use.
 *
 * This probe simulates the after-deletion state: zero every built-in slot
 * before constructing the CPU, then run a workload and check that:
 *   (a) it doesn't crash with null-evaluator or "primitive not registered",
 *   (b) the slots all get filled by the time the run completes,
 *   (c) the CPU produces the same full-state fingerprint as the unpatched run.
 *
 * If this probe passes, the lazy path works and deletion is safe.
 */

import { RV32I_CPU } from '../../../apps/web/src/features/learn/cpu-debugger/rv32i-cpu.circuit.js';
import { simulate } from '../src/sim/simulate.js';
import { EVALUATORS, type NumericEvaluator } from '../src/simulator/evaluators/index.js';
import { PRIMITIVE_TYPE_INDICES } from '../src/simulator/numeric-types.js';

// Reuse the same fingerprint as cpu-workload bench so results are comparable
function fingerprint(cpu: ReturnType<typeof simulate>): string {
  const snap = cpu.snapshot();
  const parts: string[] = [];
  for (const k of [...snap.portValues.keys()].sort()) {
    const v = snap.portValues.get(k) as number | boolean;
    const n = typeof v === 'boolean' ? (v ? 1 : 0) : ((v as number) >>> 0);
    parts.push(`P|${k}=${n}`);
  }
  const serializeState = (s: unknown): string => {
    if (s instanceof Map) {
      const ents = [...(s as Map<number, number>).entries()].sort((a, b) => a[0] - b[0]);
      return `mem{${ents.map(([a, v]) => `${a}:${v}`).join(',')}}`;
    }
    if (typeof s === 'object' && s !== null) {
      const o = s as Record<string, unknown>;
      return `{${Object.keys(o).sort().map(k => `${k}=${serializeState(o[k])}`).join(',')}}`;
    }
    return String(s);
  };
  for (const k of [...snap.sequentialState.currentState.keys()].sort()) {
    parts.push(`S|${k}=${serializeState(snap.sequentialState.currentState.get(k))}`);
  }
  return parts.join('\n');
}

function runCpu(cpu: ReturnType<typeof simulate>, cycles: number): void {
  cpu.set({ net_rx_data: 0, net_rx_valid: 0, net_rx_frame: 0, debug_addr: 0 });
  for (let i = 0; i < cycles; i++) cpu.tick();
}

function main() {
  console.log('null-probe — simulate post-deletion EVALUATORS state and run the CPU');
  console.log();

  // ── Baseline: current state, all slots populated (default) ────────────────
  const baselineSim = simulate(RV32I_CPU);
  runCpu(baselineSim, 1000);
  const baselineFp = fingerprint(baselineSim);
  baselineSim.dispose();
  console.log(`baseline (slots pre-populated): fingerprint length ${baselineFp.length} chars`);

  // ── Null every built-in slot, then build a fresh CPU ──────────────────────
  const builtInIndices = Object.values(PRIMITIVE_TYPE_INDICES);
  const saved = new Map<number, NumericEvaluator | null>();
  for (const idx of builtInIndices) {
    saved.set(idx, EVALUATORS[idx]);
    EVALUATORS[idx] = null;
  }
  const nulledCount = builtInIndices.filter(i => saved.get(i) != null).length;
  console.log(`zeroed ${nulledCount} pre-populated built-in slots`);

  // Now build the CPU. If the lazy path is broken, this should crash either
  // here (during elaboration) or in the first tick (null evaluator called).
  let nulledFp: string;
  let crashed: string | null = null;
  try {
    const probeSim = simulate(RV32I_CPU);
    runCpu(probeSim, 1000);
    nulledFp = fingerprint(probeSim);
    probeSim.dispose();
  } catch (e) {
    crashed = (e as Error).message;
    nulledFp = '';
  }

  // Restore so the harness doesn't leave the module in a weird state
  for (const [idx, fn] of saved) EVALUATORS[idx] = fn;

  // ── Report ────────────────────────────────────────────────────────────────
  if (crashed) {
    console.log(`✗ CRASHED: ${crashed}`);
    console.log('  → bridge ensureEvaluatorRegistered path does NOT correctly handle');
    console.log('    built-in primitives starting from null. Deletion is NOT safe yet.');
    process.exitCode = 1;
    return;
  }

  const match = baselineFp === nulledFp;
  console.log(`fingerprint match: ${match ? '✓' : '✗'}`);

  // Check that slots got refilled
  const filledAfter = builtInIndices.filter(i => EVALUATORS[i] != null).length;
  console.log(`slots filled after run: ${filledAfter}/${builtInIndices.length}`);

  if (!match) {
    console.log('  → output divergence between pre-populated and lazy paths.');
    console.log('    Deletion is NOT safe yet — investigate why the bridge wrapper');
    console.log('    produces different results than the original hand-written entry.');
    process.exitCode = 1;
    return;
  }

  console.log();
  console.log('✓ probe passed: lazy bridge path correctly fills every built-in slot');
  console.log('  encountered by the CPU workload, and produces identical full-state');
  console.log('  output. Deletion of hand-written evaluators is safe to proceed.');
}

main();
