/**
 * Sequential State Store
 *
 * Manages sequential state for clock-based simulation with time-travel debugging support.
 * This state is shared between ClockControls (which updates it on Step/Run)
 * and Canvas (which uses it for rendering).
 *
 * Time-travel features:
 * - History array with ring buffer (configurable max size)
 * - Sparse checkpoints for efficient long-range jumps
 * - Navigation: stepBack, stepForward, jumpToCycle
 *
 * Snapshot Policy:
 * - Simulation history contains only POST-TICK states (completed clock edges)
 * - history[n] = state after n clock ticks have executed
 * - history[0] = initial state (t=0, before any ticks)
 * - This ensures time travel shows actual visible states, not intermediate states
 */

import { create } from 'zustand';
import type { SequentialState } from '../lib/simulator-v0.1';
import type { SimulationSnapshot } from '../types/simulation-snapshot';

interface SequentialStateStore {
  // Current sequential state
  seqState: SequentialState | null;

  // History management
  history: SimulationSnapshot[];
  currentHistoryIndex: number; // Which snapshot we're viewing (-1 = live)
  isViewingPast: boolean; // True if currentHistoryIndex < history.length - 1

  // Configuration
  maxHistorySize: number; // Ring buffer limit (default: 1000)
  checkpointInterval: number; // Save checkpoint every N cycles (default: 100)

  // Sparse checkpoints (for long-range jumps)
  checkpoints: Map<number, SimulationSnapshot>;

  // Actions
  setSeqState: (state: SequentialState | null) => void;
  getSeqState: () => SequentialState | null;

  // Navigation
  saveSnapshot: (snapshot: SimulationSnapshot) => void;
  stepBack: () => SimulationSnapshot | null;
  stepForward: () => SimulationSnapshot | null;
  jumpToCycle: (cycleNumber: number) => SimulationSnapshot | null;
  clearHistory: () => void;
}

