/**
 * Token Counter
 *
 * Approximate token counting for context budget management.
 *
 * Note: This is an approximation. For production use with strict
 * token limits, consider using a proper tokenizer like tiktoken.
 * For our use case (staying under a generous budget), approximation is fine.
 */

import { TOKEN_BUDGET } from '../constants';

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Approximate token count for text.
 *
 * This uses a simple heuristic based on typical tokenization patterns:
 * - Average of ~4 characters per token for English text
 * - Code tends to have smaller tokens (~3 chars per token)
 * - JSON has more special characters (~3.5 chars per token)
 *
 * We use a conservative estimate of 3 chars per token to avoid
 * accidentally exceeding the budget.
 */
export function countTokens(text: string): number {
  // Simple heuristic: ~3 characters per token (conservative)
  // This accounts for:
  // - Whitespace being its own tokens
  // - Code symbols being individual tokens
  // - Short common words being single tokens
  const CHARS_PER_TOKEN = 3;

  // Count actual content (excluding excessive whitespace)
  const normalized = text.replace(/\s+/g, ' ').trim();

  return Math.ceil(normalized.length / CHARS_PER_TOKEN);
}

/**
 * Check if text is under the token budget.
 */
export function isUnderBudget(text: string): boolean {
  return countTokens(text) <= TOKEN_BUDGET.MAX_CONTEXT_TOKENS;
}

/**
 * Get remaining token budget for text.
 */
export function remainingBudget(text: string): number {
  return Math.max(0, TOKEN_BUDGET.MAX_CONTEXT_TOKENS - countTokens(text));
}

// ============================================================================
// Budget Enforcement
// ============================================================================

/**
 * Progressively simplify narrative until under budget.
 *
 * Strategy:
 * 1. Truncate oldest simulation cycles
 * 2. Remove info-level diagnostics
 * 3. Remove suggestions
 * 4. Truncate component lists
 * 5. Final truncation if still over budget
 */
export function enforceTokenBudget(narrative: string): string {
  let current = narrative;

  // While over budget, progressively simplify
  let iterations = 0;
  const maxIterations = 100; // Safety limit

  while (!isUnderBudget(current) && iterations < maxIterations) {
    iterations++;

    // Strategy 1: Truncate oldest simulation cycles
    const cycleMatch = current.match(/\s+Cycle \d+:.*\n/);
    if (cycleMatch) {
      current = current.replace(/\s+Cycle \d+:.*\n/, '\n');
      continue;
    }

    // Strategy 2: Remove info-level diagnostics
    const infoMatch = current.match(/- \[INFO\].*\n/i);
    if (infoMatch) {
      current = current.replace(/- \[INFO\].*\n/gi, '');
      continue;
    }

    // Strategy 3: Remove suggestion lines
    const suggestionMatch = current.match(/\s+Suggestion:.*\n/);
    if (suggestionMatch) {
      current = current.replace(/\s+Suggestion:.*\n/g, '\n');
      continue;
    }

    // Strategy 4: Truncate "(+N more...)" sections
    const moreMatch = current.match(/\s+\(\+\d+ more.*\)\n/);
    if (moreMatch) {
      current = current.replace(/\s+\(\+\d+ more.*\)\n/g, '\n');
      continue;
    }

    // Strategy 5: Remove behavioral insights section
    if (current.includes('## Behavioral Insights')) {
      current = current.replace(
        /## Behavioral Insights[\s\S]*?(?=##|$)/,
        ''
      );
      continue;
    }

    // Strategy 6: Remove simulation section
    if (current.includes('## Recent Simulation')) {
      current = current.replace(
        /## Recent Simulation[\s\S]*?(?=##|$)/,
        ''
      );
      continue;
    }

    // Strategy 7: Final truncation - just cut from the end
    const budget = TOKEN_BUDGET.MAX_CONTEXT_TOKENS;
    const currentTokens = countTokens(current);
    if (currentTokens > budget) {
      // Estimate how many chars to keep
      const targetChars = Math.floor((budget / currentTokens) * current.length * 0.9);
      current = current.substring(0, targetChars) + '\n\n(Context truncated due to length)';
      break;
    }
  }

  // Clean up multiple blank lines
  current = current.replace(/\n{3,}/g, '\n\n');

  return current.trim();
}

// ============================================================================
// Conversation History Truncation
// ============================================================================

/**
 * Truncate conversation history to fit within a token budget.
 * Keeps most recent messages and trims from the oldest.
 */
export function truncateConversationHistory(
  messages: string[],
  maxTokens: number
): string[] {
  // Start with most recent messages
  const result: string[] = [];
  let totalTokens = 0;

  // Iterate from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = countTokens(messages[i]);
    if (totalTokens + msgTokens <= maxTokens) {
      result.unshift(messages[i]); // Add to front
      totalTokens += msgTokens;
    } else {
      // Can't fit more messages
      break;
    }
  }

  return result;
}
