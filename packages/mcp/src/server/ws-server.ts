/**
 * WebSocket server for browser communication.
 *
 * Replaces the old HTTP/SSE preview server with a bidirectional WebSocket.
 * - Manages sessions (one per browser tab, identified by UUID)
 * - Pushes circuit source, traces, test results, memory data to connected tabs
 * - Requests circuit state on demand (pull model)
 * - Token auth: connections must provide the server's token to be accepted
 * - Origin allowlist: browser connections must originate from localhost (a
 *   cross-site page you visit is refused); non-browser clients (no Origin) pass
 *   and are still token-gated. Defense-in-depth on top of the token.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { CircuitState, TracesPayload, TestResultsPayload, RenderResult } from './types.js';
import {
  serveStatic,
  publicDirExists,
  isCompileRequest,
  proxyCompile,
} from '../lib/serve-static.js';

export type { CircuitState, TracesPayload, TestResultsPayload };

/** JSON-serializable memory data: { nodePattern: { address: value } } */
export type MemoryDataPayload = Record<string, Record<string, number>>;

export interface Session {
  id: string;
  ws: WebSocket;
  page: string;
  circuitName: string | null;
}

export interface StudioServer {
  port: number;
  token: string;
  /** True when this server is also serving the bundled editor SPA on `port`
   *  (so the browser page and the WS share one localhost origin). */
  servesStatic: boolean;
  sessions: Map<string, Session>;

  updateSource(source: string, sessionId?: string): void;
  /** Push source AND await the browser's render acknowledgment (success + circuitName, or error/timeout). */
  updateSourceAndAwait(
    source: string,
    sessionId?: string,
    timeoutMs?: number,
  ): Promise<RenderResult>;
  /** Push source and await the render ack from a not-yet-connected tab (fresh open). */
  updateSourceAndAwaitConnect(source: string, timeoutMs?: number): Promise<RenderResult>;
  pushTraces(data: TracesPayload, sessionId?: string): void;
  pushTestResults(data: TestResultsPayload, sessionId?: string): void;
  pushMemoryData(data: MemoryDataPayload, sessionId?: string): void;
  getActiveSession(): Session | null;
  close(): void;
}

/** Timeout for request/response calls to the browser (ms) */
const STATE_REQUEST_TIMEOUT = 3000;

/** Timeout for awaiting the first render after opening a fresh browser tab (ms).
 *  Generous: covers browser launch + page load + esm.sh fetch + compile. */
const CONNECT_RENDER_TIMEOUT = 20000;

