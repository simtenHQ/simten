/**
 * Simulation propagation loop.
 *
 * Uses numeric circuits and typed arrays for performance.
 * Hot path uses evaluator table lookup — no switch statements, no Map allocations.
 */

import type { BitValue, BusValue } from '../types/circuit.js';
import type { FlatPortValueMap, PrimitiveState } from '../types/simulator.js';
import { TOP_LEVEL_NODE } from '../types/simulator.js';
import { getOnTickFunction } from './eval-bridge.js';
import { EVALUATORS, type EvalContext } from './evaluators/index.js';
import type { NumericEventQueue } from './numeric-event-queue.js';
import type { NumericCircuit, NumericSequentialState } from './numeric-types.js';
import type { NumericPortValues } from './numeric-values.js';
import type { ClockEdges } from './primitive-interface.js';

/** Maximum iterations before assuming unstable feedback loop */
const MAX_PROPAGATION_ITERATIONS = 10000;

/** WeakMap to unwrap Proxy back to underlying Map after onTick mutation */
const PROXY_TO_MAP = new WeakMap<object, Map<number, number>>();

/**
 * Wrap a Map in a Proxy for array-indexed onTick mutation.
 * Creates a copy so mutations don't affect current state.
 */
function wrapMapForOnTick(map: Map<number, number>): any {
  const copy = new Map(map);
  const proxy = new Proxy(copy, {
    get(target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return target.get(Number(prop)) ?? 0;
      }
      const val = (target as any)[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        target.set(Number(prop), value);
        return true;
      }
      return false;
    },
  });
  PROXY_TO_MAP.set(proxy, copy);
  return proxy;
}

/** Scratch buffers for old output values + initialized flags (reused per
 *  propagate call to avoid allocation). The `wasInitialized` snapshot is
 *  taken alongside `oldValues` so first-eval propagation always fires —
 *  even when an evaluator's canonical output happens to equal the zero
 *  default that Int32Array gives us. */
const oldValuesScratch = new Int32Array(64);
const wasInitializedScratch = new Uint8Array(64);

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
        values.values[portIdx] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        values.initialized[portIdx] = 1;
      }
    }
  }

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
    if (++evalCount > MAX_PROPAGATION_ITERATIONS) {
      throw new Error(
        `Propagation did not stabilize after ${MAX_PROPAGATION_ITERATIONS} iterations. ` +
          `Possible unstable feedback loop in circuit.`,
      );
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
    const oldValues = outputCount <= 64 ? oldValuesScratch : new Int32Array(outputCount);
    const wasInitialized = outputCount <= 64 ? wasInitializedScratch : new Uint8Array(outputCount);
    for (let i = 0; i < outputCount; i++) {
      oldValues[i] = values.values[outputStart + i];
      wasInitialized[i] = values.initialized[outputStart + i];
    }

    // Get evaluator from table
    const typeIdx = circuit.primitiveTypeIndex[nodeIndex];
    const evaluator = EVALUATORS[typeIdx];

    if (evaluator) {
      // Dispatch via the evaluator table — no Map allocation, no string keys.
      evaluator(ctx);
    } else {
      // Slot is null: registration contract was violated. The fallback throws
      // with a useful error naming the primitive.
      evaluateNodeFallback(circuit, nodeIndex, values, seqState, topLevelInputs);
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
 * Fallback: zero outputs for unknown primitives.
 * Should not be reached if all circuits have evals registered via circuit().
 */
function evaluateNodeFallback(
  circuit: NumericCircuit,
  nodeIndex: number,
  values: NumericPortValues,
  _seqState: NumericSequentialState | undefined,
  _topLevelInputs: FlatPortValueMap | undefined,
): void {
  const node = circuit.flatCircuit.nodes[nodeIndex];
  void values;
  // Contract: every primitive type must have an evaluator registered before
  // simulation. Built-ins are registered when `@simten/core/std` is imported
  // (or any module that uses circuit() to define them); user primitives are
  // registered automatically by circuit() at definition time. A missing slot
  // almost always means "forgot to import std" or "constructed a raw IR
  // without going through circuit()". Throwing is far more useful than
  // silently zeroing outputs and producing nonsense state.
  throw new Error(
    `Primitive '${node.primitiveType}' has no registered evaluator. ` +
      `Either import '@simten/core/std' to register the standard library, ` +
      `or register the primitive's eval lambda explicitly via registerEvalFunction(). ` +
      `If you constructed a Circuit IR by hand (rather than via circuit()), ` +
      `you must register its evaluator yourself.`,
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

/**
 * Update clock states for all clocks in the circuit.
 */
export function updateClockStates(
  _circuit: NumericCircuit,
  seqState: NumericSequentialState,
): void {
  for (const [_clockKey, clockState] of seqState.clocks) {
    clockState.edge = 'rising';
    clockState.value = true;
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
 * oscillation heading for MAX_PROPAGATION_ITERATIONS.
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
    const onTick = getOnTickFunction(node.primitiveType);
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

    // Build clock edges
    const clockEdges: ClockEdges = {};
    for (const clockPort of node.clocks) {
      const clockKey = `${node.id}.${clockPort.name}`;
      const clockState = seqState.clocks.get(clockKey);
      if (clockState) {
        clockEdges[clockPort.name] = clockState.edge;
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
      for (const key of onTick.stateKeys) obj[key] = (currentState as any)[key];
    } else if (currentState != null && onTick.stateKeys.length === 1) {
      // Wrap Map in Proxy for array-indexable access in onTick: memory[addr] = value
      if (currentState instanceof Map) {
        obj[onTick.stateKeys[0]] = wrapMapForOnTick(currentState);
      } else {
        obj[onTick.stateKeys[0]] = currentState;
      }
    }
    const result = onTick.fn(obj);
    let nextState: PrimitiveState =
      onTick.stateKeys.length === 1 ? result[onTick.stateKeys[0]] : result;
    // Unwrap Proxy back to Map if needed
    if (nextState != null && typeof nextState === 'object' && PROXY_TO_MAP.has(nextState)) {
      nextState = PROXY_TO_MAP.get(nextState)!;
    }

    seqState.nextState[nodeIdx] = nextState;
  }
}

/**
 * Commit next state to current state.
 */
export function commitSequentialState(seqState: NumericSequentialState): void {
  for (let i = 0; i < seqState.currentState.length; i++) {
    const nextVal = seqState.nextState[i];
    if (nextVal !== undefined) {
      if (nextVal instanceof Map) {
        seqState.currentState[i] = new Map(nextVal);
        seqState.nextState[i] = new Map(nextVal);
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

  // Convert numeric values to map
  // Return booleans for bit ports to maintain API compatibility
  for (let i = 0; i < circuit.portCount; i++) {
    const key = circuit.indexToPortKey[i];
    const isOutput = circuit.portIsOutput[i] === 1;
    const isBit = circuit.portIsBus[i] === 0;

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

    // Return boolean for true 1-bit values, number for multi-bit values
    // If value > 1 or < 0, it needs more than 1 bit, so return as number
    const needsMultiBit = numVal > 1 || numVal < 0;
    result.set(key, isBit && !needsMultiBit ? numVal !== 0 : numVal);
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
      values.values[portIdx] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
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
        const isBit = circuit.portIsBus[sourcePortIdx] === 0;
        const numVal = values.values[sourcePortIdx];
        result.set(targetKey, isBit ? numVal !== 0 : numVal);
      }
    }
  }
}
