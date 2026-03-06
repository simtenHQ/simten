/**
 * Shared preview server singleton.
 *
 * Extracted from show.ts so that multiple MCP tools
 * (state, traces, test-results) can access the running preview.
 */

import type { PreviewServer, CircuitState, TracesPayload, TestResultsPayload } from '../server/preview-server.js';

export type { PreviewServer, CircuitState, TracesPayload, TestResultsPayload };

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

export async function getOrCreateServer(): Promise<PreviewServer> {
  if (previewServer) return previewServer;

  const { createPreviewServer } = await import('../server/preview-server.js');

  previewServer = await createPreviewServer();
  ensureCleanup();

  return previewServer;
}

export function getPreviewServer(): PreviewServer | null {
  return previewServer;
}

export function setPreviewServer(server: PreviewServer | null): void {
  previewServer = server;
}

export function getBrowserOpened(): boolean {
  return browserOpened;
}

export function setBrowserOpened(value: boolean): void {
  browserOpened = value;
}
