/**
 * Simten MCP Server
 *
 * Exposes circuit simulation tools for Claude Code.
 * Build circuits, simulate them, and push live visualizations to a browser tab.
 *
 * Usage:
 *   claude mcp add simten node packages/mcp/bin/simten-mcp.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Read version from package.json at runtime so the MCP `initialize` response
// reports the actual published version rather than a hand-maintained constant.
// `with { type: 'json' }` is the standard import-attribute form (Node 20+, TS 5.3+).
import pkg from '../package.json' with { type: 'json' };

import { registerCheckTool } from './tools/check.js';
import { registerSimulateTool } from './tools/simulate.js';
import { registerVerifyTool } from './tools/verify.js';
import { registerShowTools } from './tools/show.js';
import { registerRunOnFpgaTool } from './tools/run_on_fpga.js';
import { registerReadWaveformTool } from './tools/read_waveform.js';
import { getOrCreateServer, getPreviewServer } from './lib/preview-singleton.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@simten/core/api';
import { getFactoryOptionSignatures, annotatePrimitivesWithOptions } from './lib/primitive-params.js';

const builderAPI = getGrammarHandler();
// Annotate parameterized components with their constructor options (e.g.
// `Register ctor({ width?, value? })`) so the agent can parameterize them
// without guessing — ports alone don't reveal factory options.
const primitivesList = annotatePrimitivesWithOptions(
  getPrimitivesHandler({ compact: true }, getLibrary()),
  getFactoryOptionSignatures(),
);

const instructions = `You help developers design, simulate, and verify hardware systems from TypeScript. Circuits are files the host edits (write to \`circuits/<name>.circuit.ts\` in the project unless the user says otherwise); the simten tools then check, simulate, verify, and visualize them.

Write each circuit file as a **standalone TS module**: \`import { circuit, bit, bus } from '@simten/core/circuit'\`, stdlib from \`@simten/core/std\`, and **\`export\` the top-level circuit** so a testbench can import it. Real imports keep the file valid in the editor and runnable with \`tsx\`/\`vitest\`. (Tests run on the host via \`tsx\`, so npm packages resolve from \`node_modules\` — you can import a reference implementation as an oracle. Don't write import-free circuit code.)

## Circuit API

${builderAPI}

## Available Components

${primitivesList}

## The contract (read this)

- **Done = correct, at a declared tier.** A non-trivial design is complete only when \`verify_circuit\` passes at the highest feasible oracle tier (its description defines the tiers), **AND** existing sibling \`.verify.ts\` still pass (no regression — re-run them for any circuit you touched), **AND** for integrated/multi-module changes a system-level verify exists. \`simulate_circuit\` shows what a circuit *does*; it does NOT establish correctness — don't stop at a plausible-looking waveform.
- **A named spec is the oracle.** If the prompt states the spec, verify against it; don't re-elicit. Surface acceptance criteria before building only on vague prompts for non-trivial designs.
- **The gate enforces the oracle regardless of the order you wrote things in.** Testbench-first is recommended (harder to retrofit a softball), not required. Don't weaken the oracle to pass — the \`independence_basis\` makes that visible.
- **Surface what you checked.** Lead with the oracle (what was checked, against what, at what tier), not just pass/fail.

## Tools

- \`check_circuit\` — fast well-formedness validation (syntax/semantic/type/structural).
- \`simulate_circuit\` — run it, return traces. Observation only; does not paint the canvas unless \`show: true\`.
- \`verify_circuit\` — run a self-checking testbench *file* (a \`circuits/<name>.verify.ts\` that imports its DUT) on the host; reports pass/fail + counterexample at a declared oracle tier. See its description for tiers and how to write the testbench.
- \`show_circuit\` — paint/update the live canvas (call with no source to list connected tabs; \`close: true\` to close). The only tool that draws.
- \`run_on_fpga\` — build, flash, and UART-capture a project on a connected ULX3S FPGA (projects: cpu, snake, uart_test).
- \`read_waveform\` — query VCD files (iverilog cross-validation, ILA captures) for signals over a cycle window. Use \`test_name\` for the CPU verify-suite or \`vcd_path\` for arbitrary VCDs.

## Canvas

The canvas only paints via \`show_circuit\` (or \`simulate_circuit\` with \`show: true\`). Don't paint during tight iteration — paint at a verify tier-pass, or for a specific failure worth inspecting. Headless (no canvas connected): paint calls simply no-op. The canvas is a **viewer**: it displays and simulates what you push; it does not send anything back.

## Trust

\`verify_circuit\` runs the testbench on the host via \`tsx\` — full node/npm, under your own trust model (same as the agent running \`npm test\`). Appropriate for circuits you authored or trust. **Unfamiliar or shared circuits should be opened in the web \`/circuit\` editor** (a sandboxed worker), not run locally.
`;

const server = new McpServer(
  {
    name: 'simten',
    version: pkg.version,
  },
  {
    capabilities: {},
    instructions,
  },
);

registerCheckTool(server);
registerSimulateTool(server);
registerVerifyTool(server);
registerShowTools(server);
registerRunOnFpgaTool(server);
registerReadWaveformTool(server);

// The local studio is VIEWER-ONLY: the MCP pushes circuits to the browser for
// display/simulation and accepts nothing actionable back. The browser→Claude
// chat bridge (push_chat_response / send-to-claude) and the get_circuit_state
// read-back are intentionally absent — see the security note in ws-server.ts.

const transport = new StdioServerTransport();
await server.connect(transport);

// Start the WS server eagerly so the browser can reconnect immediately after MCP restart.
// Without this, the server only starts when a tool is called (lazy), leaving the browser
// in "reconnecting" state until the first tool invocation.
getOrCreateServer()
  .then((s) => {
    process.stderr.write(`[simten-mcp] WS server started on port ${s.port}\n`);
  })
  .catch((err: unknown) => {
    process.stderr.write(`[simten-mcp] WS server failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
  });

// --- Lifecycle: exit when the parent (Claude Code) goes away ----------------
// The eagerly-started WS server keeps a listening socket (and per-connection
// ping intervals) on the event loop, so this process will NOT terminate on its
// own when stdin closes. Without an explicit exit it orphans — outliving its
// Claude session and holding its studio port — which is how dozens of stale
// instances pile up. Wire every parent-death signal to one shutdown that closes
// the studio server and exits.
let shuttingDown = false;
function shutdown(reason: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`[simten-mcp] shutting down (${reason})\n`);
  try {
    getPreviewServer()?.close();
  } catch {
    /* best effort — exit regardless */
  }
  process.exit(0);
}

// stdin EOF/close is the reliable lifeline: when the MCP client closes the pipe
// (or the wrapper chain dies), our stdin ends even if no signal is delivered.
process.stdin.on('end', () => shutdown('stdin end'));
process.stdin.on('close', () => shutdown('stdin close'));

// The MCP transport closing means the client disconnected; chain any handler the
// SDK already installed, then shut down.
const prevOnClose = transport.onclose;
transport.onclose = () => {
  prevOnClose?.();
  shutdown('transport close');
};

// Make signals actually terminate. (preview-singleton also closes the studio on
// these, but its handlers don't exit — which overrides Node's default and leaves
// the process alive; this guarantees termination so `kill` works without -9.)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