export async function createStudioServer(options?: {
  port?: number;
  token?: string;
  /** Called when the last connected tab disconnects (session count hits 0).
   *  Lets the caller reset its "browser already opened" latch so a later
   *  show_circuit can reopen a tab without restarting the MCP. */
  onSessionsEmpty?: () => void;
}): Promise<StudioServer> {
  const preferredPort = options?.port ?? 0;
  const token = options?.token ?? randomUUID();

  const sessions = new Map<string, Session>();
  const pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >();

  let currentSource: string | null = null;
  let cachedTraces: TracesPayload | null = null;
  let cachedTestResults: TestResultsPayload | null = null;
  let cachedMemoryData: MemoryDataPayload | null = null;

  // Track the most recently active session for default targeting
  let lastActiveSessionId: string | null = null;

  // When a render is awaited but no tab is connected yet, hold the requestId so
  // the next tab to register receives the source WITH that id and acks it.
  let pendingConnectRender: string | null = null;

  // One HTTP server serves the bundled editor SPA AND hosts the WebSocket
  // (via the `upgrade` event), so the browser page and its studio socket share
  // a single localhost origin — which is what sidesteps Chrome's Local Network
  // Access block (a public page may not reach ws://localhost). The WS is
  // `noServer` and attached to the HTTP server's upgrades.
  const servesStatic = publicDirExists();
  const wss = new WebSocketServer({ noServer: true });
  const httpServer = createServer((req, res) => {
    if (isCompileRequest(req)) {
      // Relative fetch from the canvas IMEM node — forward to the deployed
      // compiler (see proxyCompile). Works with or without bundled assets.
      proxyCompile(req, res);
    } else if (servesStatic) {
      serveStatic(req, res);
    } else {
      // No bundled editor (e.g. running from source/dev). The WS still works;
      // the page is loaded from SIMTEN_URL instead. Nothing to serve here.
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });
  httpServer.on('upgrade', (req, socket, head) => {
    // Hand the upgrade to ws; token validation happens in the connection
    // handler below (so a bad token still completes the handshake and gets a
    // clean 4001 close, which the web client treats specially).
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  // Bind the HTTP server to a single port, resolving the actual assigned port.
  // Rejects on EADDRINUSE (so the caller can fall back) and any other error.
  function tryListen(p: number): Promise<number> {
    return new Promise((resolveBind, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        httpServer.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        httpServer.removeListener('error', onError);
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr) {
          resolveBind(addr.port);
        } else {
          reject(new Error('Failed to get server address'));
        }
      };
      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(p, '127.0.0.1');
    });
  }

  // Prefer the well-known port (so a browser tab's persisted localStorage
  // reconnects across MCP restarts), but when it's already taken — e.g. another
  // project's MCP instance is running — fall back to an OS-assigned free port
  // instead of failing. show_circuit advertises the real port to the browser via
  // the URL fragment, so any port works end-to-end.
  let assignedPort: number;
  try {
    assignedPort = await tryListen(preferredPort);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' && preferredPort !== 0) {
      assignedPort = await tryListen(0);
    } else {
      throw err;
    }
  }

  wss.on('connection', (ws, req) => {
    // VIEWER-ONLY SECURITY INVARIANT: this is a one-way push surface. ALL inbound
    // browser data is untrusted — never surface it verbatim in a tool result, an
    // MCP notification, or anything actionable/agent-readable. This is why
    // `render-result` is reduced to a boolean ack and the circuit name shown to
    // the agent is derived from the source the MCP pushed, not from the browser.
    // A new inbound handler that echoes browser fields would reopen a prompt-
    // injection path into a shell-capable agent. Don't add one without sanitizing.

    // Reject cross-site WebSocket connections (defense-in-depth atop the token).
    // Browsers always send Origin on the WS handshake, so a malicious page you
    // visit carries its own origin and is refused here — even before the token is
    // checked. Same-origin localhost connections (the real viewer) and
    // non-browser clients (no Origin header, e.g. tooling) are allowed; the token
    // still gates those.
    const origin = req.headers.origin;
    if (origin) {
      let allowedOrigin = false;
      try {
        const host = new URL(origin).hostname;
        allowedOrigin =
          host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
      } catch {
        allowedOrigin = false;
      }
      if (!allowedOrigin) {
        ws.close(4003, 'Forbidden origin');
        return;
      }
    }

    // Validate token from query string: ws://localhost:19847?token=xxx
    const url = new URL(req.url || '/', `http://localhost:${assignedPort}`);
    const clientToken = url.searchParams.get('token');

    if (clientToken !== token) {
      ws.close(4001, 'Invalid token');
      return;
    }

    let sessionId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'register') {
          sessionId = msg.sessionId;
          const session: Session = {
            id: sessionId!,
            ws,
            page: msg.page || '/circuit',
            circuitName: null,
          };
          sessions.set(sessionId!, session);
          lastActiveSessionId = sessionId;

          // Send cached state to late-joining client. If a render is being
          // awaited for a freshly-opening tab, attach the requestId so this tab
          // acks it (resolving updateSourceAndAwaitConnect).
          if (currentSource) {
            if (pendingConnectRender) {
              send(ws, { type: 'source', source: currentSource, requestId: pendingConnectRender });
              pendingConnectRender = null;
            } else {
              send(ws, { type: 'source', source: currentSource });
            }
          }
          if (cachedTraces) {
            send(ws, { type: 'traces', data: cachedTraces });
          }
          if (cachedTestResults) {
            send(ws, { type: 'test-results', data: cachedTestResults });
          }
          if (cachedMemoryData) {
            send(ws, { type: 'memory-data', data: cachedMemoryData });
          }
          return;
        }

        // Browser acknowledges it rendered a pushed source (render round-trip).
        // VIEWER-ONLY: this is treated as a BOOLEAN ack only. The browser's
        // reported circuitName/error are deliberately NOT propagated — they are
        // untrusted and would otherwise flow into a tool result (see the
        // untrusted-inbound note at the top of this handler).
        if (msg.type === 'render-result') {
          const pending = pendingRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingRequests.delete(msg.requestId);
            pending.resolve({ ok: !!msg.ok });
          }
          return;
        }

        // No other inbound message types are handled — see the viewer-only note
        // at the top of this handler. `register` (above) and `render-result`
        // (above) are the entire accepted inbound surface.
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (sessionId) {
        sessions.delete(sessionId);
        if (lastActiveSessionId === sessionId) {
          // Fall back to the most recently registered remaining session
          const remaining = Array.from(sessions.keys());
          lastActiveSessionId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
        // Last tab gone — let the caller reopen on the next show_circuit.
        if (sessions.size === 0) options?.onSessionsEmpty?.();
      }
    });

    // Ping/pong for detecting dead connections
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);

    ws.on('close', () => clearInterval(pingInterval));
    ws.on('error', () => clearInterval(pingInterval));
  });

  function send(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function getTargetSession(sessionId?: string): Session | null {
    if (sessionId) {
      return sessions.get(sessionId) ?? null;
    }
    if (lastActiveSessionId) {
      return sessions.get(lastActiveSessionId) ?? null;
    }
    // Fall back to first connected session
    const first = sessions.values().next();
    return first.done ? null : first.value;
  }

  function broadcast(data: unknown, sessionId?: string) {
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        send(session.ws, data);
        lastActiveSessionId = sessionId;
      }
      return;
    }
    // If no session specified, send to the active session only
    const target = getTargetSession();
    if (target) {
      send(target.ws, data);
    }
  }

  function updateSource(source: string, sessionId?: string) {
    currentSource = source;
    broadcast({ type: 'source', source }, sessionId);
  }

  /**
   * Push source with a requestId and await the browser's render acknowledgment.
   * Mirrors the getState round-trip: send → browser executes → posts back
   * { type:'render-result', requestId, ok, circuitName | error }. Resolves with a
   * timeout marker if the browser never replies. Used by show_circuit so the tool
   * result reflects whether the push actually rendered (no polling/sleep needed).
   */
  function updateSourceAndAwait(
    source: string,
    sessionId?: string,
    timeoutMs: number = STATE_REQUEST_TIMEOUT,
  ): Promise<RenderResult> {
    currentSource = source;
    const target = getTargetSession(sessionId);
    if (!target) return Promise.resolve({ ok: false, error: 'no browser tab connected' });

    const requestId = randomUUID();
    return new Promise((resolveReq) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        resolveReq({
          ok: false,
          timedOut: true,
          error: `render not confirmed within ${timeoutMs}ms`,
        });
      }, timeoutMs);
      pendingRequests.set(requestId, { resolve: resolveReq as (v: unknown) => void, timer });
      send(target.ws, { type: 'source', source, requestId });
    });
  }

  /**
   * Push source and await the render ack from a tab that is not yet connected.
   * Stashes the source and arms a pending render requestId; when the next tab
   * registers it receives the source WITH that id and acks via 'render-result'
   * (resolving this promise). Used by show_circuit on a fresh open so the tool
   * result reflects the actual render once the new tab finishes loading.
   */
  function updateSourceAndAwaitConnect(
    source: string,
    timeoutMs: number = CONNECT_RENDER_TIMEOUT,
  ): Promise<RenderResult> {
    currentSource = source;
    const requestId = randomUUID();
    return new Promise((resolveReq) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        if (pendingConnectRender === requestId) pendingConnectRender = null;
        resolveReq({
          ok: false,
          timedOut: true,
          error: `no render confirmed within ${timeoutMs}ms (browser may still be opening)`,
        });
      }, timeoutMs);
      pendingRequests.set(requestId, { resolve: resolveReq as (v: unknown) => void, timer });
      pendingConnectRender = requestId;
    });
  }

  function pushTraces(data: TracesPayload, sessionId?: string) {
    cachedTraces = data;
    broadcast({ type: 'traces', data }, sessionId);
  }

  function pushTestResults(data: TestResultsPayload, sessionId?: string) {
    cachedTestResults = data;
    broadcast({ type: 'test-results', data }, sessionId);
  }

  function pushMemoryData(data: MemoryDataPayload, sessionId?: string) {
    cachedMemoryData = data;
    broadcast({ type: 'memory-data', data }, sessionId);
  }

  function getActiveSession(): Session | null {
    return getTargetSession();
  }

  function close() {
    for (const pending of pendingRequests.values()) {
      clearTimeout(pending.timer);
    }
    pendingRequests.clear();
    for (const session of sessions.values()) {
      session.ws.close();
    }
    sessions.clear();
    wss.close();
    httpServer.close();
  }

  return {
    port: assignedPort,
    token,
    servesStatic,
    sessions,
    updateSource,
    updateSourceAndAwait,
    updateSourceAndAwaitConnect,
    pushTraces,
    pushTestResults,
    pushMemoryData,
    getActiveSession,
    close,
  };
}
