/**
 * CodeDiffView Component
 *
 * Displays code diff with "Apply" button.
 * The Apply button is UI-driven, not LLM-controlled.
 */

'use client';

import { useMemo } from 'react';
import { Check, X, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ShowDiffAction } from '../types';
import { getDiffSummary } from '../actions/diff-validator';

interface CodeDiffViewProps {
  action: ShowDiffAction;
  onApply: () => void;
  onDismiss: () => void;
}

export function CodeDiffView({ action, onApply, onDismiss }: CodeDiffViewProps) {
  const { originalCode, suggestedCode, explanation } = action;

  // Calculate diff summary
  const diffSummary = useMemo(
    () => getDiffSummary(originalCode, suggestedCode),
    [originalCode, suggestedCode]
  );

  // Split into lines for display
  const originalLines = originalCode.split('\n');
  const suggestedLines = suggestedCode.split('\n');

  return (
    <div className="flex flex-col h-full max-h-[70vh] bg-card rounded-lg border border-border shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-foreground">Suggested Changes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-green-700 dark:text-green-400">+{diffSummary.linesAdded}</span>
          <span className="text-red-700 dark:text-red-400">-{diffSummary.linesRemoved}</span>
        </div>
      </div>

      {/* Explanation */}
      <div className="px-4 py-3 border-b border-border bg-blue-50 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        {explanation}
      </div>

      {/* Diff view */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 divide-x divide-border text-sm font-mono text-foreground">
          {/* Original code */}
          <div className="overflow-auto">
            <div className="sticky top-0 bg-red-50 dark:bg-red-950/40 px-3 py-1 text-xs text-red-700 dark:text-red-300 border-b border-border">
              Original
            </div>
            <pre className="p-3 text-xs leading-relaxed">
              {originalLines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-1 -mx-1',
                    !suggestedLines.includes(line) && 'bg-red-100 dark:bg-red-950/40'
                  )}
                >
                  <span className="inline-block w-6 text-right text-muted-foreground mr-3 select-none">
                    {i + 1}
                  </span>
                  {line || ' '}
                </div>
              ))}
            </pre>
          </div>

          {/* Suggested code */}
          <div className="overflow-auto">
            <div className="sticky top-0 bg-green-50 dark:bg-green-950/40 px-3 py-1 text-xs text-green-700 dark:text-green-300 border-b border-border">
              Suggested
            </div>
            <pre className="p-3 text-xs leading-relaxed">
              {suggestedLines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-1 -mx-1',
                    !originalLines.includes(line) && 'bg-green-100 dark:bg-green-950/40'
                  )}
                >
                  <span className="inline-block w-6 text-right text-muted-foreground mr-3 select-none">
                    {i + 1}
                  </span>
                  {line || ' '}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer with Apply/Dismiss buttons */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border bg-muted/50">
        <Button variant="outline" onClick={onDismiss} className="gap-2">
          <X className="h-4 w-4" />
          Dismiss
        </Button>
        <Button onClick={onApply} className="gap-2">
          <Check className="h-4 w-4" />
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
