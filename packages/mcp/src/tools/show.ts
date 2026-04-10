/**
 * show_circuit tool — opens a live circuit preview in the browser.
 *
 * Starts a WebSocket server and pushes circuit source to the connected browser tab.
 * When a filePath is provided, watches the file for changes and pushes updates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { resolve } from 'node:path';
import { readCircuitSource } from '../lib/file-reader.js';
import { TI_URL } from '../lib/config.js';
import { checkCircuit } from '@simten/core/api';
import {
  getOrCreateServer,
  getPreviewServer,
  setPreviewServer,
  getBrowserOpened,
  setBrowserOpened,
} from '../lib/preview-singleton.js';

function openBrowser(url: string) {
  if (getBrowserOpened()) return;
  setBrowserOpened(true);

  // Cross-platform open
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      // Non-fatal — user can open manually
      console.error(`[show_circuit] Could not open browser: ${err.message}`);
    }
  });
}

export function registerShowTools(server: McpServer): void {
  // hide_circuit — close the preview server and browser tab
  server.tool(
    'hide_circuit',
    'Close the live circuit preview and stop the server.',
    {},
    async () => {
      const preview = getPreviewServer();
      if (!preview) {
        return {
          content: [{ type: 'text' as const, text: 'No preview is running.' }],
        };
      }
      preview.close();
      setPreviewServer(null);
      setBrowserOpened(false);
      return {
        content: [{ type: 'text' as const, text: 'Preview closed.' }],
      };
    }
  );

  // list_sessions — show all connected browser tabs
  server.tool(
    'list_sessions',
    'List all connected browser tabs with their session IDs, page URLs, and current circuit names. Use this to discover which tabs are available for show_circuit or get_circuit_state.',
    {},
    async () => {
      const preview = getPreviewServer();
      if (!preview) {
        return {
          content: [{ type: 'text' as const, text: 'No studio server is running. Call show_circuit to start one.' }],
        };
      }

      const sessionList = Array.from(preview.sessions.values()).map(s => ({
        id: s.id,
        page: s.page,
        circuitName: s.circuitName,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: sessionList.length > 0
            ? JSON.stringify(sessionList, null, 2)
            : 'No browser tabs are connected.',
        }],
      };
    }
  );

  // show_circuit — open or update the live preview
  server.tool(
    'show_circuit',
    'Open a live circuit preview in the browser. Updates automatically when the file changes. Optionally target a specific browser tab by session ID.',
    {
      source: z.string().optional().describe('TypeScript circuit code as a string'),
      filePath: z
        .string()
        .optional()
        .describe('Path to a .circuit.ts file (will be watched for changes)'),
      inputs: z
        .record(z.union([z.number(), z.boolean()]))
        .optional()
        .describe('Initial input values as { portName: value }'),
      memoryData: z
        .record(z.record(z.number()))
        .optional()
        .describe(
          'Pre-load memory into sequential nodes. Keys are glob patterns matched against node IDs (e.g. "imem" matches any node containing "imem", "cpu0*imem" targets cpu0\'s imem only). Values are { address: data } maps. Architecture-agnostic.'
        ),
      session: z
        .string()
        .optional()
        .describe('Target a specific browser tab by session ID. If omitted, uses the most recently active tab or opens a new one.'),
    },
    async ({ source, filePath, inputs, memoryData, session }) => {
      // 1. Read circuit source
      const read = readCircuitSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      // 2. Validate circuit source before pushing to browser
      const check = checkCircuit(
        { source: read.source, sourceName: read.sourceName },
      );
      if (!check.valid) {
        const msgs = check.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.message)
          .join('\n');
        return {
          content: [{ type: 'text' as const, text: `Validation failed:\n${msgs}` }],
          isError: true,
        };
      }

      // 3. Start or get existing studio server
      let studio;
      try {
        studio = await getOrCreateServer();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error starting studio server: ${message}`,
            },
          ],
          isError: true,
        };
      }

      // 4. Push source to the target session
      studio.updateSource(read.source, session);

      // 4b. Push memory data if provided
      if (memoryData) {
        studio.pushMemoryData(memoryData, session);
      }

      // 5. Watch file for changes if path provided
      if (filePath) {
        studio.watchFile(resolve(filePath));
      }

      // 6. Open browser on first call (token passed via fragment — never sent to server)
      const editorUrl = `${TI_URL}/editor#token=${studio.token}&port=${studio.port}`;
      openBrowser(editorUrl);

      // 7. Return confirmation
      const watchingNote = filePath
        ? ` Watching ${resolve(filePath)} for changes.`
        : '';
      const sessionNote = session ? ` (session: ${session})` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Circuit preview running.${watchingNote}${sessionNote}`,
          },
        ],
      };
    }
  );
}
