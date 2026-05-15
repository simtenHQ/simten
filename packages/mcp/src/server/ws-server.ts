/**
 * WebSocket server for browser communication.
 *
 * Replaces the old HTTP/SSE preview server with a bidirectional WebSocket.
 * - Manages sessions (one per browser tab, identified by UUID)
 * - Pushes circuit source, traces, test results, memory data to connected tabs
 * - Requests circuit state on demand (pull model)
 * - File watching with dedup (skips watcher events within 500ms of explicit push)
 * - Token auth: connections must provide the server's token to be accepted
 */

import { WebSocketServer, WebSocket } from 'ws';
import { watchFile as fsWatchFile, unwatchFile, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CircuitState, TracesPayload, TestResultsPayload } from './types.js';

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
  sessions: Map<string, Session>;

  updateSource(source: string, sessionId?: string): void;
  watchFile(filePath: string): void;
  getState(sessionId?: string): Promise<CircuitState | null>;
  pushTraces(data: TracesPayload, sessionId?: string): void;
  pushTestResults(data: TestResultsPayload, sessionId?: string): void;
  pushMemoryData(data: MemoryDataPayload, sessionId?: string): void;
  pushChatMessage(text: string, sessionId?: string): void;
  getActiveSession(): Session | null;
  close(): void;
}

/** Timeout for request/response calls to the browser (ms) */
const STATE_REQUEST_TIMEOUT = 3000;

/** Dedup window: ignore file watcher events within this many ms of an explicit push */
const DEDUP_WINDOW_MS = 500;

export async function createStudioServer(
  options?: { port?: number; token?: string; onSendToClaude?: (content: string, meta: Record<string, string>) => void }
): Promise<StudioServer> {
  const port = options?.port ?? 0;
  const token = options?.token ?? randomUUID();

  const sessions = new Map<string, Session>();
  const pendingRequests = new Map<string, { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }>();

  let currentSource: string | null = null;
  let cachedTraces: TracesPayload | null = null;
  let cachedTestResults: TestResultsPayload | null = null;
  let cachedMemoryData: MemoryDataPayload | null = null;
  let watchedPath: string | null = null;
  let lastExplicitPushAt = 0;

  // Track the most recently active session for default targeting
  let lastActiveSessionId: string | null = null;

  const wss = new WebSocketServer({ port, host: '127.0.0.1' });

  const assignedPort = await new Promise<number>((resolvePort, reject) => {
    wss.on('listening', () => {
      const addr = wss.address();
      if (typeof addr === 'object' && addr) {
        resolvePort(addr.port);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });
    wss.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Another MCP server or process may be running on this port.`));
      } else {
        reject(err);
      }
    });
  });

  wss.on('connection', (ws, req) => {
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

          // Send cached state to late-joining client
          if (currentSource) {
            send(ws, { type: 'source', source: currentSource });
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

        // Handle responses to state requests
        if (msg.type === 'state-response') {
          const pending = pendingRequests.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingRequests.delete(msg.requestId);
            pending.resolve(msg.state ?? null);
          }
          return;
        }

        // Browser reports it is focused — use this session for next push
        if (msg.type === 'focus' && sessionId) {
          lastActiveSessionId = sessionId;
          return;
        }

        // Browser sends a message to Claude via channel notification
        if (msg.type === 'send-to-claude' && options?.onSendToClaude) {
          options.onSendToClaude(msg.content ?? '', msg.meta ?? {});
          return;
        }

        // Update circuit name when browser reports it
        if (msg.type === 'circuit-info' && sessionId) {
          const session = sessions.get(sessionId);
          if (session) {
            session.circuitName = msg.circuitName ?? null;
          }
          return;
        }
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

  function requestFromBrowser(type: string, sessionId?: string): Promise<unknown> {
    const target = getTargetSession(sessionId);
    if (!target) {
      return Promise.resolve(null);
    }

    const requestId = randomUUID();
    return new Promise((resolveReq) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId);
        resolveReq(null);
      }, STATE_REQUEST_TIMEOUT);

      pendingRequests.set(requestId, { resolve: resolveReq, timer });
      send(target.ws, { type, requestId });
    });
  }

  function updateSource(source: string, sessionId?: string) {
    currentSource = source;
    lastExplicitPushAt = Date.now();
    broadcast({ type: 'source', source }, sessionId);
  }

  function watchFile(filePath: string) {
    const absPath = resolve(filePath);

    if (watchedPath === absPath) return;

    if (watchedPath) {
      unwatchFile(watchedPath);
    }

    watchedPath = absPath;

    fsWatchFile(absPath, { interval: 200 }, (curr, prev) => {
      if (curr.mtimeMs === prev.mtimeMs) return;

      // Dedup: skip if we just did an explicit push
      if (Date.now() - lastExplicitPushAt < DEDUP_WINDOW_MS) return;

      if (curr.size === 0 && !existsSync(absPath)) {
        broadcast({ type: 'file-deleted' });
        return;
      }

      try {
        const content = readFileSync(absPath, 'utf-8');
        updateSource(content);
      } catch {
        broadcast({ type: 'error', message: `Failed to read ${absPath}` });
      }
    });
  }

  async function getState(sessionId?: string): Promise<CircuitState | null> {
    return requestFromBrowser('request-state', sessionId) as Promise<CircuitState | null>;
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

  function pushChatMessage(text: string, sessionId?: string) {
    broadcast({ type: 'chat-message', text }, sessionId);
  }

  function getActiveSession(): Session | null {
    return getTargetSession();
  }

  function close() {
    if (watchedPath) {
      unwatchFile(watchedPath);
      watchedPath = null;
    }
    for (const pending of pendingRequests.values()) {
      clearTimeout(pending.timer);
    }
    pendingRequests.clear();
    for (const session of sessions.values()) {
      session.ws.close();
    }
    sessions.clear();
    wss.close();
  }

  return {
    port: assignedPort,
    token,
    sessions,
    updateSource,
    watchFile,
    getState,
    pushTraces,
    pushTestResults,
    pushMemoryData,
    pushChatMessage,
    getActiveSession,
    close,
  };
}
