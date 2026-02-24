/**
 * Grammar Handler
 *
 * Pure function to return DSL grammar summary.
 */

import { getGrammarSummary } from '../dsl/index.js';

export function getGrammarHandler(): string {
  return getGrammarSummary();
}
