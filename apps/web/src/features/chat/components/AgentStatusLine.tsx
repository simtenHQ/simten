/**
 * AgentStatusLine Component
 *
 * Claude Code-style status indicator with shimmer animation.
 * Shows current action with pulsing/shimmer effect.
 */

'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';
import type { AgentState } from '../agent/types';

interface AgentStatusLineProps {
  /** Current agent state */
  state: AgentState;
  /** Whether the agent is currently running */
  isRunning: boolean;
  /** Callback to cancel the agent */
  onCancel?: () => void;
}

export function AgentStatusLine({ state, isRunning, onCancel }: AgentStatusLineProps) {
  const { turns, status, currentPlan } = state;

  // Determine what to show
  const getStatusText = () => {
    if (!isRunning) {
      if (status === 'completed') return 'Completed';
      if (status === 'error') return 'Error';
      if (status === 'cancelled') return 'Cancelled';
      if (status === 'waiting_for_user') return 'Waiting for approval...';
      return 'Ready';
    }

    // Get current action from last turn or plan
    const lastTurn = turns[turns.length - 1];
    if (lastTurn?.response?.action) {
      const actionType = lastTurn.response.action.type;
      switch (actionType) {
        case 'SET_INPUT':
          return 'Setting input...';
        case 'RUN_SIMULATION':
          return 'Running simulation...';
        case 'SHOW_DIFF':
          return 'Preparing code change...';
        case 'INSERT_NODE':
          return 'Inserting component...';
        default:
          return 'Working...';
      }
    }

    // Check plan for context
    if (currentPlan && currentPlan.length > 0) {
      return `Planning: ${currentPlan[0].slice(0, 40)}${currentPlan[0].length > 40 ? '...' : ''}`;
    }

    return `Turn ${turns.length + 1}...`;
  };

  if (!isRunning && status !== 'waiting_for_user') {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border-b border-blue-500/20">
      {/* Spinner */}
      <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />

      {/* Status text with shimmer */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <span className="text-sm font-medium animate-shimmer">
          {getStatusText()}
        </span>
      </div>

      {/* Turn counter */}
      <span className="text-xs text-muted-foreground flex-shrink-0">
        Turn {turns.length + 1}
      </span>

      {/* Cancel button */}
      {onCancel && isRunning && (
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

