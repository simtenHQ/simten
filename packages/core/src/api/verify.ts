/**
 * Verify Circuit Handler
 *
 * Runs a self-checking testbench against a circuit and reports a result
 * *at a declared oracle tier* — never a global pass/fail verdict.
 *
 * Why no `verified: true`: the same agent typically writes both the circuit
 * and the testbench, so a self-authored testbench inherits the implementation's
 * blind spots. A green check would read as objective ground truth when it isn't.
 * Instead the caller declares an oracle tier (how independent the expected
 * values are from the implementation) and we report `testbench_passed` *at that
 * tier*. "Done" is defined by the caller's contract as the highest feasible
 * tier reached — see the verify_circuit MCP tool description.
 *
 * Boundary by construction: the testbench is executed in a *separate* scope from
 * the circuit source and is handed only the resolved circuit handle (+ simulate,
 * fc, verify). It cannot lexically reach the source's internal sub-circuits, so
 * an oracle can't degrade into asserting against implementation internals.
 */

import * as fc from 'fast-check';
import { executeCircuitCode, executeJsCode, stripTypes, stripImports } from '../circuit/execute.js';
import { simulate } from '../sim/simulate.js';
import type { BuiltCircuit } from '../circuit/types.js';

// ============================================================================
// Types
// ============================================================================

export type OracleTier = 'A' | 'B' | 'C' | 'D' | 'E';

/** Caller-declared statement of how independent the oracle is. Echoed verbatim. */
export interface OracleDecl {
  tier: OracleTier;
  /** e.g. "RISC-V compliance suite", "behavioral reference (a+b)&0xff". */
  type: string;
  /** Why this oracle is not a restatement of the implementation. */
  independence_basis: string;
  evidence?: string;
}

export interface VerifyCounterexample {
  /** Minimal (shrunk) failing input tuple as produced by the arbitraries. */
  inputs: unknown[];
  /** fast-check replay path, for reproduction. */
  path?: string;
  /** RNG seed, for reproduction. */
  seed?: number;
}

export interface VerifyFailure {
  /** The name passed to verify.check / verify.exhaustive. */
  name: string;
  message: string;
  counterexample?: VerifyCounterexample;
  numRuns?: number;
  numShrinks?: number;
}

/** Per-check runtime evidence (distinct from the caller's declared oracle). */
export interface CheckSummary {
  name: string;
  strategy: 'exhaustive' | 'sampled';
  /** Cases exercised (exhaustive: total space; sampled: numRuns). */
  count: number;
  passed: boolean;
}

export interface VerifyResult {
  circuit: string;
  testbench_passed: boolean;
  oracle: OracleDecl;
  checks: CheckSummary[];
  failures: VerifyFailure[];
  /** Fixed, always present — the hardware gap lands in the artifact by construction. */
  caveat: string;
}

export interface VerifyError {
  error: string;
  /** 'oom' is set by the sandbox layer on unexpected child death, not here. */
  phase: 'compile' | 'runtime' | 'timeout' | 'oom';
}

export interface VerifyParams {
  source: string;
  testbench: string;
  oracle: OracleDecl;
  sourceName?: string;
  circuitName?: string;
  /** Sampled-property run count. Default 50. */
  numRuns?: number;
  /** Wall-clock budget for the testbench. Default 30000ms. */
  timeoutMs?: number;
}

const CAVEAT = 'TS simulation only; FPGA synthesis/timing not guaranteed.';
const EXHAUSTIVE_CUTOFF = 2 ** 20;
const DEFAULT_NUM_RUNS = 50;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Sentinel thrown when the testbench exceeds its wall-clock budget. */
class VerifyTimeout extends Error {}

// ============================================================================
// verifyCircuit
// ============================================================================

