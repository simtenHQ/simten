/**
 * Flat Circuit State Initialization
 *
 * Pure state initialization for flattened circuits.
 * This module has no browser/Zustand dependencies.
 */

import type {
  ArgumentValue,
  BitValue,
  BusValue,
  CircuitDefinitions,
  MemoryContents,
  MemoryValue,
  StateBlock,
} from '../ir/circuit-ir.js';
import { memoryContentsShapeError } from '../ir/memory-contents.js';
import type { FlatCircuit, FlatSequentialState, PrimitiveState } from './types.js';

/**
 * Create port key from node ID and port name
 */
function portKey(nodeId: string, portName: string): string {
  return `${nodeId}.${portName}`;
}

/**
 * Initialize sequential state for all stateful primitives in flat circuit.
 *
 * @param flatCircuit - The flattened circuit
 * @param definitions - Circuit definitions to resolve components against
 * @param memoryData - Optional pre-loaded memory data (nodeId -> address -> value)
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit,
  definitions: CircuitDefinitions,
  memoryData?: Map<string, Map<number, number>>,
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

  if (memoryData) {
    // memoryData patterns available for matching
  }

  for (const node of flatCircuit.nodes) {
    const component = definitions.resolveCircuit(node.primitiveType);
    if (!component) continue;

    // Per-block init: for each state block, the initial value is the block's
    // declared default, overridden by `node.arguments[block.name]` if present.
    // Field-names-always: no magic `initial`/`init` keywords — the factory
    // option name === the state field name.
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const blockValues = component.state.map((block) =>
        resolveBlockInitial(block, node.id, node.arguments, node.primitiveType, memoryData),
      );

      const primitiveState: PrimitiveState = (
        component.state.length === 1
          ? blockValues[0]
          : Object.fromEntries(component.state.map((block, i) => [block.name, blockValues[i]]))
      ) as PrimitiveState;

      currentState.set(node.id, primitiveState);
      nextState.set(node.id, primitiveState);
    }

    // Initialize clocks
    for (const clock of node.clocks) {
      clocks.set(portKey(node.id, clock.name), {
        value: false,
        edge: 'none',
      });
    }
  }

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0,
  };
}

/**
 * Resolve the initial value for one state block on one node.
 *
 * Default = block.initialValue. Override = `node.arguments[block.name]` if set
 * (the "field-names-always" rule — factory option name === state field name).
 * Memory blocks additionally overlay any runtime-injected `memoryData`.
 */
function resolveBlockInitial(
  block: StateBlock,
  nodeId: string,
  args: Record<string, ArgumentValue>,
  primitiveType: string,
  memoryData?: Map<string, Map<number, number>>,
): BitValue | BusValue | Map<number, number> | string {
  const kind = block.stateType.kind;
  const override = args[block.name];

  if (kind === 'memory') {
    const memory = new Map<number, number>();
    // Seed from the block's declared contents, then the node's own
    // (`ROM({ memory })`). Both are `{ address: value }` objects; circuit()
    // has already checked them against the memory's depth and width.
    const declared = (block.initialValue as MemoryValue | undefined)?.data;
    if (declared) addContents(memory, declared);
    if (override !== undefined) {
      // A hand-built or deserialized IR is not checked by circuit().
      const shapeError = memoryContentsShapeError(override);
      if (shapeError) throw new Error(`Node '${nodeId}' state '${block.name}': ${shapeError}`);
      addContents(memory, override as MemoryContents);
    }
    // Runtime memoryData overlay (e.g. user-uploaded ROM) wins.
    if (memoryData) {
      const loadedData = getMemoryDataForNode(nodeId, memoryData, primitiveType);
      if (loadedData) {
        for (const [addr, value] of loadedData.entries()) memory.set(addr, value);
      }
    }
    return memory;
  }

  // Scalar (bit | bus). Default from block, override from node.arguments.
  // Booleans are accepted from user-authored arguments and coerced to 0/1.
  if (override !== undefined && (typeof override === 'number' || typeof override === 'boolean')) {
    return typeof override === 'boolean' ? (override ? 1 : 0) : override;
  }
  const declared = block.initialValue;
  if (typeof declared === 'string') return declared; // text-buffer state (Console)
  // `StateValue` excludes boolean, but a Circuit IR is not always produced by
  // circuit(): it can be deserialized JSON (buildFromIR, imported netlists, the
  // sandbox postMessage boundary) or hand-constructed, where the declared type
  // is not enforced at runtime. This used to be a bare `as` cast, which let a
  // boolean initialValue through and left bit state as `false` while every port
  // value was numeric. Coerce instead of asserting.
  if (typeof declared === 'boolean') return declared ? 1 : 0;
  return declared as BitValue | BusValue;
}

function addContents(memory: Map<number, number>, contents: MemoryContents): void {
  for (const [key, value] of Object.entries(contents)) {
    const addr = Number(key);
    if (Number.isInteger(addr) && typeof value === 'number') memory.set(addr, value);
  }
}

/**
 * Convert a glob pattern (with * wildcards) to a RegExp.
 * "cpu0*imem" → /cpu0.*imem/i
 * Plain strings without * still work as substring matches.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(withWildcards, 'i');
}

/**
 * Helper to get memory data for a node from the injected memory data map.
 * Glob matching: "cpu0*imem" matches "cpu0_abc.RV32I_CPU_imem_xyz"
 * Also checks primitive type, so "instrmem" matches any RV32I_InstrMem node.
 */
function getMemoryDataForNode(
  nodeId: string,
  memoryData: Map<string, Map<number, number>>,
  primitiveType?: string,
): Map<number, number> | undefined {
  for (const [pattern, data] of memoryData) {
    const regex = globToRegex(pattern);
    if (regex.test(nodeId)) {
      return data;
    }
    if (primitiveType && regex.test(primitiveType)) {
      return data;
    }
  }
  return undefined;
}
