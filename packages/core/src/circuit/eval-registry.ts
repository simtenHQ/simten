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
