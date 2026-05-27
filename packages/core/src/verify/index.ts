/**
 * `@simten/core/verify` — the verification harness.
 *
 * Imported by a real testbench file (a `.verify.ts`) that imports its own DUT,
 * `simulate`, `fast-check`, and this harness, then calls `verify.run()`:
 *
 *   import { simulate } from '@simten/core/sim';
 *   import * as fc from 'fast-check';
 *   import { verify, declareOracle } from '@simten/core/verify';
 *   import { sha256 } from '@noble/hashes/sha256';   // any npm oracle resolves normally
 *   import { MyCircuit } from './my_circuit.circuit.ts';
 *
 *   declareOracle({ tier: 'B', type: '…', independence_basis: '…' });
 *   verify.check('…', fc.property(…, (x) => { const s = simulate(MyCircuit); … }));
 *   verify.run();
 *
 * Run it with `tsx my.verify.ts` (the verify_circuit MCP tool does this) or under
 * `vitest`. The harness accumulates results in module state and `verify.run()`
 * flushes them. run() is the GATE: it refuses to emit a passed result without a
 * declared, independent oracle.
 */

import * as fc from 'fast-check';
import type {
  OracleDecl,
  VerifyResult,
  VerifyFailure,
  CheckSummary,
  VerifyContractError,
} from './types.js';

export * from './types.js';

/** Delimiters for the JSON block on stdout (parsed by the MCP tool). */
export const VERIFY_JSON_BEGIN = '--- BEGIN JSON ---';
export const VERIFY_JSON_END = '--- END JSON ---';

const CAVEAT = 'TS simulation only; FPGA synthesis/timing not guaranteed.';
const EXHAUSTIVE_CUTOFF = 2 ** 20;
const DEFAULT_NUM_RUNS = 50;

// ── Module state (a testbench is one process) ────────────────────────────────

let _oracle: OracleDecl | undefined;
let _circuit = '<testbench>';
const _checks: CheckSummary[] = [];
const _failures: VerifyFailure[] = [];
let _ran = false;
let _reported = false;

const hasProcess = typeof process !== 'undefined';
const underVitest = hasProcess && !!process.env.VITEST;

/** Declare the oracle for this testbench (the human/vitest path). */
export function declareOracle(o: OracleDecl): void {
  _oracle = o;
}

/** Optional: label the circuit under test for the report. */
export function describe(circuitName: string): void {
  _circuit = circuitName;
}

interface CheckOpts {
  numRuns?: number;
  oracle?: OracleDecl;
}

export const verify = {
  /** Property-based check. Uses fc.check (never throws) for structured results. */
  check(name: string, property: fc.IRawProperty<unknown>, opts?: CheckOpts): void {
    if (opts?.oracle) _oracle = opts.oracle;
    const runs = opts?.numRuns ?? DEFAULT_NUM_RUNS;
    // fc.check is sync for sync properties; narrow away the async union member.
    const details = fc.check(property, { numRuns: runs }) as fc.RunDetails<unknown>;
    const passed = !details.failed;
    _checks.push({ name, strategy: 'sampled', count: details.numRuns, passed });
    if (!passed) {
      const err = details.errorInstance as Error | undefined;
      _failures.push({
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
   * Exhaustive sweep over a finite input space. `spaces` gives the size of each
   * dimension (e.g. [256, 256] for two 8-bit inputs); predicate receives one
   * value per dimension and returns false / throws on violation.
   */
  exhaustive(
    name: string,
    spaces: number[],
    predicate: (...vals: number[]) => boolean | void,
    opts?: { oracle?: OracleDecl },
  ): void {
    if (opts?.oracle) _oracle = opts.oracle;
    const total = spaces.reduce((a, b) => a * b, 1);
    if (total > EXHAUSTIVE_CUTOFF) {
      throw new Error(
        `verify.exhaustive("${name}"): input space ${total} exceeds ${EXHAUSTIVE_CUTOFF}. ` +
          `Use verify.check with fc property sampling for spaces this large.`,
      );
    }
    const idx = new Array(spaces.length).fill(0);
    for (let n = 0; n < total; n++) {
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
        _checks.push({ name, strategy: 'exhaustive', count: n + 1, passed: false });
        _failures.push({ name, message, counterexample: { inputs: [...idx] } });
        return;
      }
    }
    _checks.push({ name, strategy: 'exhaustive', count: total, passed: true });
  },

  /**
   * Flush results. THE GATE: refuses a passed result without an oracle or checks.
   * Under tsx, prints a delimited JSON block and sets process.exitCode. Under
   * vitest, throws on failure/contract-violation so the reporter shows it.
   */
  run(): void {
    _ran = true;
    const oracle = resolveOracle();

    if (underVitest) {
      if (!oracle) throw new Error('verify.run(): no oracle declared — declareOracle({ tier, type, independence_basis }) is required.');
      if (_checks.length === 0) throw new Error('verify.run(): no checks were run.');
      if (_failures.length > 0) throw new Error(`verify: ${_failures.length} failure(s): ${JSON.stringify(_failures, null, 2)}`);
      return;
    }

    if (!oracle) return emitError('no oracle declared — declareOracle({ tier, type, independence_basis }) or pass one via the verify_circuit tool.');
    if (_checks.length === 0) return emitError('no checks were run — call verify.check / verify.exhaustive before verify.run().');

    const result: VerifyResult = {
      circuit: _circuit,
      testbench_passed: _failures.length === 0,
      oracle,
      checks: _checks,
      failures: _failures,
      caveat: CAVEAT,
    };
    emit(result);
    setExit(result.testbench_passed ? 0 : 1);
  },
};

// ── Internals ────────────────────────────────────────────────────────────────

/** Tool-injected oracle (env) wins over the file's declareOracle. */
function resolveOracle(): OracleDecl | undefined {
  if (hasProcess && process.env.SIMTEN_VERIFY_ORACLE) {
    try {
      return JSON.parse(process.env.SIMTEN_VERIFY_ORACLE) as OracleDecl;
    } catch {
      /* fall through to declared */
    }
  }
  return _oracle;
}

function emit(obj: VerifyResult | VerifyContractError): void {
  _reported = true;
  // eslint-disable-next-line no-console
  console.log(`${VERIFY_JSON_BEGIN}\n${JSON.stringify(obj, null, 2)}\n${VERIFY_JSON_END}`);
}

function emitError(message: string): void {
  emit({ verify_error: message, phase: 'contract' });
  setExit(1);
}

function setExit(code: number): void {
  if (hasProcess) process.exitCode = code;
}

// Safety net: if the testbench forgot to call verify.run(), emit a precise
// contract error instead of exiting 0 with no JSON block (which would otherwise
// be an unclassifiable "crash" for the tool).
if (hasProcess && !underVitest) {
  process.on('beforeExit', () => {
    if (_ran || _reported) return;
    emitError('verify.run() was never called — end your testbench with verify.run().');
  });
}
