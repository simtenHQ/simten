import { useState, useEffect, useMemo } from "react";
import type { Circuit } from "@turing-incomplete/core/dsl";
import type { MetadataState } from "../editor/types";
import { computeElkLayout, fallbackLayout } from "./elk-layout";
import type { ElkLayoutOptions } from "./elk-layout";

export type { ElkLayoutOptions };
export { computeElkLayout };

/**
 * React hook for ELK layout. Returns the current layout metadata and a ready flag.
 * Starts with a synchronous fallback and replaces with ELK once resolved.
 */
export function useElkLayout(
  circuit: Circuit | null,
  options?: ElkLayoutOptions,
): { metadata: MetadataState; isLayoutReady: boolean } {
  // Synchronous fallback for immediate render
  const fallback = useMemo(() => {
    if (!circuit) return { components: {}, connections: {} } as MetadataState;
    return fallbackLayout(circuit);
  }, [circuit]);

  const [elkMetadata, setElkMetadata] = useState<MetadataState | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  // Serialize options to avoid re-running on reference changes
  const direction = options?.direction ?? "RIGHT";
  const spacing = options?.spacing ?? 50;

  useEffect(() => {
    if (!circuit) {
      setElkMetadata(null);
      setIsLayoutReady(false);
      return;
    }

    let cancelled = false;
    setIsLayoutReady(false);

    computeElkLayout(circuit, { direction, spacing }).then(result => {
      if (!cancelled) {
        setElkMetadata(result);
        setIsLayoutReady(true);
      }
    });

    return () => { cancelled = true; };
  }, [circuit, direction, spacing]);

  return {
    metadata: elkMetadata ?? fallback,
    isLayoutReady,
  };
}
