/**
 * Flat Circuit State Initialization
 *
 * Pure state initialization for flattened circuits.
 * This module has no browser/Zustand dependencies.
 */

import type {
  BitValue,
  BusValue,
  ComponentLibrary,
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
  library: ComponentLibrary,
  memoryData?: Map<string, Map<number, number>>
): FlatSequentialState {
  const currentState = new Map<string, PrimitiveState>();
  const nextState = new Map<string, PrimitiveState>();
  const clocks = new Map<string, { value: boolean; edge: 'rising' | 'falling' | 'none' }>();

  for (const node of flatCircuit.nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check if this primitive has state
    if (component.implementation.kind === 'primitive' && component.state.length > 0) {
      const stateBlock = component.state[0];

      // Check for instance-specific initial value in node.arguments
      let initialValue = stateBlock.initialValue;

      if ('initial' in node.arguments && node.arguments.initial !== undefined) {
        // Register/DFlipFlop initial value
        initialValue = node.arguments.initial as number | boolean;
      } else if ('init' in node.arguments && node.arguments.init !== undefined) {
        // RAM initial values (array or object)
        const initData = node.arguments.init;
        const memory = new Map<number, number>();

        if (Array.isArray(initData)) {
          initData.forEach((value, index) => {
            if (typeof value === 'number') {
              memory.set(index, value);
            }
          });
        } else if (typeof initData === 'object') {
          for (const [key, value] of Object.entries(initData)) {
            const addr = parseInt(key, 10);
            if (!isNaN(addr) && typeof value === 'number') {
              memory.set(addr, value);
            }
          }
        }

        initialValue = { data: memory, addressWidth: 8, dataWidth: 8 };
      } else if (node.primitiveType === 'ROM') {
        // ROM initialization - check for DSL-embedded data first, then runtime-loaded data
        const memory = new Map<number, number>();

        // 1. Check for DSL-embedded data (node.arguments.data)
        if ('data' in node.arguments && node.arguments.data) {
          const dslData = node.arguments.data as Record<string, number>;
          for (const [key, value] of Object.entries(dslData)) {
            const addr = parseInt(key, 10);
            if (!isNaN(addr) && typeof value === 'number') {
              memory.set(addr, value);
            }
          }
        }

        // 2. Check for runtime-loaded data from injected memoryData
        // Runtime data takes precedence (allows patching DSL-embedded ROMs)
        if (memoryData) {
          const loadedData = getMemoryDataForNode(node.id, memoryData);
          if (loadedData) {
            // Runtime data overwrites DSL data for same addresses
            for (const [addr, value] of loadedData.entries()) {
              memory.set(addr, value);
            }
          }
        }

        initialValue = { data: memory, addressWidth: 16, dataWidth: 8 };
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
 * Helper to get memory data for a node from the injected memory data map.
 * Pattern matching: "rom" matches nodes like "system.mem_bus.rom"
 */
function getMemoryDataForNode(
  nodeId: string,
  memoryData: Map<string, Map<number, number>>
): Map<number, number> | undefined {
  for (const [pattern, data] of memoryData) {
    if (nodeId.toLowerCase().includes(pattern.toLowerCase())) {
      return data;
    }
  }
  return undefined;
}
