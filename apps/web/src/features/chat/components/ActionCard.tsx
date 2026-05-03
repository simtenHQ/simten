/**
 * ActionCard Component
 *
 * Displays an executable action with preview and execute button.
 * Respects safety levels (preview vs confirm).
 */

'use client';

import { Play, FileCode, Plus, Loader2, ToggleRight, TestTube2, ShieldCheck, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssistantAction, ActionExecutionStatus } from '../types';
import { ACTION_SAFETY } from '../constants';
import { getActionPreview } from '../actions/confirmation-flow';

interface ActionCardProps {
  action: AssistantAction;
  status?: ActionExecutionStatus;
  onExecute: (action: AssistantAction) => void;
  onShowDiff?: (action: AssistantAction) => void;
}

const ACTION_ICONS = {
  SET_INPUT: ToggleRight,
  RUN_SIMULATION: Play,
  SHOW_DIFF: FileCode,
  WRITE_CIRCUIT: Code2,
  INSERT_NODE: Plus,
  GENERATE_HARNESS: TestTube2,
  VERIFY_ASSERTION: ShieldCheck,
} as const;

const ACTION_COLORS = {
  SET_INPUT: 'bg-amber-50 border-amber-200 hover:border-amber-400',
  RUN_SIMULATION: 'bg-green-50 border-green-200 hover:border-green-400',
  SHOW_DIFF: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  WRITE_CIRCUIT: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  INSERT_NODE: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  GENERATE_HARNESS: 'bg-teal-50 border-teal-200 hover:border-teal-400',
  VERIFY_ASSERTION: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
} as const;

export function ActionCard({
  action,
  status,
  onExecute,
  onShowDiff,
}: ActionCardProps) {
  const Icon = ACTION_ICONS[action.type] ?? Play;
  const colorClass = ACTION_COLORS[action.type] ?? 'bg-gray-50 border-gray-200';
  const safetyLevel = ACTION_SAFETY[action.type] ?? 'confirm';

  const isExecuting = status === 'executing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';
  const isStale = status === 'stale';

  const handleClick = () => {
    if (action.type === 'SHOW_DIFF' && onShowDiff) {
      onShowDiff(action);
    } else if (action.type === 'GENERATE_HARNESS' && onShowDiff) {
      // GENERATE_HARNESS is handled like SHOW_DIFF - generates code then shows diff
      onShowDiff(action);
    } else {
      onExecute(action);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        colorClass,
        isCompleted && 'opacity-60',
        (isFailed || isStale) && 'border-red-200 bg-red-50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            action.type === 'SET_INPUT' && 'bg-amber-100 text-amber-600',
            action.type === 'RUN_SIMULATION' && 'bg-green-100 text-green-600',
            (action.type === 'SHOW_DIFF' || action.type === 'WRITE_CIRCUIT') && 'bg-blue-100 text-blue-600',
            action.type === 'INSERT_NODE' && 'bg-purple-100 text-purple-600',
            action.type === 'GENERATE_HARNESS' && 'bg-teal-100 text-teal-600'
          )}
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Action type label */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase text-gray-500">
              {action.type.replace('_', ' ')}
            </span>
            {safetyLevel === 'confirm' && (
              <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                Requires confirmation
              </span>
            )}
          </div>

          {/* Action preview */}
          <p className="mt-1 text-sm text-gray-700">{getActionPreview(action)}</p>

          {/* Status message */}
          {isCompleted && (
            <p className="mt-1 text-xs text-green-600">Completed</p>
          )}
          {isFailed && (
            <p className="mt-1 text-xs text-red-600">Failed</p>
          )}
          {isSkipped && (
            <p className="mt-1 text-xs text-gray-500">Skipped</p>
          )}
          {isStale && (
            <p className="mt-1 text-xs text-red-600">
              Circuit modified - re-ask for updated suggestion
            </p>
          )}
        </div>

        {/* Execute button */}
        {!isCompleted && !isSkipped && (
          <Button
            size="sm"
            variant={action.type === 'SHOW_DIFF' || action.type === 'GENERATE_HARNESS' ? 'outline' : 'default'}
            onClick={handleClick}
            disabled={isExecuting || isStale}
            className="shrink-0"
          >
            {action.type === 'SHOW_DIFF'
              ? 'View Diff'
              : action.type === 'GENERATE_HARNESS'
              ? 'Generate'
              : 'Execute'}
          </Button>
        )}
      </div>
    </div>
  );
}
