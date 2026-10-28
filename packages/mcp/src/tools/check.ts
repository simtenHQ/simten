/**
 * check_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkCircuit } from '../lib/check-circuit.js';
import { readCircuitSource } from '../lib/file-reader.js';
import { checkFile, loadsAsModule } from '../lib/load-file.js';

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

      // A file loads as a module, the way verify_circuit loads it; source text
      // runs in-process.
      const result =
        read.file && loadsAsModule(read.source)
          ? await checkFile(read.file)
          : checkCircuit({ source: read.source, sourceName: read.sourceName });
      if ('error' in result) {
        return { content: [{ type: 'text' as const, text: result.error }], isError: true };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
