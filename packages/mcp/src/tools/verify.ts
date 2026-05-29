/**
 * verify_circuit — the contract gate.
 *
 * Runs a self-checking testbench FILE on the HOST via `tsx` (full npm resolution,
 * no sandbox — same trust model as `npm test`) and returns the structured result.
 * Its structural job is the gate: it requires a declared `oracle`, and the harness
 * (`@simten/core/verify`) refuses to emit a passed result without one. Two locks,
 * same key — a tool boundary the agent can't skip.
 *
 * The testbench is a normal `.verify.ts` that imports its own DUT, `simulate`,
 * `fast-check`, any npm oracle, and `@simten/core/verify`, ending with
 * `verify.run()`. It also runs directly under `tsx` and under `vitest`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { dirname, resolve } from 'node:path';
import { runTsx, extractDelimitedJson, checkDepsResolvable, detectPackageManager, installCommand } from '../lib/host-run.js';
import { VERIFY_JSON_BEGIN, VERIFY_JSON_END, type VerifyResult, type VerifyContractError } from '@simten/core/verify';

/** Deps the testbench's tsx subprocess needs in the user's project node_modules. */
const REQUIRED_DEPS = ['@simten/core', 'fast-check'] as const;

const DESCRIPTION = `Run a self-checking testbench FILE against a circuit and report the result AT A DECLARED ORACLE TIER. simulate_circuit shows what a circuit does; verify_circuit tells you whether it's correct — a design isn't "done" until it passes at the highest feasible tier.

There is no global pass/fail verdict, on purpose: you usually write both the circuit and the testbench, so a self-authored test inherits the implementation's blind spots. What matters is how INDEPENDENT the expected values are from the implementation. Declare that with the required \`oracle\` block — the gate refuses a passed result without it.

ORACLE TIERS (highest → lowest independence):
- A — External ground truth: expected outputs come from a source OTHER than this circuit (compiled programs with known results, captured real-world data, spec/RFC reference vectors, or an npm reference implementation — e.g. \`import { sha256 } from '@noble/hashes/sha2'\`). What makes it Tier A is the externality of the expected values, NOT the execution path.
- B — Paradigm-diverse reference: a behavioral model written in a different style than the implementation (structural adder vs (a+b)&0xff; pipelined CPU vs a single-cycle reference). Standard golden-model differential testing.
- C — Domain invariants: properties the spec implies regardless of implementation (commutativity, identity, monotonicity, bit-width bounds).
- D — Property tests against your own understanding of the spec. Low independence.
- E — Round-trip / smoke tests, no independent oracle. Lowest.

WRITING THE TESTBENCH (a \`circuits/<name>.verify.ts\` file, run on the host via tsx):
  import { simulate } from '@simten/core/sim';
  import * as fc from 'fast-check';
  import { verify, declareOracle } from '@simten/core/verify';
  import { MyCircuit } from './my_circuit.circuit.js';   // import your DUT (it must be exported)
  declareOracle({ tier: 'B', type: '...', independence_basis: '...' });
  verify.check('name', fc.property(fc.nat(255), (x) => { const s = simulate(MyCircuit); try { ... } finally { s.dispose(); } }));
  // or verify.exhaustive('name', [256], (x) => ...);   // full sweep, input space <= 2^20
  verify.run();   // required — flushes the structured result

- Real npm packages work as oracles (the host resolves them from node_modules).
- The testbench imports its DUT; only what the circuit file EXPORTS is reachable.
- It also runs under \`vitest\` (wrap as test('verify', () => verify.run())) — so verification drops into CI.

Result carries a fixed caveat: TS simulation only; FPGA synthesis/timing not guaranteed.`;

const oracleSchema = z.object({
  tier: z.enum(['A', 'B', 'C', 'D', 'E']).describe('Oracle independence tier (see description)'),
  type: z.string().describe('What the oracle is, e.g. "@noble/hashes sha256 reference"'),
  independence_basis: z.string().describe('Why this oracle is not a restatement of the implementation'),
  evidence: z.string().optional().describe('Optional: suite size, invariants checked, etc.'),
});

export function registerVerifyTool(server: McpServer): void {
  server.tool(
    'verify_circuit',
    DESCRIPTION,
    {
      testbench: z.string().describe('Path to the .verify.ts testbench file (it imports its own DUT). Relative to the project root.'),
      oracle: oracleSchema.describe('Required declaration of the oracle tier and its independence basis — the contract gate'),
      timeoutMs: z.number().int().min(1).optional().describe('Wall-clock budget in ms (default 30000); the subprocess is killed past it'),
    },
    async ({ testbench, oracle, timeoutMs }) => {
      // Pre-flight: check that @simten/core + fast-check resolve from the
      // testbench's directory. The MCP itself bundles them but the tsx
      // subprocess runs in the user's project context, so Node's resolver
      // only walks up from the testbench file. Cryptic ERR_MODULE_NOT_FOUND
      // from tsx is the failure mode otherwise; this turns it into an
      // actionable install command with the correct package manager.
      const absoluteTestbench = resolve(testbench);
      const missing = checkDepsResolvable(absoluteTestbench, [...REQUIRED_DEPS]);
      if (missing.length > 0) {
        const pm = detectPackageManager(dirname(absoluteTestbench));
        return errorResult(
          `verify_circuit needs ${missing.map((m) => `\`${m}\``).join(' and ')} installed in this project. Run this once and verify_circuit will work for every future call in this project:\n\n    ${installCommand(pm, missing)}\n\nIf this directory isn't part of a Node project yet, create one first: \`cd ${dirname(absoluteTestbench)} && npm init -y\` (or whichever package manager you use).`,
          { missing_dependencies: missing, suggested_command: installCommand(pm, missing), package_manager_detected: pm },
        );
      }

      const run = await runTsx(testbench, {
        env: { SIMTEN_VERIFY_ORACLE: JSON.stringify(oracle) },
        timeoutMs: timeoutMs ?? 30_000,
      });

      if (run.spawnError) {
        return errorResult(`Could not run tsx: ${run.spawnError}. Ensure tsx is installed (pnpm add -D tsx) or set SIMTEN_TSX.`);
      }
      if (run.timedOut) {
        return errorResult(`verify timed out after ${timeoutMs ?? 30_000}ms (subprocess killed). Reduce numRuns or the exhaustive space.`);
      }

      const parsed = extractDelimitedJson<VerifyResult | VerifyContractError>(run.stdout, VERIFY_JSON_BEGIN, VERIFY_JSON_END);
      if (!parsed) {
        // Nonzero exit with no JSON block = crash/compile error in the testbench.
        return errorResult(
          `Testbench produced no verify result (exit ${run.exitCode}). Likely a crash or compile error.`,
          { stderr_tail: run.stderr.slice(-2000), stdout_tail: run.stdout.slice(-1000) },
        );
      }

      const passed = 'testbench_passed' in parsed && parsed.testbench_passed === true;
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }],
        isError: !passed, // contract errors and failed testbenches both flag isError
      };
    },
  );
}

function errorResult(error: string, extra?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error, ...extra }, null, 2) }],
    isError: true,
  };
}
