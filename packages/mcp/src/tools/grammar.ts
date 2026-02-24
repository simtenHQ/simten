/**
 * get_grammar tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGrammarHandler } from '@turing-incomplete/core/api';

export function registerGrammarTool(server: McpServer): void {
  server.tool(
    'get_grammar',
    'Return the Turing Incomplete DSL syntax reference. Shows the grammar template and a concrete example.',
    {},
    async () => {
      const grammar = getGrammarHandler();
      return {
        content: [{ type: 'text' as const, text: grammar }],
      };
    }
  );
}