export function verifyCircuit(params: VerifyParams): VerifyResult | VerifyError {
  const numRuns = params.numRuns ?? DEFAULT_NUM_RUNS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // --- Phase 1: execute the circuit source on its own, resolve the DUT --------
  const src = executeCircuitCode(params.source);
  if (src.error) {
    return { error: src.error, phase: 'compile' };
  }
  const target: BuiltCircuit | undefined = params.circuitName
    ? src.builtCircuits.find((b) => b.circuit.name === params.circuitName)
    : src.builtCircuits[src.builtCircuits.length - 1];

  if (!target) {
    const names = src.builtCircuits.map((b) => b.circuit.name).join(', ');
    return {
      error: params.circuitName
        ? `Circuit "${params.circuitName}" not found. Available: ${names || '(none)'}`
        : 'No circuits found in source.',
      phase: 'compile',
    };
  }

  // --- Phase 2: build the testbench harness -----------------------------------
  const checks: CheckSummary[] = [];
  const failures: VerifyFailure[] = [];
  const deadline = Date.now() + timeoutMs;

  const checkDeadline = () => {
    if (Date.now() >= deadline) throw new VerifyTimeout(`Testbench exceeded ${timeoutMs}ms`);
  };

  // Single failure path: verify.check (property) + verify.exhaustive (full sweep).
  const harness = {
    /** Property-based check. Uses fc.check (never throws) for structured results. */
    check(name: string, property: fc.IRawProperty<unknown>, opts?: { numRuns?: number }) {
      checkDeadline();
      const runs = opts?.numRuns ?? numRuns;
      // fc.check is sync for sync properties; narrow away the async union member.
      const details = fc.check(property, {
        numRuns: runs,
        interruptAfterTimeLimit: timeoutMs,
      }) as fc.RunDetails<unknown>;
      checkDeadline();
      const passed = !details.failed;
      checks.push({ name, strategy: 'sampled', count: details.numRuns, passed });
      if (!passed) {
        const err = details.errorInstance as Error | undefined;
        failures.push({
          name,
          message: err?.message ?? 'property failed',
          counterexample: {
            inputs: (details.counterexample as unknown[]) ?? [],
            path: details.counterexamplePath ?? undefined,
            seed: details.seed,
          },
          numRuns: details.numRuns,
          numShrinks: details.numShrinks,
        });
      }
    },

    /**
     * Exhaustive sweep over a finite input space. `spaces` gives the size of
     * each dimension (e.g. [256, 256] for two 8-bit inputs); predicate receives
     * one value per dimension and returns false / throws on violation.
     */
    exhaustive(
      name: string,
      spaces: number[],
      predicate: (...vals: number[]) => boolean | void,
    ) {
      const total = spaces.reduce((a, b) => a * b, 1);
      if (total > EXHAUSTIVE_CUTOFF) {
        throw new Error(
          `verify.exhaustive("${name}"): input space ${total} exceeds ${EXHAUSTIVE_CUTOFF}. ` +
            `Use verify.check with fc property sampling for spaces this large.`,
        );
      }
      const idx = new Array(spaces.length).fill(0);
      for (let n = 0; n < total; n++) {
        if ((n & 0x3ff) === 0) checkDeadline();
        // decode n into a mixed-radix tuple
        let rem = n;
        for (let d = spaces.length - 1; d >= 0; d--) {
          idx[d] = rem % spaces[d];
          rem = Math.floor(rem / spaces[d]);
        }
        let ok = true;
        let message = 'predicate returned false';
        try {
          ok = predicate(...idx) !== false;
        } catch (e) {
          ok = false;
          message = e instanceof Error ? e.message : String(e);
        }
        if (!ok) {
          checks.push({ name, strategy: 'exhaustive', count: n + 1, passed: false });
          failures.push({ name, message, counterexample: { inputs: [...idx] } });
          return;
        }
      }
      checks.push({ name, strategy: 'exhaustive', count: total, passed: true });
    },
  };

  // Raw fc.assert is a hard error — it throws an opaque string and loses the
  // structured counterexample. Steer authors to verify.check.
  const fcGuarded = {
    ...fc,
    assert: () => {
      throw new Error(
        'Do not use fc.assert in a testbench — use verify.check(name, fc.property(...)), ' +
          'which captures the shrunk counterexample. (fc.property and the arbitraries are fine.)',
      );
    },
  };

  // --- Phase 3: run the testbench in an isolated scope ------------------------
  // The testbench sees ONLY the resolved circuit (by its name and as `dut`),
  // simulate, fc, and verify — not the source's internal sub-circuits.
  let stripped: string;
  try {
    stripped = stripImports(stripTypes(params.testbench));
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), phase: 'compile' };
  }

  const scope: Record<string, unknown> = {
    [target.circuit.name]: target,
    dut: target,
    simulate,
    fc: fcGuarded,
    verify: harness,
  };

  let timedOut = false;
  let tb: ReturnType<typeof executeJsCode>;
  try {
    tb = executeJsCode(stripped, scope);
  } catch (e) {
    if (e instanceof VerifyTimeout) return { error: e.message, phase: 'timeout' };
    throw e;
  }

  if (tb.error) {
    // executeJsCode stringifies thrown errors; recover the timeout sentinel by message.
    timedOut = tb.error.includes('exceeded') && tb.error.includes('ms');
    if (timedOut) return { error: tb.error, phase: 'timeout' };
    // A raw throw / fc.assert / runtime error with nothing collected → hard error.
    if (failures.length === 0 && checks.length === 0) {
      return { error: tb.error, phase: 'runtime' };
    }
    // Otherwise the testbench did some checks then threw — surface as a failure.
    failures.push({ name: 'testbench', message: tb.error });
  }

  return {
    circuit: target.circuit.name,
    testbench_passed: failures.length === 0,
    oracle: params.oracle,
    checks,
    failures,
    caveat: CAVEAT,
  };
}
