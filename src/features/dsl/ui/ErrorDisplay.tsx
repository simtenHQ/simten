/**
 * ErrorDisplay Component
 *
 * Displays compilation errors with line/column information
 */

'use client';

import React from 'react';

export interface CompilationError {
  message: string;
  line: number;
  column: number;
  suggestions?: string[];
}

interface ErrorDisplayProps {
  errors: CompilationError[];
  onClose?: () => void;
}

export function ErrorDisplay({ errors, onClose }: ErrorDisplayProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-red-300 bg-red-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-red-800">
          Compilation Errors ({errors.length})
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-red-600 hover:text-red-800 text-sm"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {errors.map((error, index) => (
          <div
            key={index}
            className="bg-white p-3 rounded border border-red-200 shadow-sm"
          >
            <div className="flex items-start gap-2 text-sm text-red-700">
              <span className="font-mono text-red-600 shrink-0 font-semibold">
                {error.line > 0 ? `Line ${error.line}:${error.column}` : 'Error'}
              </span>
              <span className="flex-1 font-medium">{error.message}</span>
            </div>
            {error.suggestions && error.suggestions.length > 0 && (
              <div className="mt-2 pl-2 border-l-2 border-blue-300 ml-2">
                <div className="text-xs font-semibold text-blue-700 mb-1">💡 Suggestions:</div>
                <ul className="text-xs text-blue-600 space-y-1">
                  {error.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-blue-400">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
