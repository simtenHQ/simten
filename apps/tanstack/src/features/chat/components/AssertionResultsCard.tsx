/**
 * AssertionResultsCard Component
 *
 * Displays the results of a VERIFY_ASSERTION action inline.
 * Shows per-assertion pass/fail rows and a summary line.
 * Compact enough to embed inside ActionCard or messages.
 */

'use client';

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionObservation } from '../agent/types';

// The shape of assertionResults on ActionObservation
type AssertionResults = NonNullable<ActionObservation['assertionResults']>;
type AssertionRow = AssertionResults['results'][number];

interface AssertionResultsCardProps {
  /** Assertion results from ActionObservation.assertionResults */
  results: AssertionResults;
  /** Additional class names for the outer container */
  className?: string;
}

export function AssertionResultsCard({ results, className }: AssertionResultsCardProps) {
  const { total, passed, failed, allPassed } = results;

  return (
    <div
      className={cn(
        'rounded-md border text-xs',
        allPassed
          ? 'border-green-200 bg-green-50'
          : 'border-red-200 bg-red-50',
        className
      )}
    >
      {/* Summary header */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 border-b font-medium',
          allPassed
            ? 'border-green-200 text-green-700'
            : 'border-red-200 text-red-700'
        )}
      >
        {allPassed ? (
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span>
          {passed}/{total} assertion{total !== 1 ? 's' : ''} passed
          {failed > 0 && (
            <span className="ml-1 text-red-600">
              ({failed} failed)
            </span>
          )}
        </span>
      </div>

      {/* Per-assertion rows */}
      <div className="divide-y divide-gray-100">
        {results.results.map((row) => (
          <AssertionRow key={row.assertionId} row={row} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Individual Assertion Row
// ============================================================================

function AssertionRow({ row }: { row: AssertionRow }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-1.5',
        row.passed ? 'bg-transparent' : 'bg-red-50/60'
      )}
    >
      {/* Pass/fail icon */}
      <div className="mt-px flex-shrink-0">
        {row.passed ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <XCircle className="h-3 w-3 text-red-500" />
        )}
      </div>

      {/* Assertion message */}
      <span
        className={cn(
          'flex-1 min-w-0 leading-tight',
          row.passed ? 'text-gray-700' : 'text-red-700 font-medium'
        )}
      >
        {row.message}
      </span>

      {/* Cycle badge */}
      <span className="flex-shrink-0 text-muted-foreground tabular-nums">
        @{row.cycle}
      </span>
    </div>
  );
}
