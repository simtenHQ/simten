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
import { runTsx, findRepoRoot, extractDelimitedJson } from '../lib/host-run.js';
import { isProjectReady, detectPackageManager, installCommand } from '../lib/project-setup.js';
import { VERIFY_JSON_BEGIN, VERIFY_JSON_END, type VerifyResult, type VerifyContractError } from '@simten/core/verify';

const DESCRIPTION = `Run a self-checking testbench FILE against a circuit and report the result AT A DECLARED ORACLE TIER. simulate_circuit shows what a circuit does; verify_circuit tells you whether it's correct — a design isn't "done" until it passes at the highest feasible tier.

You usually write both the circuit and its testbench, so what matters is how INDEPENDENT the expected values are from the implementation. The required \`oracle\` block declares that; the gate refuses a passed result without it. Don't weaken the oracle to pass — \`independence_basis\` makes that visible.

ORACLE TIERS (highest → lowest independence) for the \`oracle.tier\` field:
- A — external ground truth: expected values from a source OTHER than this circuit (npm reference impl, RFC/spec vectors, captured data, known program output).
- B — paradigm-diverse reference model, written in a different style than the implementation (golden-model differential testing).
- C — domain invariants the spec implies regardless of implementation (commutativity, identity, bounds).
- D — property tests against your own understanding of the spec. Low independence.
- E — round-trip / smoke; no independent oracle.

To WRITE the testbench (the \`simulate()\` stepper API, \`verify.exhaustive\`/\`verify.check\`, \`declareOracle\`, worked examples), call the \`get_verify_api\` tool — it's kept there because this description is capped at 2KB by clients. The testbench is a \`circuits/<name>.verify.ts\` that imports its exported DUT and ends with \`verify.run()\`.

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
      // Preflight: verify runs the testbench via tsx and resolves @simten/core +
      // fast-check from the PROJECT. In an unconfigured folder that fails with a
      // cryptic module-not-found; instead, detect it up front and point the agent
      // at setup_project (which writes package.json and installs the deps).
      const root = findRepoRoot();
      if (!isProjectReady(root)) {
        const pm = detectPackageManager(root);
        return errorResult(
          "This folder isn't set up for verify yet. Call setup_project (writes package.json, installs @simten/core + fast-check + tsx), then retry.",
          { status: 'setup_required', root, manual: installCommand(pm) },
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
        // The framework deps are guaranteed present (preflight), so a module-not-
        // found here means an EXTERNAL package the testbench imports — typically a
        // Tier-A oracle (e.g. @noble/hashes). Point at installing that, not core.
        const looksLikeMissingDeps = /Cannot find (module|package)|ERR_MODULE_NOT_FOUND/.test(run.stderr);
        const hint = looksLikeMissingDeps
          ? ' Looks like a missing dep — if the testbench imports an external oracle package (e.g. @noble/hashes), install it in this project (npm install <pkg>).'
          : '';
        return errorResult(
          `Testbench produced no verify result (exit ${run.exitCode}). Likely a crash or compile error.${hint}`,
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
