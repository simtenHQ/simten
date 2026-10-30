/**
 * check_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { checkCircuit } from '../lib/check-circuit.js';
import { readCircuitSource } from '../lib/file-reader.js';
import { checkFile, loadsAsModule } from '../lib/load-file.js';

export function registerCheckTool(server: McpServer): void {
  server.registerTool(
    'check_circuit',
    {
      description:
        'Compile a circuit and report whether it builds: a compile error with its location, or the circuits it defines and the components they use. A file with imports loads as a module, so its own imports resolve; source text with no imports runs in-process. No setup needed.',
      inputSchema: z.strictObject({
        source: z.string().optional().describe('TypeScript circuit code as a string'),
        filePath: z.string().optional().describe('Path to a .circuit.ts file'),
      }),
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
