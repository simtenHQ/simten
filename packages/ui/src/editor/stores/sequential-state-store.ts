/**
 * Sequential State Store
 *
 * Simplified store for sequential circuit state.
 * Time-travel and history are now managed by SimulationController.
 *
 * This store is just for pub/sub - components subscribe to seqState updates.
 */

import { create } from 'zustand';
import type { FlatSequentialState } from '../lib/flat-simulator';

interface SequentialStateStore {
  // Current sequential state (updated by SimulationController)
  seqState: FlatSequentialState | null;

  // Actions
  setSeqState: (state: FlatSequentialState | null) => void;
  getSeqState: () => FlatSequentialState | null;
}

export const useSequentialStateStore = create<SequentialStateStore>((set, get) => ({
  seqState: null,

  setSeqState: (state) => {
    set({ seqState: state });
  },

  getSeqState: () => {
    return get().seqState;
  },
}));
