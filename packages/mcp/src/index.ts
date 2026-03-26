/**
 * Turing Incomplete MCP Server
 *
 * Exposes the DSL parser, validator, simulator, and testbench runner
 * as structured MCP tools for Claude Code.
 *
 * Also acts as a channel: browser users can send messages to Claude
 * via WebSocket → channel notification, and Claude responds via
 * the push_chat_response tool.
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
import { registerStateTool } from './tools/state.js';
import { registerTracesTool } from './tools/traces.js';
import { registerTestResultsTool } from './tools/test-results.js';
import { registerChallengeTools } from './tools/challenges.js';
import { setOnSendToClaude, getPreviewServer } from './lib/preview-singleton.js';
import { z } from 'zod';

const server = new McpServer(
  {
    name: 'turing-incomplete',
    version: '0.1.0',
  },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
    },
    instructions:
      'You are assisting a user learning digital hardware design on Turing Incomplete.\n\n' +
      'Challenge prompts arrive as <channel source="turing-incomplete" type="challenge_prompt" challenge_id="..." level_id="...">.\n' +
      'When you receive one, respond helpfully in the context of that challenge level. If the prompt asks you to wire up a circuit, use solve_next to add connections one by one.\n\n' +
      'DSL syntax errors arrive as <channel source="turing-incomplete" type="dsl_error">.\n' +
      'When you receive one, use get_circuit_state to read the current DSL, fix the error, and push the corrected DSL.\n\n' +
      'IMPORTANT: After handling any channel message, always call push_chat_response with your response text (markdown supported). This is the only way the user sees your reply — the in-app chat displays it. Keep responses concise and educational.',
  },
);

// Register all tools
registerPrimitivesTool(server);
registerGrammarTool(server);
registerCheckTool(server);
registerSimulateTool(server);
registerTestTool(server);
registerShowTools(server);
registerStateTool(server);
registerTracesTool(server);
registerTestResultsTool(server);
registerChallengeTools(server);

// push_chat_response tool — sends Claude's response to the in-app chat panel
server.tool(
  'push_chat_response',
  'Send a response to the in-app chat panel. Call this after handling a channel message. Markdown supported.',
  { text: z.string().describe('The response text to display in the chat panel') },
  async ({ text }) => {
    const preview = getPreviewServer();
    if (preview) {
      preview.pushChatMessage(text);
    }
    return {
      content: [{ type: 'text' as const, text: 'Response sent to chat panel.' }],
    };
  },
);

// Access the raw Server instance for channel notifications
const rawServer = server.server;

// Wire browser → Claude channel notifications
// When the browser sends { type: 'send-to-claude', content, meta },
// the WebSocket server calls this callback, which fires a channel notification
// to Claude via the MCP protocol.
setOnSendToClaude((content, meta) => {
  rawServer.notification({
    method: 'notifications/claude/channel',
    params: { content, meta },
  });
});

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
