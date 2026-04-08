/**
 * Grammar Handler
 *
 * Returns a summary of the TypeScript builder API.
 */

import { getCircuitAPISummary } from '../types/analysis.js';

export function getGrammarHandler(): string {
  return getCircuitAPISummary();
}
