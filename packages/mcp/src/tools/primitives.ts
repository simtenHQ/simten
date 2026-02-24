/**
 * get_primitives tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPrimitivesHandler, getLibrary } from '@turing-incomplete/core/api';

export function registerPrimitivesTool(server: McpServer): void {
  server.tool(
    'get_primitives',
    'Browse all available primitive components. Returns name, inputs, outputs, clocks, parameters, and description for each component. Optionally filter by kind.',
    {
      kind: z
        .enum(['combinational', 'sequential', 'sink'])
        .optional()
        .describe('Filter components by kind'),
    },
    async ({ kind }) => {
      const library = getLibrary();
      const text = getPrimitivesHandler({ kind }, library);
      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );
}
