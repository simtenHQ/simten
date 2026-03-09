"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const MCP_PORT = 14159;
const POLL_MS = 5000;

export type McpConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

/**
 * Syncs challenge state to the MCP preview server and listens for
 * SSE events (navigation, add-step, state restore).
 *
 * Polls /api/challenge every 5s when idle. Once the server responds,
 * opens an SSE connection. On connect, the server sends cached state
 * which is used to restore steps after a page refresh.
 */
export function useChallengeSync(
  challengeId: string,
  stageId: string,
  userSource: string,
  onNavigate: (stageId: string) => void,
  onAddStep?: (step: string) => void,
  onRestore?: (userSource: string) => void,
): McpConnectionStatus {
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onAddStepRef = useRef(onAddStep);
  onAddStepRef.current = onAddStep;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const challengeIdRef = useRef(challengeId);
  challengeIdRef.current = challengeId;
  const stageIdRef = useRef(stageId);
  stageIdRef.current = stageId;
  const userSourceRef = useRef(userSource);
  userSourceRef.current = userSource;

  const [status, setStatus] = useState<McpConnectionStatus>("idle");
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef = useRef(false);

  const postState = useCallback(() => {
    return fetch(`http://127.0.0.1:${MCP_PORT}/api/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: challengeIdRef.current,
        stageId: stageIdRef.current,
        userSource: userSourceRef.current,
        timestamp: Date.now(),
      }),
    });
  }, []);

  const connectSSE = useCallback(() => {
    if (esRef.current) return;

    const es = new EventSource(`http://127.0.0.1:${MCP_PORT}/api/events`);
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Restore cached state on first connect (before we start POSTing)
        if (data.type === "challenge-state" && !restoredRef.current) {
          restoredRef.current = true;
          if (data.challengeId === challengeIdRef.current &&
              data.stageId === stageIdRef.current &&
              data.userSource) {
            onRestoreRef.current?.(data.userSource);
          }
          return;
        }

        if (data.challengeId && data.challengeId !== challengeIdRef.current) return;

        if (data.type === "challenge-navigate" && data.stageId) {
          onNavigateRef.current(data.stageId);
        }
        if (data.type === "challenge-add-step" && data.step) {
          if (data.stageId && data.stageId !== stageIdRef.current) return;
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
      startPolling();
    };
  }, [postState]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      if (esRef.current) return;
      postState()
        .then(() => connectSSE())
        .catch(() => {});
    }, POLL_MS);
  }, [postState, connectSSE]);

  // On mount: try immediately, then poll
  useEffect(() => {
    connectSSE();
    // If SSE fails, polling starts from the onerror handler

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connectSSE, startPolling]);

  // POST state on every change (only after restore)
  useEffect(() => {
    if (esRef.current && restoredRef.current) {
      postState().catch(() => {});
    }
  }, [challengeId, stageId, userSource, postState]);

  return status;
}
