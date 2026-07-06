/**
 * ErrorDisplay Component
 *
 * Minimal error indicator - shows count only since Monaco shows inline squiggles.
 * Click to expand and see error details.
 */

'use client';

import React, { useState } from 'react';

export interface CompilationError {
  message: string;
  line: number;
  column: number;
  suggestions?: string[];
}

interface ErrorDisplayProps {
  errors: CompilationError[];
}

export function ErrorDisplay({ errors }: ErrorDisplayProps) {
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset hidden state when errors change (new compilation)
  React.useEffect(() => {
    setHidden(false);
  }, [errors]);

  if (errors.length === 0 || hidden) {
    return null;
  }

  // Minimal collapsed view
  if (!expanded) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-red-50 border-t border-red-200">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900"
        >
          <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
            {errors.length}
          </span>
          <span>{errors.length === 1 ? '1 error' : `${errors.length} errors`}</span>
          <span className="text-red-500 text-xs ml-1">↓</span>
        </button>
        <button
          onClick={() => setHidden(true)}
          className="text-red-500 hover:text-red-600 text-xs px-2"
          title="Hide panel (errors remain in editor)"
        >
          hide
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="border-t border-red-200 bg-red-50">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-red-100">
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-2 text-sm text-red-700 hover:text-red-900"
        >
          <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
            {errors.length}
          </span>
          <span>{errors.length === 1 ? '1 error' : `${errors.length} errors`}</span>
          <span className="text-red-500 text-xs ml-1">↑</span>
        </button>
        <button
          onClick={() => setHidden(true)}
          className="text-red-500 hover:text-red-600 text-xs px-2"
          title="Hide panel (errors remain in editor)"
        >
          hide
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {errors.map((error, index) => (
          <div
            key={index}
            className="px-3 py-2 text-sm border-b border-red-100 last:border-b-0 hover:bg-red-100/50"
          >
            <span className="font-mono text-red-500 text-xs mr-2">
              {error.line > 0 ? `${error.line}:${error.column}` : '—'}
            </span>
            <span className="text-red-700">{error.message}</span>
            {error.suggestions && error.suggestions.length > 0 && (
              <div className="mt-1 text-xs text-blue-600">💡 {error.suggestions[0]}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
