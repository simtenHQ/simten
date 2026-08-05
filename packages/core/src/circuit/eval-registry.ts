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

/**
 * Record a component's behaviour. Last definition wins.
 *
 * This used to keep the first registration and silently drop later ones, which
 * made a redefined primitive un-editable: the browser editor re-executes source
 * in the same realm, so this module-level Map survives a "reload", and changing
 * `eval: ({a, b}) => ({out: a & b})` to `a ^ b` left the circuit still computing
 * AND. Nothing surfaced the discrepancy — the source said one thing and the
 * simulation did another.
 *
 * Overwriting means a circuit sharing a name with a stdlib component now shadows
 * it for the rest of the session rather than being ignored. That is the more
 * predictable of the two surprises: the definition you can see in front of you
 * is the one that runs.
 *
 * Callers deriving caches from these entries must invalidate on identity change
 * — see `ensureEvaluatorRegistered`.
 */
export function registerCircuitEval(name: string, entry: EvalEntry): void {
  registry.set(name, entry);
}

export function getCircuitEval(name: string): EvalEntry | undefined {
  return registry.get(name);
}

export function getAllCircuitEvals(): ReadonlyMap<string, EvalEntry> {
  return registry;
}
