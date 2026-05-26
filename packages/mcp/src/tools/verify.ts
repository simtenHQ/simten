/**
 * verify_circuit tool - MCP wrapper
 *
 * The full verification contract lives in this tool's description, because that
 * is what the agent reads at the moment it chooses to call it. simulate_circuit
 * shows what a circuit DOES; verify_circuit reports whether it's CORRECT, and at
 * what tier of oracle independence.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readCircuitSource } from '../lib/file-reader.js';
import { sandboxVerify } from '../lib/mcp-sandbox.js';

const DESCRIPTION = `Run a self-checking testbench against a circuit and report the result AT A DECLARED ORACLE TIER. simulate_circuit shows what a circuit does; verify_circuit tells you whether it's correct — a design is not "done" until it passes at the highest feasible tier.

There is no global pass/fail verdict, on purpose: you usually write both the circuit and the testbench, so a self-authored test inherits the implementation's blind spots. What matters is how INDEPENDENT the expected values are from the implementation. Declare that with the required \`oracle\` block.

ORACLE TIERS (highest → lowest independence):
- A — External ground truth: expected outputs come from a source OTHER than this circuit (compiled programs with known results, captured real-world data, spec/RFC reference vectors). Running the circuit in TS sim is fine; what makes it Tier A is the externality of the expected values, NOT the execution path. ("I ran it and looked at the output" is NOT Tier A.)
- B — Paradigm-diverse reference: a behavioral model written in a different style than the implementation (structural adder vs (a+b)&0xff; pipelined CPU vs a single-cycle reference). Standard golden-model differential testing.
- C — Domain invariants: properties the spec implies regardless of implementation (commutativity, identity, monotonicity, bit-width bounds).
- D — Property tests against your own understanding of the spec. Low independence.
- E — Round-trip / smoke tests, no independent oracle. Lowest.

DONE RULE:
- If the highest feasible tier for this design is ≥ B, you must reach it before claiming done.
- If the highest feasible tier is D or E, you must surface that limitation to the user before claiming done.
- If the prompt NAMES the spec, that spec is the oracle — translate it to executable form, do not re-elicit.

ACCEPTANCE PATTERNS BY CLASS:
- Combinational/datapath (adder, ALU, mux, shifter): Tier B reference, exhaustive where the input space is small (verify.exhaustive).
- Processor/CPU: Tier A — run real compiled programs, assert architectural output/state against a reference, not a hand-written trace.
- Protocol/parser: Tier A — drive with real captured data, assert decoded fields.
- Sequential/control: Tier C invariants + Tier B reference model.

WRITING THE TESTBENCH (TypeScript; receives the circuit handle by its name and as \`dut\`, plus \`simulate\`, \`fc\`, \`verify\`):
- Sampled: verify.check('name', fc.property(fc.nat(255), fc.nat(255), (a, b) => { const s = simulate(dut); try { s.set({ a, b }); s.tick(); return s.get('sum') === ((a + b) & 0xff); } finally { s.dispose(); } }))
- Exhaustive: verify.exhaustive('name', [256, 256], (a, b) => { ... return ok; })  // sweeps all combinations if the space ≤ 2^20
- Use verify.check, NOT fc.assert (fc.assert is rejected — it loses the shrunk counterexample).
- The testbench sees ONLY the resolved circuit, not the file's internal sub-circuits.

BEFORE CALLING: always push_chat_response a one-line note ("running verify — Tier B exhaustive over 65,536 pairs") so the run isn't silent.

The result includes a fixed caveat: TS simulation only; FPGA synthesis/timing not guaranteed.`;

const oracleSchema = z.object({
  tier: z.enum(['A', 'B', 'C', 'D', 'E']).describe('Oracle independence tier (see description)'),
  type: z.string().describe('What the oracle is, e.g. "behavioral reference (a+b)&0xff"'),
  independence_basis: z.string().describe('Why this oracle is not a restatement of the implementation'),
  evidence: z.string().optional().describe('Optional: suite size, invariants checked, etc.'),
});

export function registerVerifyTool(server: McpServer): void {
  server.tool(
    'verify_circuit',
    DESCRIPTION,
    {
      source: z.string().optional().describe('TypeScript circuit code as a string'),
      filePath: z.string().optional().describe('Path to a .circuit.ts file (preferred)'),
      testbench: z.string().describe('TypeScript testbench using verify.check / verify.exhaustive, simulate, fc, and the circuit handle (by name or `dut`)'),
      oracle: oracleSchema.describe('Required declaration of the oracle tier and its independence basis'),
      circuitName: z.string().optional().describe('Which circuit is under test (defaults to last defined)'),
      numRuns: z.number().int().min(1).optional().describe('Sampled-property run count (default 50)'),
      timeoutMs: z.number().int().min(1).optional().describe('Wall-clock budget in ms (default 30000)'),
    },
    async ({ source, filePath, testbench, oracle, circuitName, numRuns, timeoutMs }) => {
      const read = readCircuitSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      const result = await sandboxVerify({
        source: read.source,
        sourceName: read.sourceName,
        testbench,
        oracle,
        circuitName,
        numRuns,
        timeoutMs,
      });

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
