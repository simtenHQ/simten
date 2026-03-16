/**
 * Goal State Formatter
 *
 * Formats GoalState as markdown for injection into LLM prompts.
 * Uses a checklist format for clear criterion tracking.
 */

import type { GoalState, CriterionStatus } from '../agent/types';
import { countSatisfiedCriteria, getNextRecommendedAction } from '../agent/goal-state';

// ============================================================================
// Main Formatter
// ============================================================================

/**
 * Format GoalState as markdown for LLM prompt injection.
 *
 * Example output:
 * ```
 * ## Goal State
 *
 * User Goal: Add inverter between switch and LED
 *
 * Success Criteria:
 * - [x] No validation errors
 * - [x] Circuit contains inverter
 * - [ ] Behavioral expectations pass (NOT VERIFIED)
 *
 * Current Status: 2/3 criteria satisfied
 * Next step: Run simulation to verify behavior
 * ```
 */
export function formatGoalState(goalState: GoalState): string {
  const lines: string[] = [];

  lines.push('## Goal State');
  lines.push('');
  lines.push(`User Goal: ${goalState.description}`);
  lines.push('');
  lines.push('Success Criteria:');

  // Format each criterion with checkbox
  for (const criterion of goalState.successCriteria) {
    const status = goalState.currentStatus.find(
      (s) => s.criterionId === criterion.id
    );
    const satisfied = status?.satisfied ?? false;
    const checkbox = satisfied ? '[x]' : '[ ]';

    let line = `- ${checkbox} ${criterion.description}`;

    // Add evidence/notes if available
    if (status?.evidence && !satisfied) {
      line += ` (${status.evidence})`;
    } else if (!satisfied && criterion.type === 'behavioral') {
      line += ' (NOT VERIFIED)';
    }

    lines.push(line);
  }

  // Add summary
  lines.push('');
  const { satisfied, total } = countSatisfiedCriteria(goalState);
  lines.push(`Current Status: ${satisfied}/${total} criteria satisfied`);

  // Add next step recommendation if not complete
  if (satisfied < total) {
    const nextStep = getNextRecommendedAction(goalState);
    lines.push(`Next step: ${nextStep}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Compact Formatter
// ============================================================================

/**
 * Format GoalState in a more compact single-line format.
 * Useful for turn history summaries.
 */
export function formatGoalStateCompact(goalState: GoalState): string {
  const { satisfied, total } = countSatisfiedCriteria(goalState);

  const unsatisfied = goalState.currentStatus
    .filter((s) => !s.satisfied)
    .map((s) => {
      const criterion = goalState.successCriteria.find(
        (c) => c.id === s.criterionId
      );
      return criterion?.description ?? s.criterionId;
    });

  if (unsatisfied.length === 0) {
    return `Goal: ${satisfied}/${total} criteria met (COMPLETE)`;
  }

  const pending = unsatisfied.slice(0, 2).join(', ');
  const more = unsatisfied.length > 2 ? `, +${unsatisfied.length - 2} more` : '';

  return `Goal: ${satisfied}/${total} criteria met. Pending: ${pending}${more}`;
}

// ============================================================================
// Status Formatters
// ============================================================================

/**
 * Format criterion status change for logging.
 */
export function formatStatusChange(
  criterionId: string,
  before: CriterionStatus | undefined,
  after: CriterionStatus
): string {
  const wassSatisfied = before?.satisfied ?? false;
  const isSatisfied = after.satisfied;

  if (!wassSatisfied && isSatisfied) {
    return `[+] ${criterionId}: NOW SATISFIED`;
  } else if (wassSatisfied && !isSatisfied) {
    return `[-] ${criterionId}: NO LONGER SATISFIED (${after.evidence ?? 'no evidence'})`;
  } else if (!isSatisfied && after.evidence !== before?.evidence) {
    return `[~] ${criterionId}: ${after.evidence ?? 'pending'}`;
  }

  return '';
}

/**
 * Get a list of recently changed criteria.
 */
export function getRecentChanges(
  goalState: GoalState,
  turnNumber: number
): string[] {
  const changes: string[] = [];

  for (const status of goalState.currentStatus) {
    if (status.lastChecked === turnNumber) {
      const criterion = goalState.successCriteria.find(
        (c) => c.id === status.criterionId
      );
      if (criterion) {
        const mark = status.satisfied ? '[x]' : '[ ]';
        changes.push(`${mark} ${criterion.description}`);
      }
    }
  }

  return changes;
}
