"use client";

import React from "react";

export interface SimulatorError {
  message: string;
  line?: number;
  column?: number;
  stage: "parse" | "compile" | "elaborate" | "simulate";
}

interface ErrorDisplayProps {
  error: string | SimulatorError | SimulatorError[];
  title?: string;
  onRetry?: () => void;
}

function parseErrors(error: string | SimulatorError | SimulatorError[]): SimulatorError[] {
  if (Array.isArray(error)) return error;
  if (typeof error === "object") return [error];
  // Legacy: semicolon-joined strings from older hook versions
  return error.split("; ").map((msg) => ({ message: msg, stage: "compile" as const }));
}

const STAGE_LABELS: Record<string, string> = {
  parse: "Parse",
  compile: "Compile",
  elaborate: "Elaborate",
  simulate: "Simulate",
};

/**
 * Styled error display for circuit embed components.
 * Renders structured error messages with optional line/column info.
 */
export function ErrorDisplay({ error, title = "Circuit Error", onRetry }: ErrorDisplayProps) {
  const errors = parseErrors(error);

  return (
    <div
      className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 overflow-hidden"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-300">{title}</h4>
          <div className="mt-2 space-y-1.5">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-mono text-red-400/60 bg-red-900/30 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {STAGE_LABELS[err.stage] || err.stage}
                </span>
                <span className="text-xs font-mono text-red-300/80 break-all">
                  {err.message}
                  {err.line !== undefined && (
                    <span className="text-red-400/50 ml-1">
                      (line {err.line}{err.column !== undefined ? `:${err.column}` : ""})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1 text-xs font-medium rounded-md bg-red-900/30 hover:bg-red-900/50 text-red-300 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
