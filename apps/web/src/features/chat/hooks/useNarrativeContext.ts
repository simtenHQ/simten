/**
 * useNarrativeContext Hook
 *
 * Builds narrative context from current circuit state for LLM consumption.
 */

import { useMemo } from 'react';
import {
  useAnalysisStore,
  useComponentLibraryStore,
  usePortValuesStore,
  useCircuitStore,
} from '@turing-incomplete/ui/editor';
import type { Circuit } from '@turing-incomplete/ui/editor';
import {
  buildEnvelope,
  type HardwareLLMEnvelope,
} from '@/features/dsl';
import {
  buildNarrativeSummary,
  formatCurrentPortValues,
  formatHarnessSuggestion,
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
  const portValues = usePortValuesStore((state) => state.portValues);
  const circuit = useCircuitStore((state) => state.circuit);

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

    // Add current INPUT node settings (Switch, Button, Input values)
    if (circuit) {
      const inputSettings = formatInputSettings(circuit);
      if (inputSettings) {
        narrative += '\n' + inputSettings;
      }
    }

    // Add harness suggestion if circuit needs one
    const harnessSuggestion = formatHarnessSuggestion(dslCode);
    if (harnessSuggestion) {
      narrative += '\n\n' + harnessSuggestion;
    }

    // Add current port values if available (live simulation state)
    if (portValues.size > 0) {
      narrative += '\n' + formatCurrentPortValues(portValues);
    }

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
    portValues,
    circuit,
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

/**
 * Format current input node settings (Switch, Button, Input values).
 * This shows the CONFIGURED values, not simulation outputs.
 */
function formatInputSettings(circuit: Circuit): string | null {
  const inputNodes = circuit.nodes.filter(node => {
    // Match input-type components by their componentRef
    const ref = node.componentRef.toLowerCase();
    return ref === 'input' || ref === 'switch' || ref === 'button';
  });

  if (inputNodes.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push('## Current Input Settings');
  lines.push('These are the current values of input nodes. Do NOT use SET_INPUT if the value is already correct.');
  lines.push('');

  for (const node of inputNodes) {
    // Extract short label from full ID (e.g., "SnakeAdvanced_keyboard_123_abc" -> "keyboard")
    const parts = node.id.split('_');
    const label = parts.length >= 2 ? parts[1] : node.id;
    const value = node.arguments?.value ?? 0;
    lines.push(`- **${label}** (${node.componentRef}): value = ${value}`);
  }

  return lines.join('\n');
}
