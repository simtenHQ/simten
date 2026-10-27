/**
 * Simulation propagation loop.
 *
 * Uses numeric circuits and typed arrays for performance.
 * Hot path uses evaluator table lookup — no switch statements, no Map allocations.
 */

import type { BitValue, BusValue } from '../ir/circuit-ir.js';
import type { EvalContext } from './evaluators/types.js';
import type { NumericEventQueue } from './numeric-event-queue.js';
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import type { FlatPortValueMap, PrimitiveState } from './types.js';
import { TOP_LEVEL_NODE } from './types.js';

/**
 * Node evaluations one propagate call may make before it gives up and reports
 * an unstable feedback loop. Scaled with the circuit: a settling wave can
 * evaluate every node several times over, so a fixed cap falsely trips on a
 * large circuit that is perfectly stable.
 */
export function maxPropagationIterations(nodeCount: number): number {
  return Math.max(10000, nodeCount * 64);
}

/** Proxy -> the holder carrying whichever Map that proxy is currently backed by:
 *  the committed one until a write forces a copy, the copy afterwards. */
const PROXY_TO_MAP = new WeakMap<object, { current: Map<number, number>; copied: boolean }>();

/**
 * Wrap a Map in a Proxy for array-indexed onTick mutation.
 *
 * Copy-on-write: reads go straight to the committed Map and the first write
 * clones it, so an onTick that writes nothing costs nothing. This is what keeps
 * a read-only memory off the O(entries)-per-tick path — `ROM`'s onTick returns
 * its memory unchanged, and used to pay for a full clone to do it.
 *
 * The clone on write is not an optimisation detail: snapshots alias committed
 * Maps by reference (`toFlatSequentialState`), so mutating one in place would
 * rewrite history. Every mutating path here must go through `ensureCopy`.
 */
function wrapMapForOnTick(map: Map<number, number>): any {
  const holder = { current: map, copied: false };
  const ensureCopy = (): Map<number, number> => {
    if (!holder.copied) {
      holder.current = new Map(holder.current);
      holder.copied = true;
    }
    return holder.current;
  };
  const proxy = new Proxy(map, {
    get(_target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return holder.current.get(Number(prop)) ?? 0;
      }
      if (prop === 'set' || prop === 'delete' || prop === 'clear') {
        return (...args: any[]) => (ensureCopy() as any)[prop](...args);
      }
      const val = (holder.current as any)[prop];
      return typeof val === 'function' ? val.bind(holder.current) : val;
    },
    set(_target, prop, value) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        ensureCopy().set(Number(prop), value);
        return true;
      }
      return false;
    },
  });
  PROXY_TO_MAP.set(proxy, holder);
  return proxy;
}

/** Scratch buffers for old output values + initialized flags (reused per
 *  propagate call to avoid allocation). The `wasInitialized` snapshot is
 *  taken alongside `oldValues` so first-eval propagation always fires —
 *  even when an evaluator's canonical output happens to equal the zero
 *  default that Int32Array gives us. */
const oldValuesScratch = new Uint32Array(64);
const wasInitializedScratch = new Uint8Array(64);

/** Booleans are accepted at the API boundary; everything stored is numeric. */
function toPortValue(value: unknown): number {
  return typeof value === 'boolean' ? (value ? 1 : 0) : (value as number);
}

/** Names the nodes still switching when the cap is hit, which is the loop. */
function unstableLoopMessage(
  circuit: NumericCircuit,
  queue: NumericEventQueue,
  maxIterations: number,
): string {
  const pending = queue.toArray().map((i) => circuit.indexToNodeId[i]);
  const shown = pending.slice(0, 8).join(', ');
  const more = pending.length > 8 ? `, and ${pending.length - 8} more` : '';
  return (
    `Propagation did not stabilize after ${maxIterations} evaluations: ` +
    `a combinational loop is oscillating. Still changing: ${shown}${more}.`
  );
}

/**
 * Propagation loop using the numeric circuit and the evaluator table.
 * No string operations or Map allocations in the hot path.
 *
 * @returns Number of node evaluations performed
 */
