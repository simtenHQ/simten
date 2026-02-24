/**
 * simulate_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { simulateCircuit } from '@turing-incomplete/core/api';
import { readDSLSource } from '../lib/file-reader.js';

export function registerSimulateTool(server: McpServer): void {
  server.tool(
    'simulate_circuit',
    'Compile and simulate a circuit. Returns per-cycle signal traces for all inputs and outputs. Optionally set initial input values and number of ticks.',
    {
      source: z.string().optional().describe('DSL source code as a string'),
      filePath: z.string().optional().describe('Path to a .dsl file'),
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
      inputs: z
        .record(z.union([z.number(), z.boolean()]))
        .optional()
        .describe('Initial input values as { portName: value }'),
    },
    async ({ source, filePath, circuitName, ticks, inputs }) => {
      const read = readDSLSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      const result = simulateCircuit({
        source: read.source,
        sourceName: read.sourceName,
        circuitName,
        ticks,
        inputs,
      });

      if ('error' in result) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
