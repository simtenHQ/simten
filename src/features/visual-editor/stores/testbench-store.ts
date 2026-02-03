/**
 * Testbench Store
 *
 * State management for testbench loading and execution.
 *
 * Responsibilities:
 * - Track loaded testbench
 * - Manage execution state (running, paused, completed)
 * - Provide current stimulus for each cycle
 * - Track test results and assertions
 * - Manage VCD capture data
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  Testbench,
  TestbenchState,
  AssertionResult,
  CaptureData,
  getStimulusActions,
  StimulusAction,
  createTestbenchState,
} from '../types/testbench';
import { writeVCDToFile } from '../lib/vcd-generator';

// ============================================================================
// Store State
// ============================================================================

interface TestbenchStoreState {
  // Loaded testbench
  testbench: Testbench | null;

  // Execution state
  executionState: TestbenchState | null;

  // Simulation control
  isRunning: boolean;
  isPaused: boolean;
}

// ============================================================================
// Store Actions
// ============================================================================

interface TestbenchStoreActions {
  // Testbench loading
  loadTestbench: (testbench: Testbench) => void;
  clearTestbench: () => void;

  // Execution control
  startExecution: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  stopExecution: () => void;
  resetExecution: () => void;

  // Cycle management
  getCurrentStimulus: () => StimulusAction[];
  advanceCycle: () => void;

  // Results tracking
  addAssertionResult: (result: AssertionResult) => void;
  setTestStatus: (status: 'running' | 'passed' | 'failed' | 'timeout', reason?: string) => void;

  // VCD capture
  setCaptureData: (data: CaptureData) => void;
  exportVCD: () => void;

  // Getters
  getCurrentCycle: () => number;
  getMaxCycles: () => number;
  getTestStatus: () => 'idle' | 'running' | 'passed' | 'failed' | 'timeout';
  getProgress: () => number; // 0-100
}

export type TestbenchStore = TestbenchStoreState & TestbenchStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const initialState: TestbenchStoreState = {
  testbench: null,
  executionState: null,
  isRunning: false,
  isPaused: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useTestbenchStore = create<TestbenchStore>()(
  immer((set, get) => ({
    ...initialState,

    // ========================================================================
    // Testbench Loading
    // ========================================================================

    loadTestbench: (testbench: Testbench) => {
      set((state) => {
        state.testbench = testbench;
        state.executionState = createTestbenchState();
        state.isRunning = false;
        state.isPaused = false;
      });
    },

    clearTestbench: () => {
      set((state) => {
        state.testbench = null;
        state.executionState = null;
        state.isRunning = false;
        state.isPaused = false;
      });
    },

    // ========================================================================
    // Execution Control
    // ========================================================================

    startExecution: () => {
      set((state) => {
        if (state.testbench) {
          state.executionState = createTestbenchState();
          state.isRunning = true;
          state.isPaused = false;
        }
      });
    },

    pauseExecution: () => {
      set((state) => {
        state.isPaused = true;
      });
    },

    resumeExecution: () => {
      set((state) => {
        state.isPaused = false;
      });
    },

    stopExecution: () => {
      set((state) => {
        state.isRunning = false;
        state.isPaused = false;
      });
    },

    resetExecution: () => {
      set((state) => {
        if (state.testbench) {
          state.executionState = createTestbenchState();
          state.isRunning = false;
          state.isPaused = false;
        }
      });
    },

    // ========================================================================
    // Cycle Management
    // ========================================================================

    getCurrentStimulus: (): StimulusAction[] => {
      const { testbench, executionState } = get();
      if (!testbench || !executionState) {
        return [];
      }

      return getStimulusActions(testbench.stimulus, executionState.cycle);
    },

    advanceCycle: () => {
      set((state) => {
        if (state.executionState) {
          state.executionState.cycle++;

          // Check if we've reached max cycles
          if (state.testbench && state.executionState.cycle >= state.testbench.maxCycles) {
            state.isRunning = false;
            if (state.executionState.status === 'running') {
              state.executionState.status = 'timeout';
              state.executionState.failureReason = 'Maximum cycles reached';
            }
          }
        }
      });
    },

    // ========================================================================
    // Results Tracking
    // ========================================================================

    addAssertionResult: (result: AssertionResult) => {
      set((state) => {
        if (state.executionState) {
          state.executionState.assertionResults.push(result);

          // If assertion failed, stop execution
          if (!result.passed) {
            state.executionState.status = 'failed';
            state.executionState.failureReason = result.message;
            state.isRunning = false;
          }
        }
      });
    },

    setTestStatus: (status: 'running' | 'passed' | 'failed' | 'timeout', reason?: string) => {
      set((state) => {
        if (state.executionState) {
          state.executionState.status = status;
          state.executionState.failureReason = reason;

          // Stop execution if test completed
          if (status !== 'running') {
            state.isRunning = false;
          }
        }
      });
    },

    // ========================================================================
    // VCD Capture
    // ========================================================================

    setCaptureData: (data: CaptureData) => {
      set((state) => {
        if (state.executionState) {
          state.executionState.captureData = data;
        }
      });
    },

    exportVCD: () => {
      const { executionState, testbench } = get();

      if (!executionState?.captureData || !testbench?.capture) {
        console.warn('No capture data available for VCD export');
        return;
      }

      try {
        writeVCDToFile(executionState.captureData, testbench.capture.filename);
      } catch (error) {
        console.error('Failed to export VCD:', error);
      }
    },

    // ========================================================================
    // Getters
    // ========================================================================

    getCurrentCycle: (): number => {
      return get().executionState?.cycle || 0;
    },

    getMaxCycles: (): number => {
      return get().testbench?.maxCycles || 0;
    },

    getTestStatus: (): 'idle' | 'running' | 'passed' | 'failed' | 'timeout' => {
      const { executionState } = get();

      if (!executionState) {
        return 'idle';
      }

      return executionState.status;
    },

    getProgress: (): number => {
      const { executionState, testbench } = get();

      if (!executionState || !testbench) {
        return 0;
      }

      if (testbench.maxCycles === 0) {
        return 0;
      }

      return Math.min(100, (executionState.cycle / testbench.maxCycles) * 100);
    },
  }))
);
