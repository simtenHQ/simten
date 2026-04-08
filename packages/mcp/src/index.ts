/**
 * Turing Incomplete MCP Server
 *
 * Exposes circuit simulation tools for Claude Code.
 * Build circuits, simulate them, and push live visualizations to a browser tab.
 *
 * Usage:
 *   claude mcp add turing-incomplete node packages/mcp/bin/turing-mcp.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerCheckTool } from './tools/check.js';
import { registerSimulateTool } from './tools/simulate.js';
import { registerShowTools } from './tools/show.js';
import { registerStateTool } from './tools/state.js';
import { setOnSendToClaude } from './lib/preview-singleton.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@turing-incomplete/core/api';

const builderAPI = getGrammarHandler();
const primitivesList = getPrimitivesHandler({ compact: true }, getLibrary());

const instructions = `You help developers simulate and explore hardware systems using circuit simulation.

Build circuits from TypeScript, run simulations, and push live visualizations to a connected browser tab. When someone asks about a hardware concept, build a circuit that demonstrates it and simulate it so they can see it running.

## Circuit Builder API

${builderAPI}

## Available Components

${primitivesList}

## Tools

- \`simulate_circuit\` — compile, simulate, and push waveforms to the browser (show: true by default)
- \`show_circuit\` — push circuit source for a live interactive view; supports file watching for editor workflows
- \`check_circuit\` — fast validation before simulating
- \`get_circuit_state\` — read current port values from the live browser preview
- \`list_sessions\` — list connected browser tabs
`;

const server = new McpServer(
  {
    name: 'turing-incomplete',
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
