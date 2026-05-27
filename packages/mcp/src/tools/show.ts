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
  // show_circuit — the only tool that paints the canvas. Also handles closing
  // the preview (close:true) and discovering connected tabs (no source/filePath).
  server.tool(
    'show_circuit',
    'Paint or update the live circuit canvas in the browser — the only tool that draws. Watches the file for changes when filePath is given. Call with NO source/filePath to list connected browser tabs (discovery). Pass close:true to close the preview and stop the server. Canvas policy: don\'t paint during tight iteration — paint at a verify tier-pass or for a specific result worth showing.',
    {
      source: z.string().optional().describe('TypeScript circuit code as a string'),
      filePath: z
        .string()
        .optional()
        .describe('Path to a .circuit.ts file (will be watched for changes)'),
      close: z
        .boolean()
        .optional()
        .describe('Close the live preview and stop the server.'),
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
    async ({ source, filePath, close, inputs, memoryData, session }) => {
      // close:true — tear down the preview (absorbs the old hide_circuit tool)
      if (close) {
        const preview = getPreviewServer();
        if (!preview) {
          return { content: [{ type: 'text' as const, text: 'No preview is running.' }] };
        }
        preview.close();
        setPreviewServer(null);
        setBrowserOpened(false);
        return { content: [{ type: 'text' as const, text: 'Preview closed.' }] };
      }

      // No source/filePath — discovery: list connected tabs (absorbs list_sessions)
      if (!source && !filePath) {
        const preview = getPreviewServer();
        if (!preview) {
          return { content: [{ type: 'text' as const, text: 'No studio server is running. Call show_circuit with a circuit to start one.' }] };
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

      const hadSession = studio.sessions.size > 0;

      // 4. Push source. If a tab is already connected, await its render
      // acknowledgment so the result reflects whether it actually rendered
      // (no polling/sleep). For a fresh open, push without awaiting — the tab
      // will render on connect (the await would just time out).
      let render: Awaited<ReturnType<typeof studio.updateSourceAndAwait>> | null = null;
      if (hadSession) {
        render = await studio.updateSourceAndAwait(read.source, session);
      } else {
        studio.updateSource(read.source, session);
      }

      // 4b. Push memory data if provided
      if (memoryData) {
        studio.pushMemoryData(memoryData, session);
      }

      // 5. Watch file for changes if path provided
      if (filePath) {
        studio.watchFile(resolve(filePath));
      }

      // 6. Open browser only if no sessions are connected
      // With persistent tokens, an existing tab will reconnect automatically on MCP restart
      if (!hadSession) {
        const editorUrl = `${TI_URL}/circuit#token=${studio.token}&port=${studio.port}`;
        openBrowser(editorUrl);
      }

      // 7. Return confirmation, including the render acknowledgment when we have one
      const watchingNote = filePath ? ` Watching ${resolve(filePath)} for changes.` : '';
      const sessionNote = session ? ` (session: ${session})` : '';
      if (render && !render.ok) {
        return {
          content: [{ type: 'text' as const, text: `Pushed to the browser, but render was not confirmed: ${render.error ?? 'unknown'}.${render.timedOut ? '' : ' (The circuit may have a compile error — check the editor.)'}` }],
          isError: true,
        };
      }
      const renderedNote = render?.ok ? ` Rendered as "${render.circuitName ?? 'circuit'}".` : ' Opening browser; it will render on connect.';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Circuit preview running.${renderedNote}${watchingNote}${sessionNote}`,
          },
        ],
      };
    }
  );
}
