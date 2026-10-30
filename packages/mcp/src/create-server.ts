/**
 * The Simten MCP server: its instructions and tools. `index.ts` serves it over
 * stdio; tests connect a client to it in-process.
 */

import { McpServer } from '@modelcontextprotocol/server';
// Read version from package.json at runtime so the server reports the actual
// published version rather than a hand-maintained constant.
import pkg from '../package.json' with { type: 'json' };
import { registerCheckTool } from './tools/check.js';
import { registerGetStartedTool } from './tools/get_started.js';
import { registerReadWaveformTool } from './tools/read_waveform.js';
import { registerReferenceTools } from './tools/reference.js';
import { registerRunOnFpgaTool } from './tools/run_on_fpga.js';
import { registerSetupTool } from './tools/setup.js';
import { registerShowTools } from './tools/show.js';
import { registerSimulateTool } from './tools/simulate.js';
import { registerVerifyTool } from './tools/verify.js';

// NOTE: clients truncate an MCP server's `instructions` at ~2KB (Claude Code
// does — https://code.claude.com/docs/en/mcp.md), so this MUST stay small and
// front-load what matters. The circuit-builder API, the ~10KB component
// catalog and the testbench API deliberately do NOT live here — they'd be cut —
// and are exposed via the `get_grammar` / `list_components` / `get_verify_api`
// tools instead (tool results aren't capped). Keep critical guidance (the
// verify contract, the reference pointer) near the top so it survives truncation.
export const INSTRUCTIONS = `You help developers design, simulate, and verify hardware from TypeScript. Circuits are files the host edits (write to \`circuits/<name>.circuit.ts\` unless told otherwise); the simten tools check, simulate, verify, and visualize them. If the user asks what simten is, wants a demo, or doesn't know where to start, call \`get_started\` (orientation + bundled examples, zero setup); if they ask for a specific circuit, skip it and build.

## Reference (call these, don't guess)
Clients truncate these instructions at ~2KB, so the full reference lives in tools:
- \`get_grammar\`: the \`circuit()\` API (inputs/outputs, nodes, connect) with examples. Read before writing a circuit.
- \`list_components\`: every component with its ports and constructor options (e.g. \`Register({ width })\`).
- \`get_verify_api\`: how to write a \`.verify.ts\` testbench (\`simulate\`, \`set\`, \`tick\`, oracles). Read before writing one.

## Setup, only needed for verify
\`check_circuit\`, \`simulate_circuit\`, \`show_circuit\`, and \`get_started\` need no setup. \`verify_circuit\` runs on the host via \`tsx\` and resolves \`@simten/core\` + \`fast-check\` from the project. Before a project's first verify, call \`setup_project\` once (writes \`package.json\`, installs the deps); it reports the file extension to use (\`.ts\`, or \`.mts\` for an existing CommonJS project). \`verify_circuit\` tells you to run it if you forget.

## The contract
- **Done = correct, at a declared tier.** A non-trivial design is complete only when \`verify_circuit\` passes at the highest feasible oracle tier (its description defines the tiers), sibling \`.verify.ts\` still pass (re-run them for any circuit you touched), and integrated changes have a system-level verify. \`simulate_circuit\` shows what a circuit *does*, not that it's correct; don't stop at a plausible waveform.
- **Don't weaken the oracle to pass**: the \`independence_basis\` makes that visible. Lead with what you checked, against what, at what tier.

## Writing circuits
Write each circuit as a standalone TS module: \`import { circuit, bit, bus } from '@simten/core'\`, stdlib from \`@simten/core/std\`, and **\`export\`** the top-level circuit so a testbench can import it. Don't write import-free code.

## Canvas & trust
\`show_circuit\` is the only tool that paints; the canvas is a one-way **viewer** (it displays and simulates what you push and sends nothing back). Editing the \`.circuit.ts\` does NOT update the browser; call \`show_circuit\` again to repaint (at a verify pass, not during tight iteration). The file you edit is the source of truth; in-browser edits are local experiments. \`verify_circuit\` runs the testbench on the host via \`tsx\` (full node/npm, your trust level, like \`npm test\`); open unfamiliar or shared circuits in the sandboxed web \`/circuit\` editor, not locally.
`;

/**
 * How long a client may reuse `tools/list` (protocol 2026-07-28). The list is
 * fixed for the life of the process (it depends only on whether the server
 * started inside the Simten repo), so an hour is safe. Private: another
 * project's server may list different tools.
 */
const TOOLS_LIST_TTL_MS = 60 * 60 * 1000;

interface SimtenServerOptions {
  /**
   * The Simten repo root, when the server runs inside a checkout. Only then
   * are `run_on_fpga` and `read_waveform` registered: they work on projects
   * and VCDs under `hardware/ulx3s`, which an npm install doesn't have.
   */
  repoRoot: string | null;
}

export function createSimtenServer({ repoRoot }: SimtenServerOptions): McpServer {
  const server = new McpServer(
    { name: 'simten', version: pkg.version },
    {
      instructions: INSTRUCTIONS,
      cacheHints: { 'tools/list': { ttlMs: TOOLS_LIST_TTL_MS, cacheScope: 'private' } },
    },
  );

  registerGetStartedTool(server);
  registerCheckTool(server);
  registerSimulateTool(server);
  registerVerifyTool(server);
  registerSetupTool(server);
  registerShowTools(server);
  registerReferenceTools(server);
  if (repoRoot) {
    registerRunOnFpgaTool(server, repoRoot);
    registerReadWaveformTool(server, repoRoot);
  }

  // The local studio is VIEWER-ONLY: the MCP pushes circuits to the browser for
  // display/simulation and accepts nothing actionable back. The browser→Claude
  // chat bridge and the circuit-state read-back are intentionally absent; see
  // the security note in ws-server.ts.
  return server;
}
