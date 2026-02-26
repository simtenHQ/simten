/**
 * Turing Incomplete MCP Server
 *
 * Exposes the DSL parser, validator, simulator, and testbench runner
 * as structured MCP tools for Claude Code.
 *
 * Usage:
 *   claude mcp add turing-incomplete node packages/mcp/bin/turing-mcp.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerPrimitivesTool } from './tools/primitives.js';
import { registerGrammarTool } from './tools/grammar.js';
import { registerCheckTool } from './tools/check.js';
import { registerSimulateTool } from './tools/simulate.js';
import { registerTestTool } from './tools/test.js';
import { registerShowTools } from './tools/show.js';

const server = new McpServer({
  name: 'turing-incomplete',
  version: '0.1.0',
});

// Register all tools
registerPrimitivesTool(server);
registerGrammarTool(server);
registerCheckTool(server);
registerSimulateTool(server);
registerTestTool(server);
registerShowTools(server);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
