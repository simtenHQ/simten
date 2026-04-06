/**
 * Diff Validator
 *
 * SHOW_DIFF specific guardrails to prevent:
 * - Nonsense suggestions (must parse)
 * - Unexplained changes (must explain)
 * - Massive rewrites (bounded scope)
 */

import { DIFF_GUARDRAILS } from '../constants';
import type { ValidationResult } from '../types';
import type { ShowDiffAction } from '../types';
import { executeCircuitCode } from '@turing-incomplete/core';

// ============================================================================
// Line Counting
// ============================================================================

/**
 * Count the number of changed lines between original and suggested code.
 * Uses a simple line-by-line diff approach.
 */
export function countChangedLines(original: string, suggested: string): number {
  const originalLines = original.split('\n');
  const suggestedLines = suggested.split('\n');

  // Count lines that are different
  let changedCount = 0;

  // Count additions (lines in suggested but not in original)
  const originalSet = new Set(originalLines);
  for (const line of suggestedLines) {
    if (!originalSet.has(line)) {
      changedCount++;
    }
  }

  // Count deletions (lines in original but not in suggested)
  const suggestedSet = new Set(suggestedLines);
  for (const line of originalLines) {
    if (!suggestedSet.has(line)) {
      changedCount++;
    }
  }

  return changedCount;
}

// ============================================================================
// SHOW_DIFF Validation
// ============================================================================

/**
 * Validate a SHOW_DIFF action against guardrails.
 */
export function validateShowDiff(action: ShowDiffAction): ValidationResult {
  // Guard 1: Require non-empty explanation
  if (DIFF_GUARDRAILS.REQUIRE_EXPLANATION) {
    if (!action.explanation?.trim()) {
      return {
        valid: false,
        reason: 'Explanation required for code changes',
      };
    }
  }

  // Guard 2: Check diff size in bytes
  const diffSizeBytes =
    action.originalCode.length + action.suggestedCode.length;
  if (diffSizeBytes > DIFF_GUARDRAILS.MAX_DIFF_SIZE_BYTES) {
    return {
      valid: false,
      reason: `Diff too large: ${diffSizeBytes} bytes (max ${DIFF_GUARDRAILS.MAX_DIFF_SIZE_BYTES})`,
    };
  }

  // Guard 3: Check number of changed lines
  const changedLines = countChangedLines(
    action.originalCode,
    action.suggestedCode
  );
  if (changedLines > DIFF_GUARDRAILS.MAX_CHANGED_LINES) {
    return {
      valid: false,
      reason: `Diff too large: ${changedLines} lines changed (max ${DIFF_GUARDRAILS.MAX_CHANGED_LINES})`,
    };
  }

  // Guard 4: Verify suggested code compiles
  if (DIFF_GUARDRAILS.REQUIRE_VALID_SYNTAX) {
    const result = executeCircuitCode(action.suggestedCode);

    if (result.error) {
      return {
        valid: false,
        reason: 'Suggested code has errors',
        errors: [{ message: result.error, line: 1 }],
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Diff Preview Helpers
// ============================================================================

/**
 * Generate a simple text diff for preview.
 * Returns lines with + (added), - (removed), or space (unchanged) prefixes.
 */
export function generateSimpleDiff(original: string, suggested: string): string {
  const originalLines = original.split('\n');
  const suggestedLines = suggested.split('\n');
  const result: string[] = [];

  // Find common prefix
  let commonStart = 0;
  while (
    commonStart < originalLines.length &&
    commonStart < suggestedLines.length &&
    originalLines[commonStart] === suggestedLines[commonStart]
  ) {
    result.push(`  ${originalLines[commonStart]}`);
    commonStart++;
  }

  // Find common suffix
  let commonEndOrig = originalLines.length - 1;
  let commonEndSugg = suggestedLines.length - 1;
  while (
    commonEndOrig >= commonStart &&
    commonEndSugg >= commonStart &&
    originalLines[commonEndOrig] === suggestedLines[commonEndSugg]
  ) {
    commonEndOrig--;
    commonEndSugg--;
  }

  // Mark deleted lines
  for (let i = commonStart; i <= commonEndOrig; i++) {
    result.push(`- ${originalLines[i]}`);
  }

  // Mark added lines
  for (let i = commonStart; i <= commonEndSugg; i++) {
    result.push(`+ ${suggestedLines[i]}`);
  }

  // Add common suffix
  for (let i = commonEndOrig + 1; i < originalLines.length; i++) {
    result.push(`  ${originalLines[i]}`);
  }

  return result.join('\n');
}

/**
 * Get a summary of the diff for display.
 */
export function getDiffSummary(original: string, suggested: string): {
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
} {
  const originalLines = original.split('\n');
  const suggestedLines = suggested.split('\n');

  const originalSet = new Set(originalLines);
  const suggestedSet = new Set(suggestedLines);

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of suggestedLines) {
    if (!originalSet.has(line)) {
      linesAdded++;
    }
  }

  for (const line of originalLines) {
    if (!suggestedSet.has(line)) {
      linesRemoved++;
    }
  }

  return {
    linesAdded,
    linesRemoved,
    linesChanged: linesAdded + linesRemoved,
  };
}
