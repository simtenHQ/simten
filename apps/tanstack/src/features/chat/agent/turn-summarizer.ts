/**
 * Turn Summarizer
 *
 * Generates compact summaries of agent turns for turn history.
 * Implements progressive compression for long sessions to stay
 * within token budgets while preserving key information.
 */

import type { AgentTurn } from './types';
import { formatSignalsCompact } from './semantic-signals';

// ============================================================================
// Single Turn Summary
// ============================================================================

/**
 * Generate a compact single-line summary of a turn.
 */
export function summarizeTurn(turn: AgentTurn): string {
  const obs = turn.observation;

  if (!obs) {
    // Reasoning-only turn (no action)
    return `Turn ${turn.turnNumber}: Reasoning only - "${truncate(turn.response.message, 50)}"`;
  }

  // Build summary with action result
  const result = obs.success ? '✓' : '✗';
  const actionType = obs.action.type;
  const errors = `errors: ${obs.validationBefore.errors}→${obs.validationAfter.errors}`;

  // Add signal indicators
  const signalStr = formatSignalsCompact(obs.signals);

  // Build the line
  let line = `Turn ${turn.turnNumber}: ${actionType} ${result} | ${errors}`;

  if (signalStr !== 'OK') {
    line += ` | ${signalStr}`;
  }

  // Add brief reason if failed
  if (!obs.success && obs.error) {
    line += ` | Error: ${truncate(obs.error, 30)}`;
  }

  return line;
}

// ============================================================================
// Turn History Building
// ============================================================================

/**
 * Build turn history with progressive compression for long sessions.
 *
 * Strategy:
 * - Always keep: first turn (original context) + last 3 turns (recent state)
 * - Compress middle turns into a summary
 */
export function buildTurnHistory(turns: AgentTurn[], maxTokens: number): string {
  if (turns.length === 0) {
    return '(No previous turns)';
  }

  if (turns.length <= 5) {
    // Short session - include all turns
    return turns.map(summarizeTurn).join('\n');
  }

  // Long session - use progressive compression
  const lines: string[] = [];

  // First turn (shows original intent)
  lines.push(summarizeTurn(turns[0]));

  // Middle turns (compressed)
  const middleTurns = turns.slice(1, -3);
  if (middleTurns.length > 0) {
    const successCount = middleTurns.filter((t) => t.observation?.success).length;
    const regressionCount = middleTurns.filter(
      (t) => t.observation?.signals.regression?.isRegression
    ).length;

    const middleSummary = `[... ${middleTurns.length} turns: ${successCount} succeeded, ${regressionCount} regressions ...]`;
    lines.push(middleSummary);
  }

  // Last 3 turns (recent context)
  const recentTurns = turns.slice(-3);
  for (const turn of recentTurns) {
    lines.push(summarizeTurn(turn));
  }

  // Check if within token budget (rough estimate: 1 token ≈ 4 chars)
  const result = lines.join('\n');
  const estimatedTokens = Math.ceil(result.length / 4);

  if (estimatedTokens > maxTokens) {
    // Too long - use ultra-compact format
    return buildUltraCompactHistory(turns);
  }

  return result;
}

/**
 * Ultra-compact history for very long sessions.
 */
function buildUltraCompactHistory(turns: AgentTurn[]): string {
  const total = turns.length;
  const successes = turns.filter((t) => t.observation?.success).length;
  const failures = total - successes;
  const regressions = turns.filter(
    (t) => t.observation?.signals.regression?.isRegression
  ).length;

  const lastTurn = turns[turns.length - 1];
  const lastAction = lastTurn.observation?.action.type ?? 'none';
  const lastResult = lastTurn.observation?.success ? '✓' : '✗';

  return `[${total} turns: ${successes} success, ${failures} fail, ${regressions} regressions | Last: ${lastAction} ${lastResult}]`;
}

// ============================================================================
// Detailed Turn Summary
// ============================================================================

/**
 * Generate a detailed multi-line summary of a turn.
 * Used for logging and debugging.
 */
export function summarizeTurnDetailed(turn: AgentTurn): string {
  const lines: string[] = [];
  const obs = turn.observation;

  lines.push(`=== Turn ${turn.turnNumber} ===`);
  lines.push(`Message: ${truncate(turn.response.message, 100)}`);

  if (turn.response.reasoning) {
    lines.push(`Reasoning: ${truncate(turn.response.reasoning, 100)}`);
  }

  if (turn.response.plan && turn.response.plan.length > 0) {
    lines.push(`Plan (${turn.response.plan.length} steps):`);
    for (const step of turn.response.plan.slice(0, 3)) {
      lines.push(`  - ${truncate(step, 50)}`);
    }
    if (turn.response.plan.length > 3) {
      lines.push(`  ... +${turn.response.plan.length - 3} more`);
    }
  }

  if (obs) {
    lines.push(`Action: ${obs.action.type} ${obs.success ? '✓' : '✗'}`);
    lines.push(`Errors: ${obs.validationBefore.errors} → ${obs.validationAfter.errors}`);

    if (obs.signals.regression.isRegression) {
      lines.push(`REGRESSION: ${obs.signals.regression.severity}`);
    }

    if (obs.signals.behavioral.failed > 0) {
      lines.push(`BEHAVIORAL FAILED: ${obs.signals.behavioral.failed} check(s)`);
    }

    if (!obs.success && obs.error) {
      lines.push(`Error: ${obs.error}`);
    }
  } else {
    lines.push('(No action executed)');
  }

  lines.push(`Done: ${turn.response.done}`);

  return lines.join('\n');
}

// ============================================================================
// History Statistics
// ============================================================================

/**
 * Extract statistics from turn history.
 */
export function getTurnStatistics(turns: AgentTurn[]): {
  totalTurns: number;
  successfulActions: number;
  failedActions: number;
  regressions: number;
  behavioralFailures: number;
  actionTypes: Record<string, number>;
} {
  const stats = {
    totalTurns: turns.length,
    successfulActions: 0,
    failedActions: 0,
    regressions: 0,
    behavioralFailures: 0,
    actionTypes: {} as Record<string, number>,
  };

  for (const turn of turns) {
    const obs = turn.observation;
    if (!obs) continue;

    if (obs.success) {
      stats.successfulActions++;
    } else {
      stats.failedActions++;
    }

    if (obs.signals.regression.isRegression) {
      stats.regressions++;
    }

    if (obs.signals.behavioral.failed > 0) {
      stats.behavioralFailures++;
    }

    const actionType = obs.action.type;
    stats.actionTypes[actionType] = (stats.actionTypes[actionType] ?? 0) + 1;
  }

  return stats;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Truncate a string to a maximum length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
