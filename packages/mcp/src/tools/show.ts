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
import { SIMTEN_URL } from '../lib/config.js';
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

      // 2. Start or get existing studio server. There is no server-side
      // pre-flight: the browser is the real execution environment (incl. npm
      // via esm.sh), so its render acknowledgment — not a Node-side check that
      // can't resolve npm — is the source of truth for whether it rendered.
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

      // 3. Pre-load memory + arm file watching before the push, so a freshly
      // connecting tab receives them alongside its first render.
      if (memoryData) studio.pushMemoryData(memoryData, session);
      if (filePath) studio.watchFile(resolve(filePath));

      // 4. Push the source and AWAIT the render acknowledgment.
      //   - Connected tab: await its render directly.
      //   - Fresh open: arm the ack, open the browser, await the new tab's first render.
      let render: Awaited<ReturnType<typeof studio.updateSourceAndAwait>>;
      if (studio.sessions.size > 0) {
        render = await studio.updateSourceAndAwait(read.source, session);
      } else {
        const pending = studio.updateSourceAndAwaitConnect(read.source);
        openBrowser(`${SIMTEN_URL}/circuit#token=${studio.token}&port=${studio.port}`);
        render = await pending;
      }

      // 5. Report, leading with the render acknowledgment.
      const watchingNote = filePath ? ` Watching ${resolve(filePath)} for changes.` : '';
      const sessionNote = session ? ` (session: ${session})` : '';
      if (!render.ok && !render.timedOut) {
        // The browser actually reported an error — surface the real reason so
        // the agent can fix the circuit and retry.
        return {
          content: [{ type: 'text' as const, text: `Pushed to the browser, but it failed to render: ${render.error ?? 'unknown error'}. Fix the circuit and call show_circuit again.` }],
          isError: true,
        };
      }
      if (!render.ok && render.timedOut) {
        // Never heard back (slow or no browser) — not necessarily an error.
        return {
          content: [{ type: 'text' as const, text: `Circuit pushed; render not yet confirmed (${render.error ?? 'timed out'}). The tab may still be loading — check the browser.${watchingNote}${sessionNote}` }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `Circuit preview running. Rendered as "${render.circuitName ?? 'circuit'}".${watchingNote}${sessionNote}` }],
      };
    }
  );
}
