/**
 * show_circuit tool — opens a live circuit preview in the browser.
 *
 * Starts a local HTTP server that serves a React SPA with SSE updates.
 * When a filePath is provided, watches the file for changes and pushes updates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { resolve } from 'node:path';
import { readDSLSource } from '../lib/file-reader.js';
import { checkCircuit, getLibrary } from '@turing-incomplete/core/api';
import { generateHarnessAppended } from '@turing-incomplete/core/dsl';
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

  // show_circuit — open or update the live preview
  server.tool(
    'show_circuit',
    'Open a live circuit preview in the browser. Updates automatically when the file changes.',
    {
      source: z.string().optional().describe('DSL source code as a string'),
      filePath: z
        .string()
        .optional()
        .describe('Path to a .dsl file (will be watched for changes)'),
    },
    async ({ source, filePath }) => {
      // 1. Read DSL
      const read = readDSLSource({ source, filePath });
      if (read.error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
          isError: true,
        };
      }

      // 2. Validate DSL before pushing to browser
      const library = getLibrary();
      const check = checkCircuit(
        { source: read.source, sourceName: read.sourceName },
        library
      );
      if (!check.valid) {
        const msgs = check.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => d.message)
          .join('\n');
        return {
          content: [{ type: 'text' as const, text: `DSL validation failed:\n${msgs}` }],
          isError: true,
        };
      }

      // 3. Auto-generate interactive harness (Switch/Led/HexDisplay) if needed
      const dslToShow = generateHarnessAppended(read.source);

      // 4. Start or get existing preview server
      let preview;
      try {
        preview = await getOrCreateServer();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error starting preview server: ${message}`,
            },
          ],
          isError: true,
        };
      }

      const url = `http://localhost:${preview.port}`;

      // 5. Push DSL (with harness) to all connected clients
      preview.updateDSL(dslToShow);

      // 6. Watch file for changes if path provided
      if (filePath) {
        preview.watchFile(resolve(filePath));
      }

      // 7. Open browser on first call
      openBrowser(url);

      // 8. Return confirmation
      const watchingNote = filePath
        ? ` Watching ${resolve(filePath)} for changes.`
        : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Circuit preview running at ${url}.${watchingNote}`,
          },
        ],
      };
    }
  );
}
