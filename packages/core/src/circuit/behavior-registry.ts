/**
 * Eval Registry
 *
 * Stores eval/onTick functions keyed by component name.
 * Written to by circuit() at definition time, read by the simulator at compile time.
 *
 * Lives in the circuit layer (not simulator) — circuits own their behavior.
 */

export interface BehaviorEntry {
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

const registry = new Map<string, BehaviorEntry>();

/**
 * Record a component's behaviour. Last definition wins — the editor re-executes
 * source in the same realm, so keeping the first registration left a redefined
 * primitive running its original eval. A name shared with a stdlib component
 * now shadows it for the session. Callers caching from these entries must
 * invalidate on identity change; see `ensureEvaluatorRegistered`.
 */
export function registerCircuitBehavior(name: string, entry: BehaviorEntry): void {
  registry.set(name, entry);
}

export function getCircuitBehavior(name: string): BehaviorEntry | undefined {
  return registry.get(name);
}

export function getAllCircuitBehaviors(): ReadonlyMap<string, BehaviorEntry> {
  return registry;
}

// ============================================================================
// Same-name definitions
// ============================================================================

/**
 * Definitions `circuit()` registered since the last `beginDefinitionScope()`,
 * by name. The key is computed lazily, so a name seen once never builds one.
 */
const scopeDefinitions = new Map<string, { describe: () => string; key?: string }>();
const reportedCollisions = new Set<string>();

/**
 * Start a fresh scope for same-name detection. The editor runs each version of
 * the user's source in the same realm, so a redefinition from one run to the
 * next is an edit, not a collision; `executeJsCode` calls this per run.
 * Outside it (a script, a test file) the scope is the whole process.
 */
export function beginDefinitionScope(): void {
  scopeDefinitions.clear();
  reportedCollisions.clear();
}

/**
 * Record that `circuit()` is registering `name`, and warn when this scope
 * already registered a different definition under it. Behaviour is keyed by
 * name alone, so the later definition replaces the earlier one everywhere it
 * is used (#428). Specialisations of one factory share a key (`describe`
 * leaves out widths), so they do not warn.
 */
export function noteDefinition(name: string, describe: () => string): void {
  const previous = scopeDefinitions.get(name);
  if (!previous) {
    scopeDefinitions.set(name, { describe });
    return;
  }
  previous.key ??= previous.describe();
  const key = describe();
  if (key === previous.key) return;
  scopeDefinitions.set(name, { describe, key });
  if (reportedCollisions.has(name)) return;
  reportedCollisions.add(name);
  console.warn(
    `Two different circuits are named '${name}'. Behaviour is looked up by name, ` +
      `so the later definition replaces the earlier one everywhere '${name}' is used. ` +
      'Give each its own name.',
  );
}
