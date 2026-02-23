/**
 * Test Store - Test Case Management
 *
 * Manages test cases and results using Zustand with Immer.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { TestCase, TestResult, TestState, TestActions } from '../types/testing';

export interface TestStore extends TestState, TestActions {}

const initialState: TestState = {
  testCases: {},
  results: {},
  isRunning: false,
  editingTestId: null,
};

export const useTestStore = create<TestStore>()(
  immer((set, get) => ({
    ...initialState,

    addTestCase: (testCaseData) => {
      const id = nanoid();
      const now = Date.now();

      set((state) => {
        state.testCases[id] = {
          ...testCaseData,
          id,
          createdAt: now,
          updatedAt: now,
        };
      });

      return id;
    },

    updateTestCase: (id, updates) => {
      set((state) => {
        const testCase = state.testCases[id];
        if (testCase) {
          Object.assign(testCase, updates);
          testCase.updatedAt = Date.now();
        }
      });
    },

    removeTestCase: (id) => {
      set((state) => {
        delete state.testCases[id];
        delete state.results[id];
      });
    },

    toggleTestCase: (id) => {
      set((state) => {
        const testCase = state.testCases[id];
        if (testCase) {
          testCase.enabled = !testCase.enabled;
          testCase.updatedAt = Date.now();
        }
      });
    },

    duplicateTestCase: (id) => {
      const originalTest = get().testCases[id];
      if (!originalTest) {
        return '';
      }

      const newId = nanoid();
      const now = Date.now();

      set((state) => {
        state.testCases[newId] = {
          ...originalTest,
          id: newId,
          name: `${originalTest.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
        };
      });

      return newId;
    },

    setTestResult: (testCaseId, result) => {
      set((state) => {
        state.results[testCaseId] = result;
      });
    },

    clearResults: () => {
      set((state) => {
        state.results = {};
      });
    },

    setIsRunning: (isRunning) => {
      set((state) => {
        state.isRunning = isRunning;
      });
    },

    setEditingTestId: (id) => {
      set((state) => {
        state.editingTestId = id;
      });
    },
  }))
);
