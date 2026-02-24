/**
 * Analysis Store - Circuit Analysis State Management
 *
 * Stores validation results, circuit metrics, and diagnostics
 * from the validation/analysis pipeline.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ValidationResult, CircuitMetrics, Diagnostic } from '@turing-incomplete/core/dsl';

interface AnalysisState {
  // Validation results
  validationResult: ValidationResult | null;

  // Circuit metrics (per circuit)
  metrics: CircuitMetrics | null;

  // Combined diagnostics (validation + structural + behavioral)
  allDiagnostics: Diagnostic[];

  // UI state
  isAnalyzing: boolean;
  lastAnalyzedAt: number | null;
}

interface AnalysisActions {
  setValidationResult: (result: ValidationResult) => void;
  setMetrics: (metrics: CircuitMetrics | null) => void;
  setDiagnostics: (diagnostics: Diagnostic[]) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  clear: () => void;
}

export interface AnalysisStore extends AnalysisState, AnalysisActions {}

const initialState: AnalysisState = {
  validationResult: null,
  metrics: null,
  allDiagnostics: [],
  isAnalyzing: false,
  lastAnalyzedAt: null,
};

export const useAnalysisStore = create<AnalysisStore>()(
  immer((set) => ({
    ...initialState,

    setValidationResult: (result) => {
      set((state) => {
        state.validationResult = result;
        state.allDiagnostics = result.diagnostics;
        state.lastAnalyzedAt = Date.now();
      });
    },

    setMetrics: (metrics) => {
      set((state) => {
        state.metrics = metrics;
      });
    },

    setDiagnostics: (diagnostics) => {
      set((state) => {
        state.allDiagnostics = diagnostics;
      });
    },

    setAnalyzing: (isAnalyzing) => {
      set((state) => {
        state.isAnalyzing = isAnalyzing;
      });
    },

    clear: () => {
      set(() => initialState);
    },
  }))
);
