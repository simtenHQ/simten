/**
 * simulate_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { simulateCircuit } from '@simten/core/api';
import { readCircuitSource } from '../lib/file-reader.js';
import { getPreviewServer } from '../lib/preview-singleton.js';

export function registerSimulateTool(server: McpServer): void {
  server.tool(
    'simulate_circuit',
    'Compile and simulate a circuit. Automatically pushes waveforms to the browser preview if one is open (set show: false to suppress). Returns signal traces and steady-state cycle.',
    {
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
      inputs: z
        .record(z.union([z.number(), z.boolean()]))
        .optional()
        .describe('Initial input values as { portName: value }'),
      memoryData: z
        .record(z.record(z.number()))
        .optional()
        .describe(
          'Pre-load memory into sequential nodes. Keys are substring patterns matched against node IDs (e.g. "imem" matches any node containing "imem"). Values are { address: data } maps. Architecture-agnostic — works with any ROM/RAM primitive.'
        ),
      show: z
        .boolean()
        .optional()
        .default(true)
        .describe('Push waveforms to the browser preview after simulating (default: true)'),
    },
    async ({ source, filePath, circuitName, ticks, inputs, memoryData: memoryDataJson, show }) => {
      const read = readCircuitSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      // Convert JSON memoryData to Map<string, Map<number, number>>
      let memoryData: Map<string, Map<number, number>> | undefined;
      if (memoryDataJson) {
        memoryData = new Map();
        for (const [pattern, addrMap] of Object.entries(memoryDataJson)) {
          const innerMap = new Map<number, number>();
          for (const [addr, value] of Object.entries(addrMap)) {
            innerMap.set(Number(addr), value);
          }
          memoryData.set(pattern, innerMap);
        }
      }

      const result = simulateCircuit({
        source: read.source,
        sourceName: read.sourceName,
        circuitName,
        ticks,
        inputs,
        memoryData,
      });

      if ('error' in result) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      if (show) {
        const preview = getPreviewServer();
        if (preview) {
          preview.pushTraces(result);
        }
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
