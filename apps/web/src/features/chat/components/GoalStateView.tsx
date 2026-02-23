/**
 * GoalStateView Component
 *
 * Displays the goal state checklist with criteria status.
 * Used to show what the agent is trying to achieve.
 */

'use client';

import React from 'react';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import type { GoalState } from '../agent/types';
import { countSatisfiedCriteria } from '../agent/goal-state';

interface GoalStateViewProps {
  /** The goal state to display */
  goalState: GoalState;
  /** Whether to show in compact mode */
  compact?: boolean;
}

export function GoalStateView({ goalState, compact = false }: GoalStateViewProps) {
  const { satisfied, total } = countSatisfiedCriteria(goalState);
  const progress = total > 0 ? (satisfied / total) * 100 : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Target className="h-3 w-3 text-blue-500" />
        <span>
          {satisfied}/{total} criteria
        </span>
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Goal</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {satisfied}/{total} complete
        </span>
      </div>

      {/* Goal Description */}
      <p className="text-sm text-muted-foreground line-clamp-2">
        {goalState.description}
      </p>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            progress === 100 ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Criteria List */}
      <div className="space-y-1">
        {goalState.successCriteria.map((criterion) => {
          const status = goalState.currentStatus.find(
            (s) => s.criterionId === criterion.id
          );
          const isSatisfied = status?.satisfied ?? false;

          return (
            <div
              key={criterion.id}
              className={`flex items-start gap-2 text-sm ${
                isSatisfied ? 'text-green-700' : 'text-foreground'
              }`}
            >
              {isSatisfied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={isSatisfied ? 'line-through opacity-70' : ''}>
                  {criterion.description}
                </span>
                {status?.evidence && !isSatisfied && (
                  <span className="block text-xs text-muted-foreground">
                    {status.evidence}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">
                {criterion.type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Inline Goal Badge
// ============================================================================

interface GoalBadgeProps {
  goalState: GoalState;
}

export function GoalBadge({ goalState }: GoalBadgeProps) {
  const { satisfied, total } = countSatisfiedCriteria(goalState);
  const allComplete = satisfied === total;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
        allComplete
          ? 'bg-green-100 text-green-700'
          : 'bg-blue-100 text-blue-700'
      }`}
    >
      {allComplete ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Target className="h-3 w-3" />
      )}
      <span>
        {satisfied}/{total}
      </span>
    </div>
  );
}
