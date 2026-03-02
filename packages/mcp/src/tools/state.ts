/**
 * get_circuit_state tool — reads current port values from the browser preview.
 *
 * Returns the cached circuit state that the preview client reports
 * via POST /api/state on each interaction (tick, toggle, reset).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPreviewServer } from '../lib/preview-singleton.js';

export function registerStateTool(server: McpServer): void {
  server.tool(
    'get_circuit_state',
    'Read current port values and cycle count from the live circuit preview. Requires show_circuit to be running first.',
    {},
    async () => {
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

      const state = preview.getState();
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
