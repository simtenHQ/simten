/**
 * useLayout — synchronous layout hook for CircuitCanvas.
 *
 * Wraps computeDagreLayout. Result is available on first render.
 * No loading state, no fallback — dagre runs in <2 ms for typical
 * circuits.
 */

import type { CircuitIR } from '@simten/core/internal';
import { useMemo } from 'react';
import { computeDagreLayout, type DagreLayoutOptions } from './dagre-layout';
import type { MetadataState } from './types';

/**
 * Returns layout metadata for a circuit. Synchronous: result is
 * available on first render. Pass `null` to skip layout (e.g. when
 * the consumer is providing a static `layout` prop).
 */
export function useLayout(
  circuit: CircuitIR | null,
  options?: DagreLayoutOptions,
): { metadata: MetadataState; isLayoutReady: boolean } {
  return useMemo(() => {
    if (!circuit) {
      return {
        metadata: { components: {}, connections: {} } as MetadataState,
        isLayoutReady: false,
      };
    }
    return { metadata: computeDagreLayout(circuit, options), isLayoutReady: true };
  }, [circuit, options?.direction, options?.nodeSpacing, options?.rankSpacing]);
}
