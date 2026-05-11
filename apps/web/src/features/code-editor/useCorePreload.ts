/**
 * useCorePreload — feeds Monaco the bundled `@simten/core` types + an
 * ambient-globals shim that mirrors the runtime scope injected by
 * executeCircuitCode().
 *
 * Replaces the hand-rolled `editor-types.ts` shim. Both inputs are produced
 * by `@simten/core`'s build (`pnpm --filter @simten/core build`):
 *   - dist/bundle.d.ts          → real types for circuit(), BuiltCircuit, stdlib, ...
 *   - dist/editor-globals.dts.txt → declare global { const And: typeof core.And; ... }
 *
 * Vite `?raw` imports inline both files as strings into the JS chunk for
 * the /circuit route, so there's no extra HTTP fetch at editor mount.
 */

import { useEffect } from 'react';
import type { Monaco } from '@monaco-editor/react';
import simtenCoreTypes from '@simten/core/bundle?raw';
import simtenGlobals from '@simten/core/editor-globals?raw';

export function useCorePreload(monaco: Monaco | null) {
  useEffect(() => {
    if (!monaco) return;
    const ts = monaco.languages.typescript.typescriptDefaults;
    ts.addExtraLib(
      simtenCoreTypes,
      'file:///node_modules/@simten/core/index.d.ts',
    );
    ts.addExtraLib(simtenGlobals, 'file:///simten-globals.d.ts');
  }, [monaco]);
}
