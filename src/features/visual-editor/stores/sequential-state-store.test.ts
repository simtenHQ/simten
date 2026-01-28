import { describe, it, expect, beforeEach } from 'vitest';
import { useSequentialStateStore } from './sequential-state-store';
import type { SequentialState } from '../lib/simulator-v0.1';
import type { SimulationSnapshot } from '../types/simulation-snapshot';

describe('sequential-state-store history management', () => {
  beforeEach(() => {
    // Reset store before each test
    useSequentialStateStore.setState({
      seqState: undefined,
      history: [],
      currentHistoryIndex: -1,
      isViewingPast: false,
      checkpoints: new Map(),
    });
  });

  const createTestSnapshot = (cycleNumber: number): SimulationSnapshot => {
    const seqState: SequentialState = {
      currentState: new Map([['counter', cycleNumber]]),
      nextState: new Map([['counter', cycleNumber + 1]]),
      clocks: new Map([['clk', { value: true, edge: 'rising' }]]),
      cycleCount: cycleNumber,
    };

    return {
      sequentialState: seqState,
      environmentalState: new Map([['switch1', cycleNumber % 2 === 0]]), // Alternate true/false
      cycleNumber,
      timestamp: Date.now(),
    };
  };

  describe('saveSnapshot', () => {
    it('should save snapshot to history', () => {
      const snapshot = createTestSnapshot(0);
      useSequentialStateStore.getState().saveSnapshot(snapshot);

      const { history } = useSequentialStateStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].cycleNumber).toBe(0);
    });

    it('should save multiple snapshots sequentially', () => {
      const { saveSnapshot } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      const { history } = useSequentialStateStore.getState();
      expect(history).toHaveLength(3);
      expect(history[0].cycleNumber).toBe(0);
      expect(history[1].cycleNumber).toBe(1);
      expect(history[2].cycleNumber).toBe(2);
    });

    it('should update currentHistoryIndex to latest', () => {
      const { saveSnapshot } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      const { currentHistoryIndex } = useSequentialStateStore.getState();
      expect(currentHistoryIndex).toBe(1); // Index of latest snapshot
    });

    it('should set isViewingPast to false after save', () => {
      const { saveSnapshot } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));

      const { isViewingPast } = useSequentialStateStore.getState();
      expect(isViewingPast).toBe(false);
    });

    it('should enforce ring buffer limit (maxHistorySize)', () => {
      const { saveSnapshot } = useSequentialStateStore.getState();
      const maxSize = useSequentialStateStore.getState().maxHistorySize;

      // Save more snapshots than max size
      for (let i = 0; i < maxSize + 10; i++) {
        saveSnapshot(createTestSnapshot(i));
      }

      const { history } = useSequentialStateStore.getState();
      expect(history.length).toBeLessThanOrEqual(maxSize);

      // Should keep most recent snapshots
      expect(history[history.length - 1].cycleNumber).toBe(maxSize + 9);
    });

    it('should create checkpoints at regular intervals', () => {
      const { saveSnapshot, checkpointInterval } = useSequentialStateStore.getState();

      // Save snapshots at checkpoint intervals
      saveSnapshot(createTestSnapshot(0)); // Checkpoint at 0
      saveSnapshot(createTestSnapshot(100)); // Checkpoint at 100
      saveSnapshot(createTestSnapshot(200)); // Checkpoint at 200
      saveSnapshot(createTestSnapshot(150)); // No checkpoint (not at interval)

      const { checkpoints } = useSequentialStateStore.getState();
      expect(checkpoints.has(0)).toBe(true);
      expect(checkpoints.has(100)).toBe(true);
      expect(checkpoints.has(200)).toBe(true);
      expect(checkpoints.has(150)).toBe(false);
    });

    it('should trim future history when resuming from past (timeline branching)', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      // Create history: 0 -> 1 -> 2 -> 3
      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));
      saveSnapshot(createTestSnapshot(3));

      // Step back to cycle 1
      stepBack(); // 3 -> 2
      stepBack(); // 2 -> 1

      expect(useSequentialStateStore.getState().isViewingPast).toBe(true);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(1);

      // Save new snapshot (should create new timeline)
      saveSnapshot(createTestSnapshot(10));

      const { history } = useSequentialStateStore.getState();

      // History should be: 0, 1, 10 (cycles 2 and 3 trimmed)
      expect(history).toHaveLength(3);
      expect(history[0].cycleNumber).toBe(0);
      expect(history[1].cycleNumber).toBe(1);
      expect(history[2].cycleNumber).toBe(10);
      expect(useSequentialStateStore.getState().isViewingPast).toBe(false);
    });
  });

  describe('stepBack', () => {
    it('should move backward one snapshot', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      const snapshot = stepBack();

      expect(snapshot).not.toBeNull();
      expect(snapshot?.cycleNumber).toBe(1);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(1);
    });

    it('should set isViewingPast to true', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      stepBack();

      expect(useSequentialStateStore.getState().isViewingPast).toBe(true);
    });

    it('should update seqState in store', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      stepBack();

      const { seqState } = useSequentialStateStore.getState();
      expect(seqState?.cycleCount).toBe(0);
      expect(seqState?.currentState.get('counter')).toBe(0);
    });

    it('should return null when at beginning of history', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));

      const snapshot = stepBack();

      expect(snapshot).toBeNull();
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(0);
    });

    it('should handle multiple stepBack calls', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));
      saveSnapshot(createTestSnapshot(3));

      stepBack(); // 3 -> 2
      stepBack(); // 2 -> 1
      const snapshot = stepBack(); // 1 -> 0

      expect(snapshot?.cycleNumber).toBe(0);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(0);
    });
  });

  describe('stepForward', () => {
    it('should move forward one snapshot', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      stepBack(); // Move to cycle 1
      const snapshot = stepForward(); // Move to cycle 2

      expect(snapshot).not.toBeNull();
      expect(snapshot?.cycleNumber).toBe(2);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(2);
    });

    it('should set isViewingPast to false when reaching end', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      stepBack(); // View past
      stepForward(); // Back to present

      expect(useSequentialStateStore.getState().isViewingPast).toBe(false);
    });

    it('should keep isViewingPast true when not at end', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      stepBack(); // 2 -> 1
      stepBack(); // 1 -> 0
      stepForward(); // 0 -> 1

      expect(useSequentialStateStore.getState().isViewingPast).toBe(true);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(1);
    });

    it('should update seqState in store', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      stepBack();
      stepForward();

      const { seqState } = useSequentialStateStore.getState();
      expect(seqState?.cycleCount).toBe(1);
      expect(seqState?.currentState.get('counter')).toBe(1);
    });

    it('should return null when at end of history', () => {
      const { saveSnapshot, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));

      const snapshot = stepForward();

      expect(snapshot).toBeNull();
    });

    it('should handle multiple stepForward calls', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));
      saveSnapshot(createTestSnapshot(3));

      stepBack(); // 3 -> 2
      stepBack(); // 2 -> 1
      stepBack(); // 1 -> 0

      stepForward(); // 0 -> 1
      stepForward(); // 1 -> 2
      const snapshot = stepForward(); // 2 -> 3

      expect(snapshot?.cycleNumber).toBe(3);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(3);
    });
  });

  describe('jumpToCycle', () => {
    it('should jump to specific cycle number', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));
      saveSnapshot(createTestSnapshot(3));

      const snapshot = jumpToCycle(1);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.cycleNumber).toBe(1);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(1);
    });

    it('should set isViewingPast correctly when not at end', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      jumpToCycle(1);

      expect(useSequentialStateStore.getState().isViewingPast).toBe(true);
    });

    it('should set isViewingPast to false when jumping to latest', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      jumpToCycle(2);

      expect(useSequentialStateStore.getState().isViewingPast).toBe(false);
    });

    it('should update seqState in store', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(5));
      saveSnapshot(createTestSnapshot(10));

      jumpToCycle(5);

      const { seqState } = useSequentialStateStore.getState();
      expect(seqState?.cycleCount).toBe(5);
      expect(seqState?.currentState.get('counter')).toBe(5);
    });

    it('should return null for non-existent cycle', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));

      const snapshot = jumpToCycle(99);

      expect(snapshot).toBeNull();
    });

    it('should handle jumping to first cycle', () => {
      const { saveSnapshot, jumpToCycle } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      const snapshot = jumpToCycle(0);

      expect(snapshot?.cycleNumber).toBe(0);
      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const { saveSnapshot, clearHistory } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));

      clearHistory();

      const { history } = useSequentialStateStore.getState();
      expect(history).toHaveLength(0);
    });

    it('should reset currentHistoryIndex', () => {
      const { saveSnapshot, clearHistory } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      clearHistory();

      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(-1);
    });

    it('should reset isViewingPast', () => {
      const { saveSnapshot, stepBack, clearHistory } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      stepBack();

      expect(useSequentialStateStore.getState().isViewingPast).toBe(true);

      clearHistory();

      expect(useSequentialStateStore.getState().isViewingPast).toBe(false);
    });

    it('should clear checkpoints', () => {
      const { saveSnapshot, clearHistory } = useSequentialStateStore.getState();

      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(100));

      expect(useSequentialStateStore.getState().checkpoints.size).toBeGreaterThan(0);

      clearHistory();

      expect(useSequentialStateStore.getState().checkpoints.size).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle forward then backward navigation', () => {
      const { saveSnapshot, stepBack, stepForward } = useSequentialStateStore.getState();

      // Create history
      for (let i = 0; i < 10; i++) {
        saveSnapshot(createTestSnapshot(i));
      }

      // Navigate backward
      stepBack(); // 9 -> 8
      stepBack(); // 8 -> 7
      stepBack(); // 7 -> 6

      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(6);

      // Navigate forward
      stepForward(); // 6 -> 7
      stepForward(); // 7 -> 8

      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(8);
      expect(useSequentialStateStore.getState().isViewingPast).toBe(true); // Still viewing past (not at end)
    });

    it('should handle jump then step navigation', () => {
      const { saveSnapshot, jumpToCycle, stepBack, stepForward } =
        useSequentialStateStore.getState();

      for (let i = 0; i < 10; i++) {
        saveSnapshot(createTestSnapshot(i));
      }

      jumpToCycle(5);
      stepBack(); // 4
      stepForward(); // 5
      stepForward(); // 6

      expect(useSequentialStateStore.getState().currentHistoryIndex).toBe(6);
      expect(useSequentialStateStore.getState().seqState?.cycleCount).toBe(6);
    });

    it('should preserve environmental state in snapshots', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      // Create snapshots with alternating switch values
      saveSnapshot(createTestSnapshot(0)); // switch1 = true (0 % 2 === 0)
      saveSnapshot(createTestSnapshot(1)); // switch1 = false (1 % 2 !== 0)
      saveSnapshot(createTestSnapshot(2)); // switch1 = true (2 % 2 === 0)

      const snapshot = stepBack();

      expect(snapshot?.environmentalState.get('switch1')).toBe(false);
    });

    it('should handle edge case: empty history', () => {
      const { stepBack, stepForward, jumpToCycle } = useSequentialStateStore.getState();

      expect(stepBack()).toBeNull();
      expect(stepForward()).toBeNull();
      expect(jumpToCycle(0)).toBeNull();
    });

    it('should handle timeline branching scenario', () => {
      const { saveSnapshot, stepBack } = useSequentialStateStore.getState();

      // Original timeline: 0 -> 1 -> 2 -> 3
      saveSnapshot(createTestSnapshot(0));
      saveSnapshot(createTestSnapshot(1));
      saveSnapshot(createTestSnapshot(2));
      saveSnapshot(createTestSnapshot(3));

      // Go back to cycle 1
      stepBack();
      stepBack();

      // Create new timeline from cycle 1
      saveSnapshot(createTestSnapshot(10));
      saveSnapshot(createTestSnapshot(11));

      const { history } = useSequentialStateStore.getState();

      // History should be: 0, 1, 10, 11
      expect(history).toHaveLength(4);
      expect(history.map((s) => s.cycleNumber)).toEqual([0, 1, 10, 11]);
    });
  });
});
