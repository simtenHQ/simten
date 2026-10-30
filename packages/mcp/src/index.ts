/**
 * Simten MCP Server
 *
 * Exposes circuit simulation tools for Claude Code.
 * Build circuits, simulate them, and push live visualizations to a browser tab.
 *
 * Usage:
 *   claude mcp add simten node packages/mcp/bin/simten-mcp.js
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createSimtenServer } from './create-server.js';
import { getOrCreateServer, getPreviewServer } from './lib/preview-singleton.js';
import { findSimtenRepo } from './lib/repo-root.js';

// Decided once, at startup: the tool list stays fixed for the process.
const repoRoot = findSimtenRepo();

// serveStdio speaks the 2026-07-28 revision to a client that opens with it and
// the 2025 revisions (initialize) to one that doesn't. A plain connect() on a
// StdioServerTransport would only ever speak 2025.
const handle = serveStdio(() => createSimtenServer({ repoRoot }), {
  onerror: (err) => process.stderr.write(`[simten-mcp] ${err.message}\n`),
});

// Start the WS server eagerly so the browser can reconnect immediately after MCP restart.
// Without this, the server only starts when a tool is called (lazy), leaving the browser
// in "reconnecting" state until the first tool invocation.
getOrCreateServer()
  .then((s) => {
    process.stderr.write(`[simten-mcp] WS server started on port ${s.port}\n`);
  })
  .catch((err: unknown) => {
    process.stderr.write(
      `[simten-mcp] WS server failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  });

// --- Lifecycle: exit when the parent (Claude Code) goes away ----------------
// The eagerly-started WS server keeps a listening socket (and per-connection
// ping intervals) on the event loop, so this process will NOT terminate on its
// own when stdin closes. Without an explicit exit it orphans — outliving its
// Claude session and holding its studio port — which is how dozens of stale
// instances pile up. Wire every parent-death signal to one shutdown that closes
// the studio server and exits.
let shuttingDown = false;
function shutdown(reason: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stderr.write(`[simten-mcp] shutting down (${reason})\n`);
  try {
    getPreviewServer()?.close();
  } catch {
    /* best effort — exit regardless */
  }
  // Close the MCP connection, then exit even if that hangs.
  const exit = () => process.exit(0);
  handle.close().then(exit, exit);
  setTimeout(exit, 1000).unref();
}

// stdin EOF/close is the reliable lifeline: when the MCP client closes the pipe
// (or the wrapper chain dies), our stdin ends even if no signal is delivered.
process.stdin.on('end', () => shutdown('stdin end'));
process.stdin.on('close', () => shutdown('stdin close'));

// Make signals actually terminate. (preview-singleton also closes the studio on
// these, but its handlers don't exit — which overrides Node's default and leaves
// the process alive; this guarantees termination so `kill` works without -9.)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
