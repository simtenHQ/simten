/**
 * Grammar Handler
 *
 * Pure function to return DSL grammar summary.
 */

import { getGrammarSummary } from '@turing-incomplete/core/dsl';

export function getGrammarHandler(): string {
  return getGrammarSummary();
}