export const useSequentialStateStore = create<SequentialStateStore>((set, get) => ({
  seqState: null,

  // New fields
  history: [],
  currentHistoryIndex: -1,
  isViewingPast: false,
  maxHistorySize: 1000,
  checkpointInterval: 100,
  checkpoints: new Map(),

  setSeqState: (state) => {
    set({ seqState: state });
  },

  getSeqState: () => {
    return get().seqState;
  },

  saveSnapshot: (snapshot) =>
    set((state) => {
      let newHistory: SimulationSnapshot[];

      if (state.isViewingPast) {
        // Trim the future: we're creating a new timeline from this point
        // Keep history up to current position, discard everything after
        newHistory = state.history.slice(0, state.currentHistoryIndex + 1);
        newHistory.push(snapshot);

        // Clear checkpoints that are in the trimmed future
        const newCheckpoints = new Map<number, SimulationSnapshot>();
        for (const [cycleNum, checkpoint] of state.checkpoints) {
          if (cycleNum <= snapshot.cycleNumber) {
            newCheckpoints.set(cycleNum, checkpoint);
          }
        }

        // Save checkpoint for new snapshot if at interval
        if (snapshot.cycleNumber % state.checkpointInterval === 0) {
          const checkpointSnapshot: SimulationSnapshot = {
            sequentialState: {
              currentState: new Map(snapshot.sequentialState.currentState),
              nextState: new Map(snapshot.sequentialState.nextState),
              clocks: new Map(snapshot.sequentialState.clocks),
              cycleCount: snapshot.sequentialState.cycleCount,
            },
            environmentalState: new Map(snapshot.environmentalState),
            cycleNumber: snapshot.cycleNumber,
            timestamp: snapshot.timestamp,
          };
          newCheckpoints.set(snapshot.cycleNumber, checkpointSnapshot);
        }

        return {
          history: newHistory,
          currentHistoryIndex: newHistory.length - 1,
          isViewingPast: false,
          checkpoints: newCheckpoints,
        };
      } else {
        // Normal append (we're at the latest state)
        newHistory = [...state.history, snapshot];

        // Ring buffer: drop oldest if exceeding max
        if (newHistory.length > state.maxHistorySize) {
          newHistory.shift();
        }

        // Save checkpoint if at interval
        const newCheckpoints = new Map(state.checkpoints);
        if (snapshot.cycleNumber % state.checkpointInterval === 0) {
          // Clone the snapshot for checkpoint (prevent mutation)
          const checkpointSnapshot: SimulationSnapshot = {
            sequentialState: {
              currentState: new Map(snapshot.sequentialState.currentState),
              nextState: new Map(snapshot.sequentialState.nextState),
              clocks: new Map(snapshot.sequentialState.clocks),
              cycleCount: snapshot.sequentialState.cycleCount,
            },
            environmentalState: new Map(snapshot.environmentalState), // Clone Map
            cycleNumber: snapshot.cycleNumber,
            timestamp: snapshot.timestamp,
          };

          newCheckpoints.set(snapshot.cycleNumber, checkpointSnapshot);
        }

        return {
          history: newHistory,
          currentHistoryIndex: newHistory.length - 1,
          isViewingPast: false,
          checkpoints: newCheckpoints,
        };
      }
    }),

  stepBack: () => {
    const { currentHistoryIndex, history } = get();

    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const snapshot = history[newIndex];

      // Clone the sequential state to prevent mutation of snapshot
      const clonedSeqState = {
        currentState: new Map(snapshot.sequentialState.currentState),
        nextState: new Map(snapshot.sequentialState.nextState),
        clocks: new Map(snapshot.sequentialState.clocks),
        cycleCount: snapshot.sequentialState.cycleCount,
      };

      // Deep clone RAM states (Map values)
      for (const [nodeId, value] of snapshot.sequentialState.currentState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.currentState.set(nodeId, new Map(value));
        }
      }
      for (const [nodeId, value] of snapshot.sequentialState.nextState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.nextState.set(nodeId, new Map(value));
        }
      }

      set({
        currentHistoryIndex: newIndex,
        isViewingPast: true,
        seqState: clonedSeqState,
      });

      return snapshot;
    }

    return null;
  },

  stepForward: () => {
    const { currentHistoryIndex, history } = get();

    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const snapshot = history[newIndex];

      // Clone the sequential state to prevent mutation of snapshot
      const clonedSeqState = {
        currentState: new Map(snapshot.sequentialState.currentState),
        nextState: new Map(snapshot.sequentialState.nextState),
        clocks: new Map(snapshot.sequentialState.clocks),
        cycleCount: snapshot.sequentialState.cycleCount,
      };

      // Deep clone RAM states (Map values)
      for (const [nodeId, value] of snapshot.sequentialState.currentState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.currentState.set(nodeId, new Map(value));
        }
      }
      for (const [nodeId, value] of snapshot.sequentialState.nextState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.nextState.set(nodeId, new Map(value));
        }
      }

      set({
        currentHistoryIndex: newIndex,
        isViewingPast: newIndex < history.length - 1,
        seqState: clonedSeqState,
      });

      return snapshot;
    }

    return null;
  },

  jumpToCycle: (cycleNumber) => {
    const { history } = get();
    const targetIndex = history.findIndex((s) => s.cycleNumber === cycleNumber);

    if (targetIndex !== -1) {
      const snapshot = history[targetIndex];

      // Clone the sequential state to prevent mutation of snapshot
      const clonedSeqState = {
        currentState: new Map(snapshot.sequentialState.currentState),
        nextState: new Map(snapshot.sequentialState.nextState),
        clocks: new Map(snapshot.sequentialState.clocks),
        cycleCount: snapshot.sequentialState.cycleCount,
      };

      // Deep clone RAM states (Map values)
      for (const [nodeId, value] of snapshot.sequentialState.currentState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.currentState.set(nodeId, new Map(value));
        }
      }
      for (const [nodeId, value] of snapshot.sequentialState.nextState.entries()) {
        if (value instanceof Map) {
          clonedSeqState.nextState.set(nodeId, new Map(value));
        }
      }

      set({
        currentHistoryIndex: targetIndex,
        isViewingPast: targetIndex < history.length - 1,
        seqState: clonedSeqState,
      });

      return snapshot;
    }

    return null;
  },

  clearHistory: () =>
    set({
      history: [],
      currentHistoryIndex: -1,
      isViewingPast: false,
      checkpoints: new Map(),
    }),
}));
