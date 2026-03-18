"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const MCP_PORT = 14159;
const POLL_MS = 5000;

export type McpConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

/**
 * Syncs challenge state to the MCP preview server and listens for
 * SSE events (navigation, add-step).
 *
 * Polls /api/challenge every 5s when idle. Once the server responds,
 * opens an SSE connection. MCP is a communication channel only —
 * persistence is handled by localStorage in the workbench.
 */
export function useChallengeSync(
  challengeId: string,
  levelId: string,
  userSource: string,
  onNavigate: (levelId: string) => void,
  onAddStep?: (step: string) => void,
): McpConnectionStatus {
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onAddStepRef = useRef(onAddStep);
  onAddStepRef.current = onAddStep;
  const challengeIdRef = useRef(challengeId);
  challengeIdRef.current = challengeId;
  const levelIdRef = useRef(levelId);
  levelIdRef.current = levelId;
  const userSourceRef = useRef(userSource);
  userSourceRef.current = userSource;

  const [status, setStatus] = useState<McpConnectionStatus>("idle");
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Only start reconnect polling after we've had at least one successful connection
  const hadConnectionRef = useRef(false);

  const postState = useCallback(() => {
    return fetch(`http://127.0.0.1:${MCP_PORT}/api/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challengeIdRef.current,
        levelId: levelIdRef.current,
        userSource: userSourceRef.current,
        timestamp: Date.now(),
      }),
    });
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      if (esRef.current) return;
      postState()
        .then(() => {
          // Server is back — reconnect SSE
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          connectSSE();
        })
        .catch(() => {});
    }, POLL_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postState]);

  const connectSSE = useCallback(() => {
    if (esRef.current) return;

    const es = new EventSource(`http://127.0.0.1:${MCP_PORT}/api/events`);
    esRef.current = es;

    es.onopen = () => {
      hadConnectionRef.current = true;
      setStatus("connected");
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      postState().catch(() => {});
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.challengeId && data.challengeId !== challengeIdRef.current) return;

        if (data.type === "challenge-navigate" && data.levelId) {
          onNavigateRef.current(data.levelId);
        }
        if (data.type === "challenge-add-step" && data.step) {
          if (data.levelId && data.levelId !== levelIdRef.current) return;
          onAddStepRef.current?.(data.step);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setStatus("idle");
      // Only poll for reconnection if we previously had a working connection
      if (hadConnectionRef.current) {
        startPolling();
      }
    };
  }, [postState, startPolling]);

  // On mount: try once
  useEffect(() => {
    connectSSE();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connectSSE]);

  // POST state on every change (only if connected)
  useEffect(() => {
    if (esRef.current) {
      postState().catch(() => {});
    }
  }, [challengeId, levelId, userSource, postState]);

  return status;
}
