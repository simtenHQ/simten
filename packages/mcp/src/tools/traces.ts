/**
 * show_traces tool — pushes simulation waveforms to the browser preview.
 *
 * Takes the output of simulate_circuit (signal traces in RLE format)
 * and sends it to the preview client for waveform visualization.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPreviewServer } from '../lib/preview-singleton.js';

const SignalEntry = z.object({
  value: z.union([z.number(), z.boolean()]),
  count: z.number(),
});

export function registerTracesTool(server: McpServer): void {
  server.tool(
    'show_traces',
    'Push simulation waveforms to the live circuit preview. Run simulate_circuit first, then pass its output here. Requires show_circuit to be running.',
    {
      circuit: z.string().describe('Name of the circuit'),
      ticks: z.number().describe('Number of ticks simulated'),
      inputs: z.array(z.string()).describe('Input port names'),
      outputs: z.array(z.string()).describe('Output port names'),
      signals: z
        .record(z.array(SignalEntry))
        .describe('Signal traces in RLE format: { portName: [{value, count}, ...] }'),
      steadyStateAt: z
        .number()
        .optional()
        .describe('Tick at which outputs stabilized (if applicable)'),
    },
    async (params) => {
      const preview = getPreviewServer();
      if (!preview) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: No preview is running. Call show_circuit first.',
            },
          ],
          isError: true,
        };
      }

      preview.pushTraces(params);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Waveforms for "${params.circuit}" (${params.ticks} ticks) pushed to preview.`,
          },
        ],
      };
    }
  );
}
