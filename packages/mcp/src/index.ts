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
import { registerReferenceTools } from './tools/reference.js';
import { getOrCreateServer, getPreviewServer } from './lib/preview-singleton.js';

// NOTE: clients truncate an MCP server's `instructions` at ~2KB (Claude Code
// does — https://code.claude.com/docs/en/mcp.md), so this MUST stay small and
// front-load what matters. The circuit-builder API and the ~10KB component
// catalog deliberately do NOT live here — they'd be cut — and are exposed via
// the `get_grammar` / `list_components` tools instead (tool results aren't
// capped). Keep critical guidance (the verify contract, the reference pointer)
// near the top so it survives truncation.
const instructions = `You help developers design, simulate, and verify hardware from TypeScript. Circuits are files the host edits (write to \`circuits/<name>.circuit.ts\` unless told otherwise); the simten tools check, simulate, verify, and visualize them.

## Reference (call these — don't guess)
This server's instructions are truncated by clients at ~2KB, so the full reference lives in tools:
- \`get_grammar\` — the \`circuit()\` API (inputs/outputs, nodes, connect) with examples. Read before writing a circuit.
- \`list_components\` — every available component with its ports and constructor options (e.g. \`Register({ width })\`).

## The contract
- **Done = correct, at a declared tier.** A non-trivial design is complete only when \`verify_circuit\` passes at the highest feasible oracle tier (its description defines the tiers), sibling \`.verify.ts\` still pass (re-run them for any circuit you touched), and integrated changes have a system-level verify. \`simulate_circuit\` shows what a circuit *does*, not that it's correct — don't stop at a plausible waveform.
- **Don't weaken the oracle to pass** — the \`independence_basis\` makes that visible. Lead with what you checked, against what, at what tier.

## Writing circuits
Write each circuit as a standalone TS module: \`import { circuit, bit, bus } from '@simten/core/circuit'\`, stdlib from \`@simten/core/std\`, and **\`export\`** the top-level circuit so a testbench can import it. Don't write import-free code.

## Canvas & trust
\`show_circuit\` is the only tool that paints; the canvas is a one-way **viewer** (it displays/simulates what you push and sends nothing back). \`show_circuit\` is also the ONLY thing that updates the canvas — editing the \`.circuit.ts\` does NOT auto-update the browser; re-call \`show_circuit\` to repaint (at a verify pass, not during tight iteration). The web editor is a sandbox **view** of the file: the file you edit is the source of truth; in-browser edits are local experiments. \`verify_circuit\` runs the testbench on the host via \`tsx\` (full node/npm, your trust level — like \`npm test\`); open unfamiliar or shared circuits in the sandboxed web \`/circuit\` editor, not locally.
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
registerReferenceTools(server);

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
