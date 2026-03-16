/**
 * AgentProgress Component
 *
 * Displays real-time progress of the agent loop execution.
 * Shows current turn, plan status, and recent actions.
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, PauseCircle } from 'lucide-react';
import type { AgentState, AgentTurn } from '../agent/types';

interface AgentProgressProps {
  /** Current agent state */
  state: AgentState;
  /** Whether the agent is currently running */
  isRunning: boolean;
  /** Callback to cancel the agent */
  onCancel?: () => void;
}

export function AgentProgress({ state, isRunning, onCancel }: AgentProgressProps) {
  const { turns, status, currentPlan, goalState } = state;

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : status === 'error' ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : status === 'max_turns_reached' ? (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          ) : status === 'waiting_for_user' ? (
            <PauseCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <Clock className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium">
            {isRunning
              ? `Turn ${turns.length + 1}`
              : status === 'completed'
              ? 'Completed'
              : status === 'error'
              ? 'Error'
              : status === 'max_turns_reached'
              ? 'Max Turns Reached'
              : status === 'cancelled'
              ? 'Cancelled'
              : status === 'waiting_for_user'
              ? 'Waiting for you'
              : 'Ready'}
          </span>
        </div>
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Goal Progress */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Goal Progress</div>
        <div className="space-y-0.5">
          {goalState.successCriteria.map((criterion) => {
            const status = goalState.currentStatus.find(
              (s) => s.criterionId === criterion.id
            );
            return (
              <div key={criterion.id} className="flex items-center gap-2 text-xs">
                {status?.satisfied ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-gray-400" />
                )}
                <span className={status?.satisfied ? 'text-green-700' : ''}>
                  {criterion.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Plan */}
      {currentPlan && currentPlan.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="space-y-0.5 text-xs">
            {currentPlan.slice(0, 4).map((step, i) => (
              <div key={i} className="text-muted-foreground">
                {i + 1}. {step}
              </div>
            ))}
            {currentPlan.length > 4 && (
              <div className="text-muted-foreground">
                +{currentPlan.length - 4} more steps
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Turns */}
      {turns.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Recent Actions</div>
          <div className="space-y-0.5">
            {turns.slice(-3).map((turn) => (
              <TurnSummary key={turn.turnNumber} turn={turn} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Turn Summary Component
// ============================================================================

function TurnSummary({ turn }: { turn: AgentTurn }) {
  const obs = turn.observation;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">#{turn.turnNumber}</span>
      {obs ? (
        <>
          <span className={obs.success ? 'text-green-600' : 'text-red-600'}>
            {obs.action.type}
          </span>
          {obs.success ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          {obs.signals.regression.isRegression && (
            <span className="text-yellow-600 text-xs">REGRESS</span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">Reasoning</span>
      )}
    </div>
  );
}
