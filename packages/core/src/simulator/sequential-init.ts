/**
 * Flat Circuit State Initialization
 *
 * Pure state initialization for flattened circuits.
 * This module has no browser/Zustand dependencies.
 */

import type {
  BitValue,
  BusValue,
  CircuitLibrary,
  StateBlock,
  ArgumentValue,
} from '../types/circuit.js';
import type {
  FlatCircuit,
  FlatSequentialState,
  PrimitiveState,
} from '../types/simulator.js';

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
 * @param library - Component library for resolving component definitions
 * @param memoryData - Optional pre-loaded memory data (nodeId -> address -> value)
 */
export function initializeFlatSequentialState(
  flatCircuit: FlatCircuit,
  library: CircuitLibrary,
  memoryData?: Map<string, Map<number, number>>
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

  if (memoryData) {
    // memoryData patterns available for matching
  }

  for (const node of flatCircuit.nodes) {
    const component = library.resolveCircuit(node.primitiveType);
    if (!component) continue;

    // Per-block init: for each state block, the initial value is the block's
    // declared default, overridden by `node.arguments[block.name]` if present.
    // Field-names-always: no magic `initial`/`init` keywords — the factory
    // option name === the state field name.
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const blockValues = component.state.map(block =>
        resolveBlockInitial(block, node.id, node.arguments, node.primitiveType, memoryData)
      );

      const primitiveState: PrimitiveState = (
        component.state.length === 1
          ? blockValues[0]
          : Object.fromEntries(
              component.state.map((block, i) => [block.name, blockValues[i]])
            )
      ) as PrimitiveState;

      currentState.set(node.id, primitiveState);
      nextState.set(node.id, primitiveState);
    }

    // Initialize clocks
    for (const clock of node.clocks) {
      clocks.set(portKey(node.id, clock.name), {
        value: false,
        edge: 'none'
      });
    }
  }

  return {
    currentState,
    nextState,
    clocks,
    cycleCount: 0
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
    // Seed from the block's declared initial (if any). `data` is a Map in
    // the original BuiltCircuit IR, but the sandbox worker round-trips IR
    // through JSON before postMessage, which turns Maps into plain objects
    // — handle both.
    const blockInit = block.initialValue as { data?: Map<number, number> | Record<string, number> } | undefined;
    if (blockInit?.data) {
      if (blockInit.data instanceof Map) {
        for (const [addr, value] of blockInit.data) memory.set(addr, value);
      } else if (typeof blockInit.data === 'object') {
        for (const [key, value] of Object.entries(blockInit.data)) {
          const addr = parseInt(key, 10);
          if (!isNaN(addr) && typeof value === 'number') memory.set(addr, value);
        }
      }
    }
    // Apply node.arguments override (array | sparse object | Map).
    if (override !== undefined) {
      if (Array.isArray(override)) {
        override.forEach((value, index) => {
          if (typeof value === 'number') memory.set(index, value);
        });
      } else if (override instanceof Map) {
        for (const [addr, value] of override as Map<number, number>) memory.set(addr, value);
      } else if (typeof override === 'object' && override !== null) {
        for (const [key, value] of Object.entries(override)) {
          const addr = parseInt(key, 10);
          if (!isNaN(addr) && typeof value === 'number') memory.set(addr, value);
        }
      }
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
  if (override !== undefined && (typeof override === 'number' || typeof override === 'boolean')) {
    return override;
  }
  const declared = block.initialValue;
  if (typeof declared === 'string') return declared; // text-buffer state (Console)
  return declared as BitValue | BusValue;
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
  primitiveType?: string
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
