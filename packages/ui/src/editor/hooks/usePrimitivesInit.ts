'use client';

import { useEffect } from 'react';
import { useComponentLibraryStore } from '../stores/component-library-store';

/**
 * Hook to initialize the component library with primitives and standard components.
 * Call this once at the root of your app.
 */
export function usePrimitivesInit() {
  const initializeLibrary = useComponentLibraryStore((s) => s.initializeLibrary);

  useEffect(() => {
    initializeLibrary();
  }, [initializeLibrary]);
}
