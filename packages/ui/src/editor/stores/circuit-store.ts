/**
 * Circuit Store
 *
 * Holds the circuit currently shown in the editor. The editor is code-first,
 * so the circuit is only ever replaced whole, never edited node by node.
 */

import { create } from 'zustand';
import type { CircuitIR } from '../types/circuit';

export interface CircuitStore {
  circuit: CircuitIR | null;
  setCircuit: (circuit: CircuitIR) => void;
  clearCircuit: () => void;
}

export const useCircuitStore = create<CircuitStore>()((set) => ({
  circuit: null,
  setCircuit: (circuit) => set({ circuit }),
  clearCircuit: () => set({ circuit: null }),
}));
