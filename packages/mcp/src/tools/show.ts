/**
 * show_circuit tool — opens a live circuit preview in the browser.
 *
 * Starts a local HTTP server that serves a React SPA with SSE updates.
 * When a filePath is provided, watches the file for changes and pushes updates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exec } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readDSLSource } from '../lib/file-reader.js';

// Lazy import type — actual import happens at runtime
type PreviewServer = {
  port: number;
  updateDSL(dsl: string): void;
  watchFile(filePath: string): void;
  close(): void;
};

type CreatePreviewServer = (options?: {
  port?: number;
  clientDir?: string;
}) => Promise<PreviewServer>;

// Module-level singleton
let previewServer: PreviewServer | null = null;
let browserOpened = false;

// Register cleanup
let cleanupRegistered = false;
function ensureCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    previewServer?.close();
    previewServer = null;
  };
  process.on('exit', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

async function getOrCreateServer(): Promise<PreviewServer> {
  if (previewServer) return previewServer;

  // Import the preview server from the bundled dist
  // At build time, copy-preview.js copies the server code next to our dist
  const serverPath = join(import.meta.dirname, '../preview-server/index.js');
  const mod = await import(serverPath) as { createPreviewServer: CreatePreviewServer };

  const clientDir = join(import.meta.dirname, '../preview-client');

  previewServer = await mod.createPreviewServer({ clientDir });
  ensureCleanup();

  return previewServer;
}

function openBrowser(url: string) {
  if (browserOpened) return;
  browserOpened = true;

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
      if (!previewServer) {
        return {
          content: [{ type: 'text' as const, text: 'No preview is running.' }],
        };
      }
      previewServer.close();
      previewServer = null;
      browserOpened = false;
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

      // 2. Start or get existing preview server
      let preview: PreviewServer;
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

      // 3. Push DSL to all connected clients
      preview.updateDSL(read.source);

      // 4. Watch file for changes if path provided
      if (filePath) {
        preview.watchFile(resolve(filePath));
      }

      // 5. Open browser on first call
      openBrowser(url);

      // 6. Return confirmation
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
