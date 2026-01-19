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
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {errors.map((error, index) => (
          <div
            key={index}
            className="flex items-start gap-2 text-sm text-red-700 bg-white p-2 rounded border border-red-200"
          >
            <span className="font-mono text-red-600 shrink-0">
              {error.line > 0 ? `${error.line}:${error.column}` : 'Error'}
            </span>
            <span className="flex-1">{error.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
