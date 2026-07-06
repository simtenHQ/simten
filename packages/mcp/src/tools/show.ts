/**
 * show_circuit tool — opens a live circuit preview in the browser.
 *
 * Starts a WebSocket server and pushes circuit source to the connected browser tab.
 * When a filePath is provided, watches the file for changes and pushes updates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { readCircuitSource } from '../lib/file-reader.js';
import { SIMTEN_URL, LOCAL_SERVE } from '../lib/config.js';
import {
  getOrCreateServer,
  getPreviewServer,
  setPreviewServer,
  getBrowserOpened,
  setBrowserOpened,
} from '../lib/preview-singleton.js';

/** Extract the first circuit name from source the MCP pushed (trusted), so the
 *  tool result never depends on a browser-reported name (viewer-only). */
function circuitNameFromSource(src: string): string {
  const m = src.match(/circuit\(\s*['"`]([A-Za-z0-9_$]+)['"`]/);
  return m ? m[1] : 'circuit';
}

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
    "Paint or update the live circuit canvas in the browser — the only tool that draws. This is the ONLY thing that updates the canvas: editing the .circuit.ts file does NOT auto-update the browser, so re-call show_circuit (typically after a verify tier-pass) to repaint. Call with NO source/filePath to list connected browser tabs (discovery). Pass close:true to close the preview and stop the server. Canvas policy: don't paint during tight iteration — paint at a verify tier-pass or for a specific result worth showing.",
    {
      source: z.string().optional().describe('TypeScript circuit code as a string'),
      filePath: z
        .string()
        .optional()
        .describe(
          'Path to a .circuit.ts file (read once; not watched — re-call show_circuit to repaint)',
        ),
      close: z.boolean().optional().describe('Close the live preview and stop the server.'),
      inputs: z
        .record(z.union([z.number(), z.boolean()]))
        .optional()
        .describe('Initial input values as { portName: value }'),
      memoryData: z
        .record(z.record(z.number()))
        .optional()
        .describe(
          'Pre-load memory into sequential nodes. Keys are glob patterns matched against node IDs (e.g. "imem" matches any node containing "imem", "cpu0*imem" targets cpu0\'s imem only). Values are { address: data } maps. Architecture-agnostic.',
        ),
      session: z
        .string()
        .optional()
        .describe(
          'Target a specific browser tab by session ID. If omitted, uses the most recently active tab or opens a new one.',
        ),
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
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No studio server is running. Call show_circuit with a circuit to start one.',
              },
            ],
          };
        }
        // VIEWER-ONLY: report only a count. Session fields (id/page) are
        // browser-supplied and untrusted — never echo them into a tool result
        // (see the security note in ws-server.ts).
        const count = preview.sessions.size;
        return {
          content: [
            {
              type: 'text' as const,
              text:
                count > 0
                  ? `${count} browser tab${count === 1 ? '' : 's'} connected.`
                  : 'No browser tabs are connected.',
            },
          ],
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

      // 3. Pre-load memory before the push, so a freshly connecting tab
      // receives it alongside its first render. (The file is read once for its
      // source above — NOT watched; show_circuit is the sole canvas trigger.)
      if (memoryData) studio.pushMemoryData(memoryData, session);

      // 4. Push the source and AWAIT the render acknowledgment.
      //   - Connected tab: await its render directly.
      //   - Fresh open: arm the ack, open the browser, await the new tab's first render.
      let render: Awaited<ReturnType<typeof studio.updateSourceAndAwait>>;
      if (studio.sessions.size > 0) {
        render = await studio.updateSourceAndAwait(read.source, session);
      } else {
        const pending = studio.updateSourceAndAwaitConnect(read.source);
        // Prefer the same-origin localhost page (page + WS share one origin →
        // no Local Network Access block). Fall back to SIMTEN_URL when the user
        // set it, or when the editor wasn't bundled into this build (dev/source).
        const fragment = `#token=${studio.token}&port=${studio.port}`;
        let pageUrl: string;
        if (LOCAL_SERVE && studio.servesStatic) {
          // The standalone viewer is served at the root path (not /circuit,
          // which is the deployed route on simten.dev).
          pageUrl = `http://localhost:${studio.port}/${fragment}`;
        } else {
          if (LOCAL_SERVE && !studio.servesStatic) {
            process.stderr.write(
              '[simten-mcp] bundled editor not found (dist/public missing); opening ' +
                `${SIMTEN_URL} instead. A hosted origin needs the browser to grant Local Network Access.\n`,
            );
          }
          pageUrl = `${SIMTEN_URL}/circuit${fragment}`;
        }
        openBrowser(pageUrl);
        render = await pending;
      }

      // 5. Report, leading with the render acknowledgment.
      const sessionNote = session ? ` (session: ${session})` : '';
      if (!render.ok && !render.timedOut) {
        // The browser reported a render failure (boolean ack). VIEWER-ONLY: do
        // NOT echo the browser's error string — it is untrusted. Report the
        // failure only (see the security note in ws-server.ts).
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pushed to the browser, but it reported a render failure. Check the circuit compiles (try check_circuit), then call show_circuit again.`,
            },
          ],
          isError: true,
        };
      }
      if (!render.ok && render.timedOut) {
        // Never heard back (slow or no browser) — not necessarily an error.
        return {
          content: [
            {
              type: 'text' as const,
              text: `Circuit pushed; render not yet confirmed (${render.error ?? 'timed out'}). The tab may still be loading — check the browser.${sessionNote}`,
            },
          ],
        };
      }
      return {
        // Name derived from the source the MCP pushed — NOT from the browser
        // (viewer-only: browser-reported names are untrusted).
        content: [
          {
            type: 'text' as const,
            text: `Circuit preview running. Rendered as "${circuitNameFromSource(read.source)}".${sessionNote}`,
          },
        ],
      };
    },
  );
}
