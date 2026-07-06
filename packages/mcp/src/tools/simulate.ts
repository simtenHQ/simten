/**
 * simulate_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { simulateCircuit } from '@simten/core/api';
import { z } from 'zod';
import { readCircuitSource } from '../lib/file-reader.js';
import { getPreviewServer } from '../lib/preview-singleton.js';

export function registerSimulateTool(server: McpServer): void {
  server.tool(
    'simulate_circuit',
    'Compile and simulate a circuit and return signal traces + steady-state cycle. OBSERVATION ONLY — this shows what the circuit does, NOT whether it is correct; use verify_circuit to establish correctness. Does not touch the browser canvas unless show:true. Canvas policy: do not paint during tight iteration; paint at a verify tier-pass, or for a specific failure worth inspecting (pass show:true with a reason).',
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
          'Pre-load memory into sequential nodes. Keys are substring patterns matched against node IDs (e.g. "imem" matches any node containing "imem"). Values are { address: data } maps. Architecture-agnostic — works with any ROM/RAM primitive.',
        ),
      show: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Paint the waveforms onto the browser canvas after simulating (default: false). Requires `reason`.',
        ),
      reason: z
        .string()
        .optional()
        .describe(
          'Why you are painting the canvas (required when show:true), e.g. "counterexample at a=255,b=1".',
        ),
    },
    async ({
      source,
      filePath,
      circuitName,
      ticks,
      inputs,
      memoryData: memoryDataJson,
      show,
      reason,
    }) => {
      if (show && !reason) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: `reason` is required when show:true — state why you are painting the canvas (e.g. a tier-pass or a specific failure worth inspecting).',
            },
          ],
          isError: true,
        };
      }
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

      // Direct in-process call — the local agent's compute is trusted (same
      // model as the agent running tsx/npm test); no sandbox. Hangs are bounded
      // by core's tick cap (max 10000) and unstable-loop guard.
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
          // Update canvas diagram to match simulated circuit
          preview.updateSource(read.source);
          preview.pushTraces({
            circuit: result.circuit,
            ticks: result.ticks,
            vcd: result.vcd,
            ...(result.steadyStateAt !== undefined ? { steadyStateAt: result.steadyStateAt } : {}),
          });
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
