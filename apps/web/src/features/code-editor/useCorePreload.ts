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

import type { Monaco } from '@monaco-editor/react';
import simtenCoreTypes from '@simten/core/bundle?raw';
import simtenGlobals from '@simten/core/editor-globals?raw';
import { useEffect } from 'react';

// Importable `@simten/core` subpaths. The bundle is a flat aggregate of all of
// them, registered below as the bare `@simten/core` module — but circuit files
// import from subpaths (`@simten/core/circuit`, `@simten/core/std`, …). Those
// subpaths aren't declared by the bundle, so without help they only resolve via
// network ATA of the published package — fragile, and unavailable in the
// offline local viewer. Re-export the bundle under each subpath so they resolve
// deterministically (over-broad on exports, but correct for the symbols used).
const CORE_SUBPATHS = ['circuit', 'std', 'verilog', 'sim', 'simulator', 'api', 'verify'];

export function useCorePreload(monaco: Monaco | null) {
  useEffect(() => {
    if (!monaco) return;
    const ts = monaco.languages.typescript.typescriptDefaults;
    ts.addExtraLib(simtenCoreTypes, 'file:///node_modules/@simten/core/index.d.ts');
    ts.addExtraLib(simtenGlobals, 'file:///simten-globals.d.ts');
    ts.addExtraLib(
      CORE_SUBPATHS.map(
        (s) => `declare module '@simten/core/${s}' { export * from '@simten/core'; }`,
      ).join('\n'),
      'file:///simten-core-subpaths.d.ts',
    );
  }, [monaco]);
}
