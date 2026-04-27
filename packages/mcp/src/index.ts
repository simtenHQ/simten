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

import { registerCheckTool } from './tools/check.js';
import { registerSimulateTool } from './tools/simulate.js';
import { registerShowTools } from './tools/show.js';
import { registerStateTool } from './tools/state.js';
import { registerRunOnFpgaTool } from './tools/run_on_fpga.js';
import { registerReadWaveformTool } from './tools/read_waveform.js';
import { setOnSendToClaude, getOrCreateServer } from './lib/preview-singleton.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@simten/core/api';

const builderAPI = getGrammarHandler();
const primitivesList = getPrimitivesHandler({ compact: true }, getLibrary());

const instructions = `You help developers simulate and explore hardware systems using circuit simulation.

Build circuits from TypeScript, run simulations, and push live visualizations to a connected browser tab. When someone asks about a hardware concept, build a circuit that demonstrates it and simulate it so they can see it running.

## Circuit API

${builderAPI}

## Available Components

${primitivesList}

## Tools

- \`simulate_circuit\` — compile, simulate, and push waveforms to the browser (show: true by default)
- \`show_circuit\` — push circuit source for a live interactive view; supports file watching for editor workflows
- \`check_circuit\` — fast validation before simulating
- \`get_circuit_state\` — read current port values from the live browser preview
- \`list_sessions\` — list connected browser tabs
- \`run_on_fpga\` — build, flash, and UART-capture a project on a connected ULX3S FPGA (projects: cpu, snake, uart_test)
- \`read_waveform\` — query VCD waveform files (iverilog cross-validation, future ILA captures, etc.) for specific signals over a cycle window. Returns transitions + carry-in (changes), per-cycle values (raw), or filtered transitions (edges). Use \`test_name\` for the CPU verify-suite (e.g. "R-Type ADD basic") or \`vcd_path\` for arbitrary VCDs.
`;

const server = new McpServer(
  {
    name: 'simten',
    version: '0.1.0',
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
registerShowTools(server);
registerStateTool(server);
registerRunOnFpgaTool(server);
registerReadWaveformTool(server);

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
