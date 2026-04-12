/**
 * check_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readCircuitSource } from '../lib/file-reader.js';
import { sandboxCheck } from '../lib/mcp-sandbox.js';

export function registerCheckTool(server: McpServer): void {
  server.tool(
    'check_circuit',
    'Parse and validate circuit source code. Returns structured diagnostics including errors, warnings, and suggestions. Runs the full 4-phase validation pipeline: syntax, semantic, type, and structural checks.',
    {
      source: z.string().optional().describe('TypeScript circuit code as a string'),
      filePath: z.string().optional().describe('Path to a .circuit.ts file'),
    },
    async ({ source, filePath }) => {
      const read = readCircuitSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      const result = await sandboxCheck({ source: read.source, sourceName: read.sourceName });

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
