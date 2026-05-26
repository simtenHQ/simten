/**
 * get_circuit_state tool — reads current port values from the browser.
 *
 * Sends a request to the browser via WebSocket and awaits the response.
 * Times out after 3 seconds if the browser doesn't respond.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPreviewServer } from '../lib/preview-singleton.js';

export function registerStateTool(server: McpServer): void {
  server.tool(
    'get_circuit_state',
    'Inspect the live tab the user is watching: read current port values and cycle count from a connected browser tab. For "what is this showing right now?" — not a correctness check (use verify_circuit) and not history (use read_waveform). Requires show_circuit to have been called first. Returns null if the tab is unresponsive after 3 seconds.',
    {
      session: z
        .string()
        .optional()
        .describe('Target a specific browser tab by session ID. If omitted, uses the most recently active tab.'),
    },
    async ({ session }) => {
      const preview = getPreviewServer();
      if (!preview) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: No studio server is running. Call show_circuit first.',
            },
          ],
          isError: true,
        };
      }

      const state = await preview.getState(session);

      if (state === null) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No response from browser. The tab may be closed, suspended, or unresponsive. Call show_circuit with no arguments to list connected tabs.',
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ state }, null, 2),
          },
        ],
      };
    }
  );
}
