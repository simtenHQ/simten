"use client";

import { useEffect, useRef } from "react";

/**
 * Syncs challenge state to the MCP preview server and listens for
 * navigation commands via SSE.
 *
 * The preview server port comes from the `?port=` query param,
 * set by the MCP get_challenge_stage tool when it opens the browser.
 */
export function useChallengeSync(
  challengeId: string,
  stageId: string,
  userSource: string,
  onNavigate: (stageId: string) => void,
  onAddConnection?: (connection: string) => void,
) {
  const portRef = useRef<string | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const onAddConnectionRef = useRef(onAddConnection);
  onAddConnectionRef.current = onAddConnection;

  // Read port from URL on mount (avoids useSearchParams / Suspense requirement)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    portRef.current = params.get("port");
  }, []);

  // POST challenge state on every change
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;

    const body = JSON.stringify({
      challengeId,
      stageId,
      userSource,
      timestamp: Date.now(),
    });

    fetch(`http://127.0.0.1:${port}/api/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {
      // Preview server may have stopped — silently ignore
    });
  }, [challengeId, stageId, userSource]);

  // Listen for SSE navigation commands
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;

    const es = new EventSource(`http://127.0.0.1:${port}/api/events`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "challenge-navigate" && data.stageId) {
          onNavigateRef.current(data.stageId);
        }
        if (data.type === "challenge-add-connection" && data.connection) {
          onAddConnectionRef.current?.(data.connection);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      es.close();
    };
  }, []);
}
