/**
 * Shared studio server singleton.
 *
 * Provides a single WebSocket-based studio server shared across all MCP tools
 * (show, state, traces, test-results).
 */

import { randomUUID } from 'node:crypto';
import type { StudioServer, CircuitState, TracesPayload, TestResultsPayload } from '../server/ws-server.js';

export type { StudioServer, CircuitState, TracesPayload, TestResultsPayload };

// Module-level singleton
let studioServer: StudioServer | null = null;
let browserOpened = false;

/**
 * Per-process auth token: a fresh identity each time the MCP starts. Together
 * with the port, it uniquely identifies THIS server instance; show_circuit hands
 * both to the browser via the URL fragment. A tab that reconnects to a different
 * instance — a stale cached port now held by another project's MCP, or this
 * instance after a restart — presents a token that no longer matches and is
 * cleanly rejected (WebSocket close code 4001) instead of silently attaching to
 * the wrong server.
 *
 * Previously this was persisted to ~/.simten/token so a tab survived an MCP
 * restart, but that persistence is precisely what let a stale tab authenticate
 * against the wrong instance (cross-instance bleed). The fragment from the next
 * show_circuit is the authoritative way to (re)establish a tab.
 */
const PROCESS_TOKEN = randomUUID();

// Register cleanup
let cleanupRegistered = false;
function ensureCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    studioServer?.close();
    studioServer = null;
  };
  process.on('exit', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

export async function getOrCreateServer(): Promise<StudioServer> {
  if (studioServer) return studioServer;

  const { createStudioServer } = await import('../server/ws-server.js');
  const { DEFAULT_PORT } = await import('./config.js');

  studioServer = await createStudioServer({
    port: DEFAULT_PORT,
    token: PROCESS_TOKEN,
  });
  ensureCleanup();

  return studioServer;
}

export function getPreviewServer(): StudioServer | null {
  return studioServer;
}

export function setPreviewServer(server: StudioServer | null): void {
  studioServer = server;
}

export function getBrowserOpened(): boolean {
  return browserOpened;
}

export function setBrowserOpened(value: boolean): void {
  browserOpened = value;
}
