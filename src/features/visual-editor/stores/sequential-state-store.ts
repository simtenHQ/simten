/**
 * Sequential State Store
 *
 * Manages sequential state for clock-based simulation.
 * This state is shared between ClockControls (which updates it on Step/Run)
 * and Canvas (which uses it for rendering).
 */

import { create } from 'zustand';
import type { SequentialState } from '../lib/simulator-v0.1';

interface SequentialStateStore {
  // Current sequential state
  seqState: SequentialState | null;

  // Actions
  setSeqState: (state: SequentialState | null) => void;
  getSeqState: () => SequentialState | null;
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
