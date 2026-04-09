/**
 * Shared studio server singleton.
 *
 * Provides a single WebSocket-based studio server shared across all MCP tools
 * (show, state, traces, test-results).
 */

import type { StudioServer, CircuitState, ChallengeState, TracesPayload, TestResultsPayload } from '../server/ws-server.js';

export type { StudioServer, CircuitState, ChallengeState, TracesPayload, TestResultsPayload };

// Module-level singleton
let studioServer: StudioServer | null = null;
let browserOpened = false;

// Callback for browser → Claude channel notifications
let onSendToClaudeCallback: ((content: string, meta: Record<string, string>) => void) | null = null;

export function setOnSendToClaude(callback: (content: string, meta: Record<string, string>) => void) {
  onSendToClaudeCallback = callback;
}

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
    onSendToClaude: (content, meta) => {
      onSendToClaudeCallback?.(content, meta);
    },
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
