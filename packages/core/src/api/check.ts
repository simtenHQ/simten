/**
 * Check Circuit Handler
 *
 * Validates TypeScript circuit source code by executing it.
 */

import type { CircuitLibrary } from '../types/circuit.js';
import { compileSource } from './compile-source.js';

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
  _library?: CircuitLibrary,
): CheckResult {
  const compiled = compileSource(params.source, params.sourceName);

  if (compiled.error) {
    return {
      valid: false,
      canSimulate: false,
      diagnostics: [
        {
          phase: 'compilation',
          code: 'compile-error',
          severity: 'error',
          message: compiled.error,
        },
      ],
      analysis: {
        circuitsDefined: [],
        componentsUsed: [],
        unresolvedReferences: [],
      },
    };
  }

  const circuitsDefined = compiled.circuits.map((c) => c.name);
  const componentsUsed = new Set<string>();
  for (const circuit of compiled.circuits) {
    for (const node of circuit.nodes) {
      componentsUsed.add(node.componentRef);
    }
  }

  return {
    valid: true,
    canSimulate: true,
    diagnostics: [],
    analysis: {
      circuitsDefined,
      componentsUsed: Array.from(componentsUsed),
      unresolvedReferences: [],
    },
  };
}
