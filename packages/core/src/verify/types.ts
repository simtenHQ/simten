/**
 * Verify harness types — the tiered-oracle verification contract.
 *
 * There is no global "verified" boolean on purpose: the same agent usually
 * writes both the circuit and the testbench, so a self-authored test inherits
 * the implementation's blind spots. What matters is how INDEPENDENT the expected
 * values are from the implementation — declared as an oracle tier.
 */

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

/**
 * Emitted instead of a VerifyResult when the contract is violated — no oracle,
 * no checks, or verify.run() was never called. Distinguishable from a result by
 * the `verify_error` key.
 */
export interface VerifyContractError {
  verify_error: string;
  phase: 'contract';
}
