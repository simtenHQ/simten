/**
 * get_grammar tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGrammarHandler } from '@turing-incomplete/core/api';

export function registerGrammarTool(server: McpServer): void {
  server.tool(
    'get_grammar',
    'Return the Turing Incomplete circuit API reference. Shows available primitives and the circuit() builder syntax.',
    {},
    async () => {
      const grammar = getGrammarHandler();
      return {
        content: [{ type: 'text' as const, text: grammar }],
      };
    }
  );
}