export function propagate(
  circuit: NumericCircuit,
  queue: NumericEventQueue,
  values: NumericPortValues,
  seqState: NumericSequentialState | undefined,
  topLevelInputs?: FlatPortValueMap,
): number {
  let evalCount = 0;
  let changedCount = 0;

  // Sync top-level inputs into numeric values array.
  // This is required for readInput() to see the current input values.
  // Also mark them initialized so downstream change-detection treats them
  // as real values rather than pending zeros.
  if (topLevelInputs) {
    for (const [key, value] of topLevelInputs) {
      const portIdx = circuit.portKeyToIndex.get(key);
      if (portIdx !== undefined) {
        values.values[portIdx] = toPortValue(value) & circuit.portMask[portIdx];
        values.initialized[portIdx] = 1;
      }
    }
  }

  const maxIterations = maxPropagationIterations(circuit.nodeCount);
  const evaluators = circuit.evaluators;
  const typeIndex = circuit.primitiveTypeIndex;

  // Create evaluation context (reused for all evaluations)
  const ctx: EvalContext = {
    circuit,
    values,
    state: seqState,
    queue,
    nodeIndex: 0,
    portStart: 0,
    inputCount: 0,
    outputCount: 0,
  };

  while (!queue.isEmpty()) {
    if (++evalCount > maxIterations) {
      throw new Error(unstableLoopMessage(circuit, queue, maxIterations));
    }

    const nodeIndex = queue.dequeue();

    // Set per-node context fields
    const portStart = circuit.nodePortStart[nodeIndex];
    const inputCount = circuit.nodeInputCount[nodeIndex];
    const outputCount = circuit.nodeOutputCount[nodeIndex];
    const outputStart = portStart + inputCount;

    ctx.nodeIndex = nodeIndex;
    ctx.portStart = portStart;
    ctx.inputCount = inputCount;
    ctx.outputCount = outputCount;

    // Capture old output values AND their initialized flags for change
    // detection. Re-use scratch buffers when the node fits, otherwise
    // allocate fresh ones. The initialized snapshot lets us treat the
    // first eval of any port as a "change" so propagation reaches its
    // dependents — necessary because Int32Array zero-defaults can't be
    // distinguished from a real zero output by value comparison alone.
    const oldValues = outputCount <= 64 ? oldValuesScratch : new Uint32Array(outputCount);
    const wasInitialized = outputCount <= 64 ? wasInitializedScratch : new Uint8Array(outputCount);
    for (let i = 0; i < outputCount; i++) {
      oldValues[i] = values.values[outputStart + i];
      wasInitialized[i] = values.initialized[outputStart + i];
    }

    // Dispatch via this compile's evaluator table: no Map allocation, no string keys.
    const evaluator = evaluators[typeIndex[nodeIndex]];

    if (evaluator) {
      evaluator(ctx);
    } else {
      // The compile had no behavior for this type. Throws, naming it.
      missingBehavior(circuit, nodeIndex);
    }

    // Check for changes and enqueue dependents. A port counts as "changed"
    // if its value differs from before OR if this is the first time it has
    // been written (transition from uninitialized → initialized).
    let anyChanged = false;
    for (let i = 0; i < outputCount; i++) {
      const idx = outputStart + i;
      if (values.values[idx] !== oldValues[i] || (values.initialized[idx] && !wasInitialized[i])) {
        anyChanged = true;
        break;
      }
    }

    if (anyChanged) {
      changedCount++;
      queue.enqueueAll(circuit.dependents[nodeIndex]);
    }
  }

  if (DEBUG_STATE_UPDATE) {
    console.log(`[propagate] ${evalCount} evals, ${changedCount} changed`);
  }

  return evalCount;
}

/**
 * A node whose primitive type has no behavior in this compile's table.
 * Throwing is far more useful than silently zeroing outputs and producing
 * nonsense state.
 */
function missingBehavior(circuit: NumericCircuit, nodeIndex: number): never {
  const node = circuit.flatCircuit.nodes[nodeIndex];
  throw new Error(
    `Primitive '${node.primitiveType}' has no behavior in this compile. ` +
      'The engine runs the behavior table it was given (`behaviors`), which ' +
      'a compile collects from the circuits it built. A Circuit IR built by hand ' +
      'needs its behavior added to that table.',
  );
}

/**
 * Seed the event queue with initial nodes for full evaluation.
 */
export function seedInitialQueue(circuit: NumericCircuit, queue: NumericEventQueue): void {
  let sourceCount = 0,
    stateOutputCount = 0,
    topLevelCount = 0;
  for (let i = 0; i < circuit.nodeCount; i++) {
    if (circuit.isSourceNode[i] || circuit.isStateOutputNode[i] || circuit.readsTopLevelInput[i]) {
      queue.enqueue(i);
      if (circuit.isSourceNode[i]) sourceCount++;
      if (circuit.isStateOutputNode[i]) stateOutputCount++;
      if (circuit.readsTopLevelInput[i]) topLevelCount++;
    }
  }
  if (DEBUG_STATE_UPDATE) {
    console.log(
      `[seedInitialQueue] Seeded ${queue.size()} nodes (source=${sourceCount}, stateOutput=${stateOutputCount}, topLevel=${topLevelCount})`,
    );
  }
}

