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
    // Only initialize if primitives haven't been registered yet
    const existingPrimitives = getAllPrimitiveNames();
    if (existingPrimitives.length === 0) {
      const primitives = getPrimitives();
      registerPrimitives(primitives);
      console.log(`Initialized ${primitives.length} primitive components`);
    }
  }, [registerPrimitives, getAllPrimitiveNames]);
}
