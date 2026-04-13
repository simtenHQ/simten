/**
 * useLLMContext Hook
 *
 * Builds narrative context from current circuit state for LLM consumption.
 */

import { useMemo } from 'react';
import {
  useAnalysisStore,
  useCircuitLibraryStore,
  useCircuitStore,
} from '@simten/ui/editor/stores';
import type { Circuit } from '@simten/ui/editor/types';
import {
  buildEnvelope,
  type HardwareLLMEnvelope,
} from '@simten/core';
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

export interface LLMContextResult {
  /** Semantic narrative summary (NOT JSON) */
  narrative: string;
  /** Hash of the current code for staleness detection */
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
 * Build LLM context from current circuit state.
 *
 * @param code - Current code from the editor
 * @returns Context for LLM consumption
 */
export function useLLMContext(code: string, portValues?: ReadonlyMap<string, boolean | number>): LLMContextResult {
  const validationResult = useAnalysisStore((state) => state.validationResult);
  const metrics = useAnalysisStore((state) => state.metrics);
  const resolveComponent = useCircuitLibraryStore(
    (state) => state.resolveCircuit
  );
  const getAllPrimitiveNames = useCircuitLibraryStore(
    (state) => state.getAllPrimitiveNames
  );
  const portValuesMap = portValues ?? new Map();
  const circuit = useCircuitStore((state) => state.circuit);

  return useMemo(() => {
    // If no validation result, return minimal context
    if (!validationResult) {
      return {
        narrative: 'No circuit loaded or validation pending.',
        sourceCodeHash: hashSourceCode(code),
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

    // Add harness suggestion if circuit needs one (use already-compiled circuit from store)
    const harnessSuggestion = formatHarnessSuggestion(circuit);
    if (harnessSuggestion) {
      narrative += '\n\n' + harnessSuggestion;
    }

    // Add current port values if available (live simulation state)
    if (portValuesMap.size > 0) {
      narrative += '\n' + formatCurrentPortValues(portValuesMap as Map<string, boolean | number>);
    }

    // Enforce token budget
    narrative = enforceTokenBudget(narrative);

    return {
      narrative,
      sourceCodeHash: hashSourceCode(code),
      isValid: validationResult.valid,
      canSimulate: validationResult.canSimulate,
      envelope,
    };
  }, [
    code,
    validationResult,
    metrics,
    resolveComponent,
    getAllPrimitiveNames,
    portValuesMap,
    circuit,
  ]);
}


// ============================================================================
// Utility: Build Context Without Hook
// ============================================================================

/**
 * Build LLM context imperatively (for use outside React components).
 */
export function buildLLMContext(
  code: string,
  validationResult: NonNullable<
    ReturnType<typeof useAnalysisStore.getState>['validationResult']
  >,
  metrics: ReturnType<typeof useAnalysisStore.getState>['metrics'],
  library: Parameters<typeof buildEnvelope>[0]['library']
): LLMContextResult {
  const envelope = buildEnvelope({
    validation: validationResult,
    metrics: metrics ?? undefined,
    library,
  });

  let narrative = buildNarrativeSummary(envelope);
  narrative = enforceTokenBudget(narrative);

  return {
    narrative,
    sourceCodeHash: hashSourceCode(code),
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
