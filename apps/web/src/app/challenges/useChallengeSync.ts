"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Syncs challenge state to the MCP preview server and listens for
 * navigation commands via SSE.
 *
 * The preview server port comes from the `?port=` query param,
 * set by the MCP get_challenge_step tool when it opens the browser.
 */
export function useChallengeSync(
  challengeId: string,
  stepId: string,
  userSource: string,
  onNavigate: (stepId: string) => void,
) {
  const portRef = useRef<string | null>(null);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

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
      stepId,
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
  }, [challengeId, stepId, userSource]);

  // Listen for SSE navigation commands
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;

    const es = new EventSource(`http://127.0.0.1:${port}/api/events`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "challenge-navigate" && data.stepId) {
          onNavigateRef.current(data.stepId);
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
