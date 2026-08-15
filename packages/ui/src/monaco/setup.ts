/**
 * setupSimtenIntellisense — configure a Monaco instance to give real,
 * type-checked IntelliSense for Simten circuit source.
 *
 * Call once from `beforeMount`. Pair with `useTypeAcquisition` to also resolve
 * third-party imports like `react` or `zod`.
 *
 * ── Why each piece is here (all of it is load-bearing) ──────────────────────
 *
 * Monaco's TS worker starts with an empty virtual filesystem. Nothing resolves
 * unless we plant it. Two independent sources feed it:
 *
 *   1. Simten's own types — inlined at build time from `@simten/core`
 *      (see scripts/build-core-types.mjs). No fetch, works offline.
 *   2. Everything else (react, zod, ...) — fetched at runtime by
 *      `useTypeAcquisition`, which plants files under `file:///node_modules/`.
 *
 * That second path is why `moduleResolution: NodeJs` + `typeRoots` matter: bare
 * specifiers resolve by making the virtual filesystem *look like* a real
 * node_modules tree, not via a `paths` mapping. It is also why the editor's
 * model needs a real `file:///` URI — TS resolution walks up from the containing
 * file looking for node_modules, and finds nothing from Monaco's default
 * `inmemory://` scheme. `SimtenCodeEditor` sets that for you; if you are wiring
 * Monaco yourself, pass `path="file:///circuit.ts"` or similar.
 *
 * Note this is types-only. Actual execution resolves bare imports from esm.sh
 * inside the sandbox iframe. The two halves are wholly separate: code can run
 * fine while its types are still loading, and vice versa.
 */

import type { Monaco } from '@monaco-editor/react';
import { SIMTEN_CORE_GLOBALS, SIMTEN_CORE_TYPES } from './generated/core-types.gen';
import { registerSimtenSnippets } from './snippets';

/**
 * Importable `@simten/core` subpaths. The bundle is a flat aggregate of all of
 * them, registered below as the bare `@simten/core` module — but circuit source
 * imports from subpaths (`@simten/core/circuit`, `@simten/core/std`, ...), which
 * the bundle doesn't declare. Without help those resolve only via network type
 * acquisition of the published package: slow, and broken offline. Re-export the
 * bundle under each subpath so they resolve deterministically. Over-broad on
 * exports (every subpath appears to export everything), but correct for every
 * symbol that actually exists.
 */
const CORE_SUBPATHS = ['circuit', 'std', 'verilog', 'sim', 'simulator', 'api', 'verify'];

/**
 * Module-not-found diagnostics, suppressed because type acquisition is async and
 * best-effort. A package whose types are still downloading — or that ships none
 * at all — should degrade to "no completions", not a red squiggle on a line that
 * runs perfectly well in the sandbox.
 */
const MODULE_NOT_FOUND_CODES = [
  2307, // Cannot find module 'X' or its corresponding type declarations
  2792, // Cannot find module 'X'. Did you mean to set moduleResolution to 'node'?
];

export interface IntellisenseOptions {
  /**
   * Declare Simten's stdlib (`And`, `Adder`, `circuit`, ...) as ambient globals,
   * mirroring the runtime scope injected by `executeCircuitCode()`. Lets source
   * reference them with no import. Harmless alongside explicit imports.
   * @default true
   */
  globals?: boolean;
  /**
   * Extra `.d.ts` files to plant, keyed by virtual path. Use a
   * `file:///node_modules/<pkg>/index.d.ts` path to make a module resolvable.
   */
  extraLibs?: Record<string, string>;
  /**
   * Offer the scaffold snippets (`circuit`, `circuit-primitive`, ...). These are
   * the one thing the TS service can't derive: it already knows a node's ports
   * and which refs carry `.to()`, but not the shape of an empty circuit.
   * @default true
   */
  snippets?: boolean;
}

/**
 * Configure Monaco's TypeScript service for Simten circuit source.
 * Safe to call more than once — see `plantLib` for what "again" costs.
 */
export function setupSimtenIntellisense(monaco: Monaco, options: IntellisenseOptions = {}): void {
  const { globals = true, extraLibs, snippets = true } = options;
  const ts = monaco.languages.typescript;
  const defaults = ts.typescriptDefaults;

  /**
   * Register a lib, and keep any model at the same URI in step with it.
   *
   * `addExtraLib` alone is not enough. Monaco materialises a *model* for a lib
   * the first time the TS worker is asked something that needs it — a hover, a
   * quick fix — and from then on the worker resolves that path from the model,
   * which `addExtraLib` never touches. In the game that produced a very
   * specific bug: hover once on a level, move to the next one, and the globals
   * shim updated while the shadowing model kept the previous level's gates. The
   * newly unlocked gate — the one thing you had just earned — reported "Cannot
   * find name". Everything else resolved, because every other gate was already
   * in the stale copy, so it read as that gate being broken rather than the
   * editor being stale. A reload cleared it by destroying the models.
   *
   * Writing through the model also revalidates open files, which is what makes
   * the squiggle disappear rather than linger until the next keystroke.
   */
  const plantLib = (contents: string, path: string) => {
    defaults.addExtraLib(contents, path);
    const shadow = monaco.editor.getModel(monaco.Uri.parse(path));
    if (shadow && shadow.getValue() !== contents) shadow.setValue(contents);
  };

  // The TS worker reads model contents directly rather than waiting to be fed.
  defaults.setEagerModelSync(true);

  defaults.setCompilerOptions({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: false, // circuit source is casual; the sandbox compile is the real gate
    noEmit: true,
    allowJs: true,
    esModuleInterop: true,
    allowNonTsExtensions: true,
    typeRoots: ['file:///node_modules/@types'],
  });

  // Semantic validation stays ON — it is what produces typed completions.
  // Only module resolution failures are suppressed.
  defaults.setDiagnosticsOptions({ diagnosticCodesToIgnore: MODULE_NOT_FOUND_CODES });

  plantLib(SIMTEN_CORE_TYPES, 'file:///node_modules/@simten/core/index.d.ts');
  plantLib(
    CORE_SUBPATHS.map(
      (s) => `declare module '@simten/core/${s}' { export * from '@simten/core'; }`,
    ).join('\n'),
    'file:///simten-core-subpaths.d.ts',
  );

  if (globals) {
    plantLib(SIMTEN_CORE_GLOBALS, 'file:///simten-globals.d.ts');
  }

  for (const [path, contents] of Object.entries(extraLibs ?? {})) {
    plantLib(contents, path);
  }

  // Idempotent per Monaco instance — unlike addExtraLib, a second
  // registerCompletionItemProvider would list every snippet twice.
  if (snippets) registerSimtenSnippets(monaco);
}
