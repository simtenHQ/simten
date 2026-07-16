/**
 * useCompiledCircuit — source text → live simulation, in one hook.
 *
 * Composes `useCircuitCompiler` (compile mechanics) with `builtFromIR` +
 * `useCircuitSimulator` (simulation). The "I have source, give me a running
 * circuit" convenience for editors and playgrounds; multiplayer/collaborative
 * apps read their source from a Y.Text and pass the current string in.
 *
 * Callers that need to route the compile result somewhere custom (e.g. into
 * their own selection stores, as `apps/web` does) should use `useCircuitCompiler`
 * directly and drive the simulator themselves.
 *
 * Requires a `SandboxProvider` ancestor.
 */

import type { Circuit } from '@simten/core';
import { useMemo, useRef } from 'react';
import { type UseCircuitCompilerOptions, useCircuitCompiler } from './useCircuitCompiler';
import {
  builtFromIR,
  type SimulatorActions,
  type SimulatorState,
  type UseCircuitSimulatorOptions,
  useCircuitSimulator,
} from './useCircuitSimulator';

export interface UseCompiledCircuitOptions
  extends UseCircuitCompilerOptions,
    UseCircuitSimulatorOptions {
  /**
   * Choose which circuit to simulate when the source defines more than one.
   * @default the last circuit defined
   */
  select?: (circuits: Circuit[]) => Circuit | undefined;
}

export type CompiledCircuitState = SimulatorState &
  SimulatorActions & {
    /** Last compile error message, or null. Distinct from `error` (a sim error). */
    compileError: string | null;
    /** True while a compile is in flight. */
    compiling: boolean;
  };

const selectLast = (circuits: Circuit[]): Circuit | undefined => circuits[circuits.length - 1];

export function useCompiledCircuit(
  source: string,
  options: UseCompiledCircuitOptions = {},
): CompiledCircuitState {
  const { autoCompile, debounceMs, slot, select, autoHarness, initialInputs } = options;

  const { result, diagnostics, compiling } = useCircuitCompiler(source, {
    autoCompile,
    debounceMs,
    slot,
  });

  // Ref'd so an inline `select` doesn't rebuild the circuit every render.
  const selectRef = useRef(select);
  selectRef.current = select;

  const built = useMemo(() => {
    if (!result) return null;
    const chosen = (selectRef.current ?? selectLast)(result.circuits);
    if (!chosen) return null;
    return builtFromIR(chosen, [...result.libraryCircuits, ...result.circuits]);
  }, [result]);

  const sim = useCircuitSimulator(built, { autoHarness, initialInputs });

  return { ...sim, compileError: diagnostics[0]?.message ?? null, compiling };
}
