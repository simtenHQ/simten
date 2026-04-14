/**
 * Eval Registry
 *
 * Stores eval/onTick functions keyed by component name.
 * Written to by circuit() at definition time, read by the simulator at compile time.
 *
 * Lives in the circuit layer (not simulator) — circuits own their behavior.
 */

export interface EvalEntry {
  inputNames: string[];
  outputNames: string[];
  evalFn: (inputs: Record<string, any>) => Record<string, any>;
  stateKeys?: string[];
  onTickFn?: (inputsAndState: Record<string, any>) => Record<string, any>;
  /** Cached synthesis AST (populated lazily by eval-synth on first export) */
  _synthAST?: any;
  /** Whether the eval passed synthesis validation */
  _synthValid?: boolean;
  /** Synthesis validation errors (for diagnostics) */
  _synthErrors?: string[];
}

const registry = new Map<string, EvalEntry>();

export function registerCircuitEval(name: string, entry: EvalEntry): void {
  if (!registry.has(name)) {
    registry.set(name, entry);
  }
}

export function getCircuitEval(name: string): EvalEntry | undefined {
  return registry.get(name);
}

export function getAllCircuitEvals(): ReadonlyMap<string, EvalEntry> {
  return registry;
}
