/**
 * useNarrativeContext Hook
 *
 * Builds narrative context from current circuit state for LLM consumption.
 */

import { useMemo } from 'react';
import { useAnalysisStore } from '@/features/visual-editor/stores/analysis-store';
import { useComponentLibraryStore } from '@/features/visual-editor/stores/component-library-store';
import {
  buildEnvelope,
  type HardwareLLMEnvelope,
} from '@/features/dsl';
import {
  buildNarrativeSummary,
  enforceTokenBudget,
} from '../context';
import { hashSourceCode } from '../actions/action-normalizer';

// ============================================================================
// Hook Interface
// ============================================================================

export interface NarrativeContextResult {
  /** Semantic narrative summary (NOT JSON) */
  narrative: string;
  /** Hash of the current DSL code for staleness detection */
  sourceCodeHash: string;
  /** Whether the circuit is valid */
  isValid: boolean;
  /** Whether the circuit can be simulated */
  canSimulate: boolean;
  /** The full envelope (for internal use) */
  envelope: HardwareLLMEnvelope | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Build narrative context from current circuit state.
 *
 * @param dslCode - Current DSL code from the editor
 * @returns Narrative context for LLM consumption
 */
export function useNarrativeContext(dslCode: string): NarrativeContextResult {
  const validationResult = useAnalysisStore((state) => state.validationResult);
  const metrics = useAnalysisStore((state) => state.metrics);
  const resolveComponent = useComponentLibraryStore(
    (state) => state.resolveComponent
  );
  const getAllPrimitiveNames = useComponentLibraryStore(
    (state) => state.getAllPrimitiveNames
  );

  return useMemo(() => {
    // If no validation result, return minimal context
    if (!validationResult) {
      return {
        narrative: 'No circuit loaded or validation pending.',
        sourceCodeHash: hashSourceCode(dslCode),
        isValid: false,
        canSimulate: false,
        envelope: null,
      };
    }

    // Build component library adapter
    const library = {
      resolveComponent,
      getAllPrimitiveNames,
    };

    // Build the envelope
    const envelope = buildEnvelope({
      validation: validationResult,
      metrics: metrics ?? undefined,
      library,
    });

    // Build narrative summary
    let narrative = buildNarrativeSummary(envelope);

    // Enforce token budget
    narrative = enforceTokenBudget(narrative);

    return {
      narrative,
      sourceCodeHash: hashSourceCode(dslCode),
      isValid: validationResult.valid,
      canSimulate: validationResult.canSimulate,
      envelope,
    };
  }, [
    dslCode,
    validationResult,
    metrics,
    resolveComponent,
    getAllPrimitiveNames,
  ]);
}

// ============================================================================
// Utility: Build Context Without Hook
// ============================================================================

/**
 * Build narrative context imperatively (for use outside React components).
 */
export function buildNarrativeContext(
  dslCode: string,
  validationResult: NonNullable<
    ReturnType<typeof useAnalysisStore.getState>['validationResult']
  >,
  metrics: ReturnType<typeof useAnalysisStore.getState>['metrics'],
  library: Parameters<typeof buildEnvelope>[0]['library']
): NarrativeContextResult {
  const envelope = buildEnvelope({
    validation: validationResult,
    metrics: metrics ?? undefined,
    library,
  });

  let narrative = buildNarrativeSummary(envelope);
  narrative = enforceTokenBudget(narrative);

  return {
    narrative,
    sourceCodeHash: hashSourceCode(dslCode),
    isValid: validationResult.valid,
    canSimulate: validationResult.canSimulate,
    envelope,
  };
}
