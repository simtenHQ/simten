/**
 * Store for runtime-loaded memory data.
 *
 * This allows loading binary data into ROM/RAM components at runtime,
 * keeping circuit definitions (DSL) separate from program data.
 *
 * Data is keyed by a pattern that matches node IDs in the flattened circuit.
 * For example: "rom" matches any node ending in "rom".
 */
import { create } from 'zustand';

export interface MemoryDataEntry {
  /** The binary data as a Map from address to value */
  data: Map<number, number>;
  /** Original filename for display purposes */
  filename: string;
  /** Base address offset (default 0) */
  baseAddress: number;
}

interface MemoryDataState {
  /**
   * Loaded memory data, keyed by component name pattern.
   * Pattern matching: "rom" matches nodes like "system.mem_bus.rom", "Stage7Test_rom_123", etc.
   */
  loadedData: Map<string, MemoryDataEntry>;

  /**
   * Generation counter - increments whenever data changes.
   * Components can watch this to detect when they need to re-initialize.
   * This mirrors real hardware: changing ROM requires a reset.
   */
  generation: number;

  /**
   * Load binary data for a component.
   * @param pattern - Component name pattern to match (e.g., "rom")
   * @param data - Binary data as Uint8Array
   * @param filename - Original filename
   * @param baseAddress - Base address offset (default 0)
   */
  loadData: (pattern: string, data: Uint8Array, filename: string, baseAddress?: number) => void;

  /**
   * Clear loaded data for a component.
   */
  clearData: (pattern: string) => void;

  /**
   * Clear all loaded data.
   */
  clearAll: () => void;

  /**
   * Get data for a specific node ID.
   * Checks if any loaded pattern matches the node ID.
   */
  getDataForNode: (nodeId: string) => Map<number, number> | undefined;
}

export const useMemoryDataStore = create<MemoryDataState>((set, get) => ({
  loadedData: new Map(),
  generation: 0,

  loadData: (pattern, data, filename, baseAddress = 0) => {
    const memoryMap = new Map<number, number>();

    // Convert Uint8Array to Map<address, value>
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0) {
        // Only store non-zero bytes (sparse representation)
        memoryMap.set(baseAddress + i, data[i]);
      }
    }

    set((state) => {
      const newData = new Map(state.loadedData);
      newData.set(pattern, { data: memoryMap, filename, baseAddress });
      // Increment generation - components watching this will re-initialize (like a reset after ROM swap)
      return { loadedData: newData, generation: state.generation + 1 };
    });
  },

  clearData: (pattern) => {
    set((state) => {
      const newData = new Map(state.loadedData);
      newData.delete(pattern);
      return { loadedData: newData, generation: state.generation + 1 };
    });
  },

  clearAll: () => {
    set((state) => ({ loadedData: new Map(), generation: state.generation + 1 }));
  },

  getDataForNode: (nodeId) => {
    const { loadedData } = get();

    // Check each pattern to see if it matches this node ID
    for (const [pattern, entry] of loadedData) {
      // Simple matching: pattern appears in nodeId (case-insensitive)
      // e.g., pattern "rom" matches "Stage7Test_rom_123_abc"
      if (nodeId.toLowerCase().includes(pattern.toLowerCase())) {
        return entry.data;
      }
    }

    return undefined;
  },
}));
