/**
 * Port Values Store
 *
 * Single source of truth for all wire/port values in the circuit.
 * Updated by the simulator (ClockControls), read by views (Canvas).
 *
 * Architecture:
 * - Simulator computes truth → stores here
 * - Views read truth → never simulate
 *
 * This matches how real HDL simulators work:
 * - ModelSim/Verilator compute signals
 * - GTKWave/viewers read signals (never recompute)
 */

import { create } from 'zustand';
import type { FlatPortValueMap } from '../lib/flat-simulator';

interface PortValuesState {
  /**
   * Current port values for all nodes in the circuit.
   * Key format: "nodeId.portName" (e.g., "alu.result.out")
   *
   * This is the ONLY source of truth for wire values.
   * Updated by simulator, read by Canvas.
   */
  portValues: FlatPortValueMap;

  /**
   * Set port values (called by simulator after each tick)
   */
  setPortValues: (values: FlatPortValueMap) => void;

  /**
   * Clear port values (called when circuit structure changes)
   */
  clearPortValues: () => void;
}

export const usePortValuesStore = create<PortValuesState>((set) => ({
  portValues: new Map(),

  setPortValues: (values) => {
    set({ portValues: values });
  },

  clearPortValues: () => {
    set({ portValues: new Map() });
  },
}));
