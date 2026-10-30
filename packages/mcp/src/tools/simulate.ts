/**
 * simulate_circuit tool - MCP wrapper. Observation only: it never paints the
 * canvas (show_circuit is the one tool that does).
 */

import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { readCircuitSource } from '../lib/file-reader.js';
import { loadsAsModule, simulateFile } from '../lib/load-file.js';
import { traceSource } from '../lib/trace-source.js';
import { inputsSchema, memoryDataSchema } from './run-options.js';

export function registerSimulateTool(server: McpServer): void {
  server.registerTool(
    'simulate_circuit',
    {
      description:
        'Compile and simulate a circuit and return signal traces and the steady-state cycle. OBSERVATION ONLY: this shows what the circuit does, NOT whether it is correct; use verify_circuit to establish correctness. Never touches the browser canvas; call show_circuit to paint.',
      inputSchema: z.strictObject({
        source: z.string().optional().describe('TypeScript circuit code as a string'),
        filePath: z.string().optional().describe('Path to a .circuit.ts file'),
        circuitName: z
          .string()
          .optional()
          .describe('Name of the circuit to simulate (defaults to last defined)'),
        ticks: z
          .number()
          .int()
          .min(1)
          .max(10000)
          .optional()
          .default(10)
          .describe('Number of clock ticks to simulate (default: 10)'),
        inputs: inputsSchema,
        memoryData: memoryDataSchema,
      }),
    },
    async ({ source, filePath, circuitName, ticks, inputs, memoryData }) => {
      const read = readCircuitSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      // A file loads as a module in a child process, the way verify_circuit
      // loads it; source text runs in-process. Either way the local agent's
      // compute is trusted (same model as the agent running tsx/npm test); no
      // sandbox. Hangs are bounded by core's tick cap (max 10000) and
      // unstable-loop guard, and a file's process by a timeout.
      const options = { circuitName, ticks, inputs, memoryData };
      const result =
        read.file && loadsAsModule(read.source)
          ? await simulateFile(read.file, options)
          : traceSource({ source: read.source, sourceName: read.sourceName, ...options });

      if ('error' in result) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
