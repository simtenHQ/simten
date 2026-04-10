/**
 * Grammar Handler
 *
 * Returns a summary of the circuit() API.
 */

import { getCircuitAPISummary } from '../types/analysis.js';

export function getGrammarHandler(): string {
  return getCircuitAPISummary();
}
