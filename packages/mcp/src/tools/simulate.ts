/**
 * simulate_circuit tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readCircuitSource } from '../lib/file-reader.js';
import { loadsAsModule, simulateFile } from '../lib/load-file.js';
import { getPreviewServer } from '../lib/preview-singleton.js';
import { traceSource } from '../lib/trace-source.js';

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
        // Numeric, including for bit ports: a bit is 0 or 1. Booleans used to
        // be accepted here and reached `topLevelInputs` uncoerced, which
        // propagate.ts reads raw when building onTick's inputs — so a `true`
        // landed in sequential state verbatim.
        .record(z.string(), z.number())
        .optional()
        .describe('Initial input values as { portName: value }. Bits are 0 or 1.'),
      memoryData: z
        .record(z.string(), z.record(z.string(), z.number()))
        .optional()
        .describe(
          'Memory contents to load before the first tick, as { node: { address: value } }, e.g. { "rom": { "0": 62, "1": 7 } }. A node is named by its ID ("rom") or its path inside the circuit ("cpu.imem"); a name that matches no node is an error. Addresses are decimal integers, values are numbers; addresses left out read 0. Works with any ROM or RAM primitive.',
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
    async ({ source, filePath, circuitName, ticks, inputs, memoryData, show, reason }) => {
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