/**
 * Seed the event queue with state-output nodes only.
 */
export function seedStateOutputNodes(circuit: NumericCircuit, queue: NumericEventQueue): void {
  for (let i = 0; i < circuit.nodeCount; i++) {
    if (circuit.isStateOutputNode[i]) {
      queue.enqueue(i);
    }
  }
}

let DEBUG_STATE_UPDATE = false;

/**
 * Enable propagation tracing on stderr. Off by default.
 *
 * Answers the two questions you need when an output is stale or a register
 * won't update, neither of which is visible once the circuit has been
 * flattened to typed arrays:
 *
 *   [seedInitialQueue] Seeded 47 nodes (source=12, stateOutput=8, topLevel=27)
 *   [propagate] 312 evals, 89 changed
 *
 * The seed line is the one that catches silent staleness: propagation is
 * event-driven, so a node that is never seeded and never enqueued by a
 * changed dependency simply doesn't run. The eval/changed counts show
 * whether a pass converged — a `changed` that stays high across passes is
 * oscillation heading for maxPropagationIterations.
 *
 * Global and not thread-safe; intended for a failing test or a one-off
 * script, not production code.
 */
export function setDebugStateUpdate(enabled: boolean) {
  DEBUG_STATE_UPDATE = enabled;
}

/**
 * Update sequential states for all stateful nodes.
 */
export function updateSequentialStates(
  circuit: NumericCircuit,
  values: NumericPortValues,
  seqState: NumericSequentialState,
  topLevelInputs?: FlatPortValueMap,
): void {
  for (let nodeIdx = 0; nodeIdx < circuit.nodeCount; nodeIdx++) {
    if (!circuit.hasState[nodeIdx]) continue;

    const node = circuit.flatCircuit.nodes[nodeIdx];
    const onTick = circuit.onTicks[circuit.primitiveTypeIndex[nodeIdx]];
    if (!onTick) continue;

    // Build inputs Map (same as evaluateNode fallback path)
    const inputs = new Map<string, BitValue | BusValue>();
    const portStart = circuit.nodePortStart[nodeIdx];
    const inputCount = circuit.nodeInputCount[nodeIdx];

    for (let i = 0; i < inputCount; i++) {
      const portIdx = portStart + i;
      const srcNodeIdx = circuit.inputSourceNode[portIdx];
      const srcPortIdx = circuit.inputSourcePort[portIdx];
      const portName = circuit.inputPortNames[portIdx];

      if (srcNodeIdx === -1) {
        if (topLevelInputs && srcPortIdx >= 0) {
          const topKey = circuit.indexToPortKey[srcPortIdx];
          const val = topLevelInputs.get(topKey);
          if (val !== undefined) {
            inputs.set(portName, val);
          }
        }
      } else if (srcPortIdx >= 0) {
        inputs.set(portName, values.values[srcPortIdx]);
      }
    }

    // Update state via onTick
    const currentState = seqState.currentState[nodeIdx];
    const obj: Record<string, any> = {};
    // Node arguments first (lowest precedence), under their plain names — this
    // matches the eval path (eval-bridge.ts) so onTick sees construction params
    // like `width`/`value` the same way eval does. Ports and state below
    // override on any name collision.
    if (node.arguments) {
      for (const [key, value] of Object.entries(node.arguments)) obj[key] = value;
    }
    for (const [k, v] of inputs) obj[k] = v;
    if (
      currentState != null &&
      typeof currentState === 'object' &&
      !(currentState instanceof Map)
    ) {
      // Memory fields get the same copy-on-write wrapper as a lone memory, so an
      // in-place write can't reach the committed Map that snapshots alias.
      for (const key of onTick.stateKeys) {
        const field = (currentState as any)[key];
        obj[key] = field instanceof Map ? wrapMapForOnTick(field) : field;
      }
    } else if (currentState != null && onTick.stateKeys.length === 1) {
      // Wrap Map in Proxy for array-indexable access in onTick: memory[addr] = value
      if (currentState instanceof Map) {
        obj[onTick.stateKeys[0]] = wrapMapForOnTick(currentState);
      } else {
        obj[onTick.stateKeys[0]] = currentState;
      }
    }
    const result = onTick.fn(obj);
    seqState.nextState[nodeIdx] =
      onTick.stateKeys.length === 1
        ? unwrapOnTickMap(result[onTick.stateKeys[0]])
        : unwrapOnTickFields(result);
  }
}

/** A proxy handed to onTick comes back as whichever Map now backs it. */
function unwrapOnTickMap(value: any): PrimitiveState {
  if (value != null && typeof value === 'object' && PROXY_TO_MAP.has(value)) {
    return PROXY_TO_MAP.get(value)!.current;
  }
  return value;
}

