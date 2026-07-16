/**
 * useCircuitCompiler — turn editor source into a compiled circuit, with no
 * opinion about what to do with the result.
 *
 * This is the compile bridge that every editor-with-preview otherwise
 * re-implements. It owns the fiddly mechanics — debounce, `sandbox.compile`,
 * worker-restart retry, error line/col extraction, building the `library`
 * lookup, keep-last-good-on-error, stale-compile cancellation — and hands back
 * the raw result plus diagnostics. The caller decides what to do with it
 * (feed a simulator, push to a store, render a canvas).
 *
 * For the common "source → live simulation" case, use `useCompiledCircuit`,
 * which composes this with `builtFromIR` + `useCircuitSimulator`.
 *
 * Requires a `SandboxProvider` ancestor — user code compiles in the sandbox
 * iframe, never the main frame.
 */

import type { Circuit } from '@simten/core';
import { type CompileResult, type SimSlot, useSandboxContext } from '@simten/ui/sandbox';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A compile diagnostic. Structurally compatible with `@simten/ui/monaco`'s
 * `SimtenDiagnostic`, so it can be passed straight to `SimtenCodeEditor`'s
 * `diagnostics` prop. `line`/`column` are 1-based, or 0 when the error has no
 * location (a whole-file error) — those still carry a message but produce no
 * squiggle.
 */
export interface CompileDiagnostic {
  message: string;
  line: number;
  column: number;
}

/** A minimal component-lookup built from a compile result. */
export interface CompiledLibrary {
  resolveCircuit: (name: string) => Circuit | undefined;
  getAllPrimitiveNames: () => string[];
  getAllCircuitNames: () => string[];
}

export interface UseCircuitCompilerOptions {
  /** Recompile (debounced) whenever `source` changes. @default true */
  autoCompile?: boolean;
  /** Debounce before an auto-compile. @default 300 */
  debounceMs?: number;
  /** Sandbox compile slot — evals register under it. @default 'editor' */
  slot?: SimSlot;
}

export interface CircuitCompilerState {
  /** Last successful compile. Retained across a subsequent failure. */
  result: CompileResult | null;
  /** Component lookup for the last successful compile. */
  library: CompiledLibrary | null;
  /** Diagnostics from the last compile ([] on success). */
  diagnostics: CompileDiagnostic[];
  /** True while a compile is in flight. */
  compiling: boolean;
  /** Compile the current source now (bypasses the debounce). */
  compile: () => Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_SLOT: SimSlot = 'editor';
const NO_CIRCUITS_MESSAGE = "No circuits found. Use circuit('Name', { ... }) to define a circuit.";

export function useCircuitCompiler(
  source: string,
  options: UseCircuitCompilerOptions = {},
): CircuitCompilerState {
  const { autoCompile = true, debounceMs = DEFAULT_DEBOUNCE_MS, slot = DEFAULT_SLOT } = options;

  const sandbox = useSandboxContext();
  const sandboxRef = useRef(sandbox);
  sandboxRef.current = sandbox;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const [result, setResult] = useState<CompileResult | null>(null);
  const [library, setLibrary] = useState<CompiledLibrary | null>(null);
  const [diagnostics, setDiagnostics] = useState<CompileDiagnostic[]>([]);
  const [compiling, setCompiling] = useState(false);

  // Bumped on each run so a slow compile that finishes after a newer one can't
  // clobber fresher state.
  const genRef = useRef(0);

  const run = useCallback(
    async (retried = false): Promise<void> => {
      const gen = ++genRef.current;
      setCompiling(true);
      try {
        const res = await sandboxRef.current.compile(sourceRef.current, slot);
        if (gen !== genRef.current) return; // superseded

        if ('error' in res) {
          // 'Worker restarted' means this compile was collateral damage — the
          // worker was killed by a *different* compile's infinite loop. Retry
          // once on the fresh worker. Do not retry other errors (e.g. a real
          // timeout caused by this code).
          if (res.error === 'Worker restarted' && !retried) {
            setTimeout(() => void run(true), 100);
            return;
          }
          const m = res.error.match(/\((\d+):(\d+)\)/);
          setDiagnostics([
            {
              message: res.error,
              line: m ? Number.parseInt(m[1], 10) : 0,
              column: m ? Number.parseInt(m[2], 10) : 0,
            },
          ]);
          return; // keep last good result
        }

        if (res.circuits.length === 0) {
          setDiagnostics([{ message: NO_CIRCUITS_MESSAGE, line: 0, column: 0 }]);
          return;
        }

        const all = [...res.circuits, ...res.libraryCircuits];
        const map = new Map(all.map((c) => [c.name, c]));
        setResult(res);
        setLibrary({
          resolveCircuit: (name) => map.get(name),
          getAllPrimitiveNames: () =>
            all.filter((c) => c.implementation?.kind === 'primitive').map((c) => c.name),
          getAllCircuitNames: () => Array.from(map.keys()),
        });
        setDiagnostics([]);
      } catch (e) {
        if (gen !== genRef.current) return;
        setDiagnostics([
          { message: e instanceof Error ? e.message : String(e), line: 0, column: 0 },
        ]);
      } finally {
        if (gen === genRef.current) setCompiling(false);
      }
    },
    [slot],
  );

  const compile = useCallback(() => run(false), [run]);

  useEffect(() => {
    if (!autoCompile || !source.trim()) return;
    const timer = setTimeout(() => void run(false), debounceMs);
    return () => clearTimeout(timer);
  }, [source, autoCompile, debounceMs, run]);

  return { result, library, diagnostics, compiling, compile };
}
