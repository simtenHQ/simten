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
import { registerStateTool } from './tools/state.js';
import { registerRunOnFpgaTool } from './tools/run_on_fpga.js';
import { registerReadWaveformTool } from './tools/read_waveform.js';
import { setOnSendToClaude, getOrCreateServer, getPreviewServer } from './lib/preview-singleton.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@simten/core/api';
import { getFactoryOptionSignatures, annotatePrimitivesWithOptions } from './lib/primitive-params.js';
import { z } from 'zod';

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

**Project setup for verify_circuit (first time per project):** the testbench's tsx subprocess needs \`@simten/core\` and \`fast-check\` resolvable from the project containing the testbench. The MCP itself bundles these but Node's resolver only walks up from the testbench file, never into the MCP's install. If you're working in a new project that doesn't have them yet, install them once up front (\`pnpm add -D @simten/core fast-check\` or your project's equivalent) — verify_circuit will give you the exact command in its error message if you forget. After that, no further setup is needed.

## Circuit API

${builderAPI}

## Available Components

${primitivesList}

## The contract (read this)

- **Done = correct, at a declared tier.** A non-trivial design is complete only when \`verify_circuit\` passes at the highest feasible oracle tier (its description defines the tiers), **AND** existing sibling \`.verify.ts\` still pass (no regression — re-run them for any circuit you touched), **AND** for integrated/multi-module changes a system-level verify exists. \`simulate_circuit\` shows what a circuit *does*; it does NOT establish correctness — don't stop at a plausible-looking waveform.
- **A named spec is the oracle.** If the prompt states the spec, verify against it; don't re-elicit. Surface acceptance criteria (via \`push_chat_response\`) before building only on vague prompts for non-trivial designs.
- **The gate enforces the oracle regardless of the order you wrote things in.** Testbench-first is recommended (harder to retrofit a softball), not required. Don't weaken the oracle to pass — the \`independence_basis\` makes that visible.
- **Surface what you checked.** Lead your chat reply with the oracle (what was checked, against what, at what tier), not just pass/fail.

## Tools

- \`check_circuit\` — fast well-formedness validation (syntax/semantic/type/structural).
- \`simulate_circuit\` — run it, return traces. Observation only; does not paint the canvas unless \`show: true\`.
- \`verify_circuit\` — run a self-checking testbench *file* (a \`circuits/<name>.verify.ts\` that imports its DUT) on the host; reports pass/fail + counterexample at a declared oracle tier. See its description for tiers and how to write the testbench.
- \`show_circuit\` — paint/update the live canvas (call with no source to list connected tabs; \`close: true\` to close). The only tool that draws.
- \`get_circuit_state\` — read port values from the tab the user is currently watching.
- \`run_on_fpga\` — build, flash, and UART-capture a project on a connected ULX3S FPGA (projects: cpu, snake, uart_test).
- \`read_waveform\` — query VCD files (iverilog cross-validation, ILA captures) for signals over a cycle window. Use \`test_name\` for the CPU verify-suite or \`vcd_path\` for arbitrary VCDs.
- \`push_chat_response\` — send a reply to the in-app chat panel. Markdown supported.

## Canvas + chat

The canvas only paints via \`show_circuit\` (or \`simulate_circuit\` with \`show: true\`). Don't paint during tight iteration — paint at a verify tier-pass, or for a specific failure worth inspecting. Headless (no canvas connected): paint calls simply no-op.

Messages the user types into the in-app chat arrive as \`<channel source="simten" ...>\` events. After handling one, **always call \`push_chat_response\`** — it's the only way the user sees your reply (they're in the browser, not the terminal). Keep it concise.

## Trust

\`verify_circuit\` runs the testbench on the host via \`tsx\` — full node/npm, under your own trust model (same as the agent running \`npm test\`). Appropriate for circuits you authored or trust. **Unfamiliar or shared circuits should be opened in the web \`/circuit\` editor** (a sandboxed worker), not run locally.
`;

const server = new McpServer(
  {
    name: 'simten',
    version: pkg.version,
  },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
    },
    instructions,
  },
);

registerCheckTool(server);
registerSimulateTool(server);
registerVerifyTool(server);
registerShowTools(server);
registerStateTool(server);
registerRunOnFpgaTool(server);
registerReadWaveformTool(server);

// push_chat_response — reply path for channel messages from the editor chat panel
server.tool(
  'push_chat_response',
  'Send a response to the in-app chat panel in the user\'s browser. Call this after handling a channel message — it is the only way the user sees your reply. Markdown supported.',
  { text: z.string().describe('The response text to display in the chat panel (markdown supported)') },
  async ({ text }) => {
    const preview = getPreviewServer();
    if (!preview) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: 'No preview server running — open the editor at /circuit first.' }],
      };
    }
    preview.pushChatMessage(text);
    return { content: [{ type: 'text' as const, text: 'Response sent to chat panel.' }] };
  },
);

// Wire browser → Claude channel notifications
const rawServer = server.server;
setOnSendToClaude((content, meta) => {
  rawServer.notification({
    method: 'notifications/claude/channel',
    params: { content, meta },
  });
});

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
