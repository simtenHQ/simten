/**
 * usePrimitivesInit Hook
 *
 * Initializes the component library with primitive components on mount
 */

'use client';

import { useEffect } from 'react';
import { useComponentLibraryStore } from '../stores/component-library-store';
import { getPrimitives } from '../lib/primitives';

/**
 * Hook to initialize the component library with primitives
 * Call this once at the root of your app
 */
export function usePrimitivesInit() {
  const { registerPrimitives, getAllPrimitiveNames } = useComponentLibraryStore();

  useEffect(() => {
    const primitives = getPrimitives();
    const existingPrimitives = getAllPrimitiveNames();

    // Always register primitives if count differs (handles added/removed primitives)
    if (existingPrimitives.length !== primitives.length) {
      registerPrimitives(primitives);
      console.log(`Initialized ${primitives.length} primitive components`);
    }
  }, [registerPrimitives, getAllPrimitiveNames]);
}
