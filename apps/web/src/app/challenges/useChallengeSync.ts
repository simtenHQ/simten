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
  stageId: string,
  userSource: string,
  onNavigate: (stageId: string) => void,
  onAddStep?: (step: string) => void,
): McpConnectionStatus {
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onAddStepRef = useRef(onAddStep);
  onAddStepRef.current = onAddStep;
  const challengeIdRef = useRef(challengeId);
  challengeIdRef.current = challengeId;
  const stageIdRef = useRef(stageId);
  stageIdRef.current = stageId;
  const userSourceRef = useRef(userSource);
  userSourceRef.current = userSource;

  const [status, setStatus] = useState<McpConnectionStatus>("idle");
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      // POST current state so the server knows what page we're on
      postState().catch(() => {});
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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

  // On mount: try immediately
  useEffect(() => {
    connectSSE();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connectSSE, startPolling]);

  // POST state on every change
  useEffect(() => {
    if (esRef.current) {
      postState().catch(() => {});
    }
  }, [challengeId, stageId, userSource, postState]);

  return status;
}
