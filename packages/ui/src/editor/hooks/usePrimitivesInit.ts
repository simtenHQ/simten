'use client';

import { useEffect } from 'react';
import { useCircuitLibraryStore } from '../stores/circuit-library-store';

/**
 * Hook to initialize the circuit library with primitives and standard circuits.
 * Call this once at the root of your app.
 */
export function usePrimitivesInit() {
  const initializeLibrary = useCircuitLibraryStore((s) => s.initializeLibrary);

  useEffect(() => {
    initializeLibrary();
  }, [initializeLibrary]);
}
