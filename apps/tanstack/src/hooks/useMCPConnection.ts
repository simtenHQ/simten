/**
 * useMCPConnection — WebSocket connection to the MCP server.
 *
 * Handles:
 * - Auto-discovery: tries ws://localhost:19847 on mount, retries every 5s
 * - Token auth from URL fragment (cleaned immediately)
 * - Session registration with a stable UUID
 * - Incoming messages: circuit source, traces, test results, memory data
 * - Responding to state requests from the MCP server (pull model)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { randomUUID } from '@/lib/uuid';

// --- Types ---

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface MCPMessage {
  type: string;
  [key: string]: unknown;
}

export interface MCPCallbacks {
  /** Called when new circuit source is pushed from Claude Code */
  onSource?: (source: string) => void;
  /** Called when a file-deleted event is received */
  onFileDeleted?: () => void;
  /** Called when an error message is received */
  onError?: (message: string) => void;
  /** Called when traces are pushed */
  onTraces?: (data: unknown) => void;
  /** Called when test results are pushed */
  onTestResults?: (data: unknown) => void;
  /** Called when memory data is pushed */
  onMemoryData?: (data: unknown) => void;
  /** Called when Claude pushes a chat message via push_chat_response */
  onChatMessage?: (text: string) => void;
  /** Called to get current circuit state for MCP server requests */
  getCircuitState?: () => unknown;
}

const RETRY_INTERVAL = 5000;
const LS_KEY = 'turing-incomplete:mcp-connection';

function saveConnectionParams(params: { token: string; port: number }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(params)); } catch { /* ignore */ }
}

function loadConnectionParams(): { token: string; port: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token && parsed?.port) return parsed;
  } catch { /* ignore */ }
  return null;
}

/**
 * Parse connection params from URL fragment.
 * Fragment format: #token=xxx&port=19847
 * Persists to localStorage so subsequent page loads reconnect automatically.
 */
function parseFragmentParams(): { token: string; port: number } | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;

  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('token');
  const port = params.get('port');

  if (token && port) {
    // Clean the URL immediately — remove the fragment
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const parsed = { token, port: parseInt(port, 10) };
    saveConnectionParams(parsed);
    return parsed;
  }

  return null;
}

export function useMCPConnection(callbacks: MCPCallbacks) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(randomUUID());
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Store connection params (from fragment or auto-discovery)
  const connectionRef = useRef<{ token: string; port: number } | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback((port: number, token: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');

    const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Register this tab as a session
      ws.send(JSON.stringify({
        type: 'register',
        sessionId: sessionIdRef.current,
        page: window.location.pathname,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: MCPMessage = JSON.parse(event.data);
        const cb = callbacksRef.current;

        switch (msg.type) {
          case 'source':
            cb.onSource?.(msg.source as string);
            break;
          case 'file-deleted':
            cb.onFileDeleted?.();
            break;
          case 'error':
            cb.onError?.(msg.message as string);
            break;
          case 'traces':
            cb.onTraces?.(msg.data);
            break;
          case 'test-results':
            cb.onTestResults?.(msg.data);
            break;
          case 'memory-data':
            cb.onMemoryData?.(msg.data);
            break;
          case 'chat-message':
            cb.onChatMessage?.(msg.text as string);
            break;

          // Pull model: MCP server is requesting state
          case 'request-state': {
            const state = cb.getCircuitState?.();
            ws.send(JSON.stringify({
              type: 'state-response',
              requestId: msg.requestId,
              state: state ?? null,
            }));
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      // 4001 = invalid token (stale localStorage) — clear and stop retrying
      if (event.code === 4001) {
        try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
        connectionRef.current = null;
        setStatus('disconnected');
        return;
      }
      if (connectionRef.current) {
        // We had a valid connection — try to reconnect
        setStatus('reconnecting');
        retryTimerRef.current = setTimeout(() => {
          const conn = connectionRef.current;
          if (conn) connect(conn.port, conn.token);
        }, RETRY_INTERVAL);
      } else {
        setStatus('disconnected');
      }
    };

    ws.onerror = () => {
      // onclose will fire after this — handle reconnection there
    };
  }, []);

  // Auto-discovery: try well-known port with no token (will be rejected but we detect server presence)
  // Only used when there's no fragment params. For now, fragment params are the primary connection method.
  const tryAutoDiscover = useCallback(() => {
    // Don't auto-discover if we already have a connection
    if (connectionRef.current || wsRef.current) return;

    // Try connecting — if there's no server, this will fail silently
    // The server will reject us without a token, so this is just a probe
    // For now, auto-discovery only works with fragment params from show_circuit
    // Future: could implement a token-less handshake for discovery
  }, []);

  useEffect(() => {
    // Fragment params take priority (from show_circuit), also persisted to localStorage
    const fragmentParams = parseFragmentParams() ?? loadConnectionParams();
    if (fragmentParams) {
      connectionRef.current = fragmentParams;
      connect(fragmentParams.port, fragmentParams.token);
      return;
    }

    // No fragment params — start auto-discovery retry
    // For now this is a no-op since we require a token
    // In future, could try well-known port with a discovery protocol
    const discoveryTimer = setInterval(tryAutoDiscover, RETRY_INTERVAL);

    return () => {
      clearInterval(discoveryTimer);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, tryAutoDiscover]);

  const sendToClaudePrompt = useCallback((text: string, meta?: Record<string, string>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'send-to-claude', content: text, meta: meta ?? {} }));
  }, []);

  return {
    status,
    sessionId: sessionIdRef.current,
    isConnected: status === 'connected',
    sendToClaudePrompt,
  };
}
