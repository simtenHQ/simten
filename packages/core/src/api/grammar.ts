/**
 * Grammar Handler
 *
 * Returns a summary of the TypeScript builder API.
 */

import { getBuilderAPISummary } from '../types/analysis.js';

export function getGrammarHandler(): string {
  return getBuilderAPISummary();
}
