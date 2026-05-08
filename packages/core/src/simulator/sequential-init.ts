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

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {

      // Multi-block state: build a composite plain object (e.g. hybrid Map + scalars)
      if (component.state.length > 1) {
        const stateObj: Record<string, any> = {};
        for (const block of component.state) {
          const iv = block.initialValue;
          if (typeof iv === 'object' && iv !== null && 'data' in iv) {
            // Memory block — store the Map directly
            stateObj[block.name] = (iv as { data: Map<number, number> }).data;
          } else {
            stateObj[block.name] = iv;
          }
        }
        currentState.set(node.id, stateObj as PrimitiveState);
        nextState.set(node.id, stateObj as PrimitiveState);
        continue;
      }

      const stateBlock = component.state[0];

      // Check for instance-specific initial value in node.arguments
      let initialValue = stateBlock.initialValue;

      if ('initial' in node.arguments && node.arguments.initial !== undefined) {
        // Register/DFlipFlop scalar initial value
        initialValue = node.arguments.initial as number | boolean;
      } else if (stateBlock.stateType.kind === 'memory') {
        // Memory init: build a Map from `init:` (sparse Record or dense array)
        // and overlay any runtime-injected `memoryData` on top. Single canonical
        // path — applies to ROM, RAM, DualPortRAM, RV32I_InstrMem, etc.
        const memory = new Map<number, number>();

        const initData = node.arguments.init;
        if (initData !== undefined) {
          if (Array.isArray(initData)) {
            initData.forEach((value, index) => {
              if (typeof value === 'number') memory.set(index, value);
            });
          } else if (typeof initData === 'object') {
            for (const [key, value] of Object.entries(initData)) {
              const addr = parseInt(key, 10);
              if (!isNaN(addr) && typeof value === 'number') memory.set(addr, value);
            }
          }
        }

        // Runtime overlay takes precedence — allows patching node-arg ROM contents.
        if (memoryData) {
          const loadedData = getMemoryDataForNode(node.id, memoryData, node.primitiveType);
          if (loadedData) {
            for (const [addr, value] of loadedData.entries()) {
              memory.set(addr, value);
            }
          }
        }

        const stType = stateBlock.stateType;
        initialValue = {
          data: memory,
          addressWidth: stType.addressWidth,
          dataWidth: stType.dataWidth,
        };
      }

      // Convert StateValue to PrimitiveState
      let primitiveState: PrimitiveState;
      if (typeof initialValue === 'object' && 'data' in initialValue) {
        primitiveState = initialValue.data;
      } else if (typeof initialValue === 'string') {
        // Console state is a string
        primitiveState = initialValue;
      } else {
        primitiveState = initialValue as BitValue | BusValue;
      }

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
