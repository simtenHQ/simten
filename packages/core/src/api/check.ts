/**
 * Check Circuit Handler
 *
 * Pure function to validate DSL source code.
 * Accepts already-resolved source string, returns typed result.
 */

import {
  validateCircuit,
  createDefaultValidationContext,
  formatForLLM,
} from '../dsl/index.js';
import type { ComponentLibrary } from '../types/circuit.js';

export interface CheckResult {
  valid: boolean;
  canSimulate: boolean;
  diagnostics: Array<{
    phase: string;
    code: string;
    severity: string;
    message: string;
    line?: number;
    column?: number;
    suggestions?: string[];
    involvedNodes?: string[];
  }>;
  analysis: {
    circuitsDefined: string[];
    componentsUsed: string[];
    unresolvedReferences: string[];
  };
}

export function checkCircuit(
  params: { source: string; sourceName?: string },
  library: ComponentLibrary
): CheckResult {
  const sourceName = params.sourceName ?? '<inline>';
  const context = createDefaultValidationContext(library, sourceName);
  const result = validateCircuit(params.source, context);
  const llm = formatForLLM(result, {
    includeGrammar: false,
    includeComponents: false,
  });

  return {
    valid: result.valid,
    canSimulate: result.canSimulate,
    diagnostics: llm.diagnostics,
    analysis: llm.analysis,
  };
}