/** Same, for each field of a multi-block state object. */
function unwrapOnTickFields(result: any): any {
  if (result == null || typeof result !== 'object') return result;
  const keys = Object.keys(result).filter((key) => {
    const field = result[key];
    return field != null && typeof field === 'object' && PROXY_TO_MAP.has(field);
  });
  if (keys.length === 0) return result;
  const out: Record<string, any> = { ...result };
  for (const key of keys) out[key] = PROXY_TO_MAP.get(result[key])!.current;
  return out;
}

/**
 * Commit next state to current state.
 */
export function commitSequentialState(seqState: NumericSequentialState): void {
  for (let i = 0; i < seqState.currentState.length; i++) {
    const nextVal = seqState.nextState[i];
    if (nextVal !== undefined) {
      if (nextVal instanceof Map) {
        // Copy-on-write: an unchanged memory comes back as the very Map we
        // handed onTick, so there is nothing to isolate. A write already
        // produced a fresh Map, which we can adopt without copying again.
        if (nextVal !== seqState.currentState[i]) {
          seqState.currentState[i] = nextVal;
        }
        seqState.nextState[i] = nextVal;
      } else {
        seqState.currentState[i] = nextVal;
        seqState.nextState[i] = nextVal;
      }
    }
  }
  seqState.cycleCount++;
}

/**
 * Convert numeric port values to FlatPortValueMap for API compatibility.
 */
export function toFlatPortValueMap(
  circuit: NumericCircuit,
  values: NumericPortValues,
  topLevelInputs?: FlatPortValueMap,
): Map<string, BitValue | BusValue> {
  const result = new Map<string, BitValue | BusValue>();

  // Copy top-level inputs
  if (topLevelInputs) {
    for (const [key, value] of topLevelInputs) {
      result.set(key, value);
    }
  }

  // Convert numeric values to map. Values are numeric for every port width;
  // bit-ness lives in the port type, not in the JS type of the value.
  for (let i = 0; i < circuit.portCount; i++) {
    const key = circuit.indexToPortKey[i];
    const isOutput = circuit.portIsOutput[i] === 1;

    let numVal: number;
    let initialized: boolean;
    if (isOutput) {
      // Output port - read directly from values array
      numVal = values.values[i];
      initialized = values.initialized[i] !== 0;
    } else {
      // Input port - look up from source output port
      const srcPortIdx = circuit.inputSourcePort[i];
      if (srcPortIdx >= 0) {
        numVal = values.values[srcPortIdx];
        initialized = values.initialized[srcPortIdx] !== 0;
      } else {
        // Unconnected input — no source to read from
        numVal = 0;
        initialized = false;
      }
    }

    // Safety: report uninitialized ports as 0 in the exported map.
    // (Pre-fix, this was a `=== UNINITIALIZED_VALUE` check against a magic
    // sentinel, which collided with the legitimate value 0x80000000.)
    if (!initialized) {
      numVal = 0;
    }

    // Values are numeric regardless of width; the port type carries bit-ness,
    // not the value. (Bits used to be reported as booleans here, which made
    // callers infer width from the JS type; see inferWidth in
    // packages/mcp/src/lib/vcd-export.ts.)
    result.set(key, numVal);
  }

  return result;
}

/**
 * Initialize numeric port values from flat port values.
 */
export function fromFlatPortValueMap(
  circuit: NumericCircuit,
  values: NumericPortValues,
  flatValues: FlatPortValueMap,
): void {
  for (const [key, value] of flatValues) {
    const portIdx = circuit.portKeyToIndex.get(key);
    if (portIdx !== undefined) {
      values.values[portIdx] = toPortValue(value) & circuit.portMask[portIdx];
      // A restored value is, by definition, initialized — otherwise
      // change detection and getPortValues would mistakenly treat it
      // as still-pending.
      values.initialized[portIdx] = 1;
    }
  }
}

/**
 * Propagate to top-level outputs.
 */
export function propagateToTopLevelOutputs(
  circuit: NumericCircuit,
  values: NumericPortValues,
  result: Map<string, BitValue | BusValue>,
): void {
  for (const conn of circuit.flatCircuit.connections) {
    if (conn.target.nodeId === TOP_LEVEL_NODE || conn.target.nodeId === '') {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
      const sourcePortIdx = circuit.portKeyToIndex.get(sourceKey);
      if (sourcePortIdx !== undefined) {
        const targetKey = `${conn.target.nodeId || TOP_LEVEL_NODE}.${conn.target.portName}`;
        result.set(targetKey, values.values[sourcePortIdx]);
      }
    }
  }
}
