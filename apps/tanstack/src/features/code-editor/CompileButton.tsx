/**
 * CompileButton Component
 *
 * Button to trigger circuit compilation with loading state
 */

'use client';

import React from 'react';

interface CompileButtonProps {
  onClick: () => void;
  isCompiling?: boolean;
  disabled?: boolean;
}

export function CompileButton({ onClick, isCompiling = false, disabled = false }: CompileButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isCompiling}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
      title="Compile circuit code"
    >
      {isCompiling ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Compiling...
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Compile
        </>
      )}
    </button>
  );
}
