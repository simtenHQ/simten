/**
 * show_circuit tool — opens a live circuit preview in the browser.
 *
 * Starts a WebSocket server and pushes circuit source to the connected browser tab,
 * with how its run starts (memoryData, inputs). A filePath is read once, not
 * watched: show_circuit is the only thing that repaints.
 */

import { exec } from 'node:child_process';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { LOCAL_SERVE, SIMTEN_URL } from '../lib/config.js';
import { readCircuitSource } from '../lib/file-reader.js';
import {
  getBrowserOpened,
  getOrCreateServer,
  getPreviewServer,
  setBrowserOpened,
  setPreviewServer,
} from '../lib/preview-singleton.js';
import type { RenderResult, SourcePush } from '../server/types.js';
import type { StudioServer } from '../server/ws-server.js';
import { inputsSchema, memoryDataSchema } from './run-options.js';

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

type ShowResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function text(message: string, isError = false): ShowResult {
  return { content: [{ type: 'text', text: message }], ...(isError ? { isError } : {}) };
}

/** close:true: tear down the preview (absorbs the old hide_circuit tool). */
function closePreview(): ShowResult {
  const preview = getPreviewServer();
  if (!preview) return text('No preview is running.');
  preview.close();
  setPreviewServer(null);
  setBrowserOpened(false);
  return text('Preview closed.');
}

/** No source/filePath: count connected tabs (absorbs list_sessions). */
function countTabs(): ShowResult {
  const preview = getPreviewServer();
  if (!preview) {
    return text('No studio server is running. Call show_circuit with a circuit to start one.');
  }
  // VIEWER-ONLY: report only a count. Session fields (id/page) are
  // browser-supplied and untrusted — never echo them into a tool result
  // (see the security note in ws-server.ts).
  const count = preview.sessions.size;
  return text(
    count > 0
      ? `${count} browser tab${count === 1 ? '' : 's'} connected.`
      : 'No browser tabs are connected.',
  );
}

/**
 * The page a fresh tab opens. Prefer the same-origin localhost page (page + WS
 * share one origin → no Local Network Access block). Fall back to SIMTEN_URL
 * when the user set it, or when the editor wasn't bundled into this build.
 */
function pageUrlFor(studio: StudioServer): string {
  const fragment = `#token=${studio.token}&port=${studio.port}`;
  // The standalone viewer is served at the root path (not /circuit, which is
  // the deployed route on simten.dev).
  if (LOCAL_SERVE && studio.servesStatic) return `http://localhost:${studio.port}/${fragment}`;
  if (LOCAL_SERVE) {
    process.stderr.write(
      '[simten-mcp] bundled editor not found (dist/public missing); opening ' +
        `${SIMTEN_URL} instead. A hosted origin needs the browser to grant Local Network Access.\n`,
    );
  }
  return `${SIMTEN_URL}/circuit${fragment}`;
}

/**
 * Push and AWAIT the render acknowledgment: from a connected tab directly, or
 * on a fresh open, from the new tab's first render.
 */
async function pushAndAwait(
  studio: StudioServer,
  push: SourcePush,
  session: string | undefined,
): Promise<RenderResult> {
  if (studio.sessions.size > 0) return studio.updateSourceAndAwait(push, session);
  const pending = studio.updateSourceAndAwaitConnect(push);
  openBrowser(pageUrlFor(studio));
  return pending;
}

/** The tool result for a render, leading with the acknowledgment. */
function renderReport(render: RenderResult, source: string, session?: string): ShowResult {
  const sessionNote = session ? ` (session: ${session})` : '';
  if (!render.ok && !render.timedOut) {
    // The browser reported a render failure (boolean ack). VIEWER-ONLY: do
    // NOT echo the browser's error string — it is untrusted. Report the
    // failure only (see the security note in ws-server.ts).
    return text(
      "Pushed to the browser, but it reported a render failure. Check the circuit compiles (try check_circuit) and that every inputs key and memoryData path names something in it (simulate_circuit reports which one doesn't), then call show_circuit again.",
      true,
    );
  }
  if (!render.ok) {
    // Never heard back (slow or no browser) — not necessarily an error.
    return text(
      `Circuit pushed; render not yet confirmed (${render.error ?? 'timed out'}). The tab may still be loading — check the browser.${sessionNote}`,
    );
  }
  // Name derived from the source the MCP pushed — NOT from the browser
  // (viewer-only: browser-reported names are untrusted).
  return text(
    `Circuit preview running. Rendered as "${circuitNameFromSource(source)}".${sessionNote}`,
  );
}

export function registerShowTools(server: McpServer): void {
  // show_circuit — the only tool that paints the canvas. Also handles closing
  // the preview (close:true) and discovering connected tabs (no source/filePath).
  server.registerTool(
    'show_circuit',
    {
      description:
        "Paint or update the live circuit canvas in the browser. This is the only tool that draws, and the ONLY thing that updates the canvas: editing the .circuit.ts file does NOT update the browser, so call show_circuit again (typically after a verify tier-pass) to repaint. inputs and memoryData start the canvas's run the way they start simulate_circuit's. Call with NO source/filePath to count connected browser tabs. Pass close:true to close the preview and stop the server. Canvas policy: don't paint during tight iteration; paint at a verify tier-pass or for a specific result worth showing.",
      inputSchema: z.strictObject({
        source: z.string().optional().describe('TypeScript circuit code as a string'),
        filePath: z
          .string()
          .optional()
          .describe(
            'Path to a .circuit.ts file (read once, not watched: call show_circuit again to repaint)',
          ),
        close: z.boolean().optional().describe('Close the live preview and stop the server.'),
        inputs: inputsSchema,
        memoryData: memoryDataSchema,
        session: z
          .string()
          .optional()
          .describe(
            'Target a specific browser tab by session ID. If omitted, uses the most recently active tab or opens a new one.',
          ),
      }),
    },
    async ({ source, filePath, close, inputs, memoryData, session }) => {
      if (close) return closePreview();
      if (!source && !filePath) return countTabs();

      const read = readCircuitSource({ source, filePath });
      if (read.error) return text(`Error: ${read.error}`, true);

      // There is no server-side pre-flight: the browser is the real execution
      // environment (incl. npm via esm.sh), so its render acknowledgment, not a
      // Node-side check that can't resolve npm, is the source of truth.
      let studio: StudioServer;
      try {
        studio = await getOrCreateServer();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return text(`Error starting studio server: ${message}`, true);
      }

      // The source goes with how its run starts, so the page opens the run
      // with them in place; a key or path that doesn't resolve fails the
      // render. (The file is read once for its source above, NOT watched.)
      const push: SourcePush = {
        source: read.source,
        ...(memoryData ? { memory: memoryData } : {}),
        ...(inputs ? { inputs } : {}),
      };
      const render = await pushAndAwait(studio, push, session);
      return renderReport(render, read.source, session);
    },
  );
}
