/**
 * DiagnosticsPanel Component
 *
 * Displays validation results, circuit metrics, and diagnostics
 * from the analysis pipeline.
 */

'use client';

import React from 'react';
import { useAnalysisStore } from '../stores/analysis-store';
import type { Diagnostic } from '@simten/core';

function DiagnosticItem({ diagnostic }: { diagnostic: Diagnostic }) {
  const severityColors = {
    error: 'bg-red-100 border-red-300 text-red-800',
    warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    info: 'bg-blue-100 border-blue-300 text-blue-800',
  };

  const severityIcons = {
    error: '!',
    warning: '!',
    info: 'i',
  };

  return (
    <div
      className={`p-3 rounded-lg border ${severityColors[diagnostic.severity]} mb-2`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
            diagnostic.severity === 'error'
              ? 'bg-red-500 text-white'
              : diagnostic.severity === 'warning'
                ? 'bg-yellow-500 text-white'
                : 'bg-blue-500 text-white'
          }`}
        >
          {severityIcons[diagnostic.severity]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-1.5 py-0.5 bg-white/50 rounded">
              {diagnostic.code}
            </span>
            <span className="text-xs opacity-75">{diagnostic.phase}</span>
          </div>
          <p className="text-sm">{diagnostic.message}</p>
          {diagnostic.location && (
            <p className="text-xs mt-1 opacity-75">
              Line {diagnostic.location.start.line}
              {diagnostic.location.start.column > 0 &&
                `:${diagnostic.location.start.column}`}
            </p>
          )}
          {diagnostic.suggestions && diagnostic.suggestions.length > 0 && (
            <div className="mt-2 text-xs">
              <span className="font-medium">Suggestions:</span>
              <ul className="list-disc list-inside ml-1 mt-1 space-y-0.5">
                {diagnostic.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricsCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export function DiagnosticsPanel() {
  const validationResult = useAnalysisStore((state) => state.validationResult);
  const metrics = useAnalysisStore((state) => state.metrics);
  const allDiagnostics = useAnalysisStore((state) => state.allDiagnostics);
  const isAnalyzing = useAnalysisStore((state) => state.isAnalyzing);

  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="animate-pulse">Analyzing...</div>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-4xl mb-3">
          <span role="img" aria-label="circuit">
            &#x26A1;
          </span>
        </div>
        <p className="text-sm">Compile your circuit code to see analysis results</p>
        <p className="text-xs text-gray-400 mt-2">
          Press Cmd/Ctrl+Enter or click Compile
        </p>
      </div>
    );
  }

  const errors = allDiagnostics.filter((d) => d.severity === 'error');
  const warnings = allDiagnostics.filter((d) => d.severity === 'warning');
  const infos = allDiagnostics.filter((d) => d.severity === 'info');

  return (
    <div className="p-4 space-y-6">
      {/* Status Banner */}
      <div
        className={`p-3 rounded-lg ${
          validationResult.valid
            ? 'bg-green-100 border border-green-300 text-green-800'
            : 'bg-red-100 border border-red-300 text-red-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {validationResult.valid ? '\u2713' : '\u2717'}
          </span>
          <div>
            <div className="font-medium">
              {validationResult.valid ? 'Circuit Valid' : 'Validation Failed'}
            </div>
            <div className="text-xs opacity-75">
              {errors.length} error{errors.length !== 1 ? 's' : ''},{' '}
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Circuit Metrics */}
      {metrics && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Circuit Metrics
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <MetricsCard label="Nodes" value={metrics.nodeCount} />
            <MetricsCard
              label="Registers"
              value={metrics.registerCount}
              hint={metrics.isPurelyCombinational ? 'Combinational' : 'Sequential'}
            />
            <MetricsCard
              label="Critical Path"
              value={metrics.combinationalDepth}
              hint="Gate levels"
            />
            <MetricsCard
              label="Max Fan-out"
              value={metrics.maxFanOut}
              hint={metrics.maxFanOut > 8 ? 'Consider buffering' : undefined}
            />
          </div>
        </div>
      )}

      {/* Analysis Summary */}
      {validationResult.analysis && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Analysis</h3>
          <div className="text-xs space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
            {validationResult.analysis.circuitsDefined.length > 0 && (
              <div>
                <span className="text-gray-500">Circuits: </span>
                <span className="font-mono">
                  {validationResult.analysis.circuitsDefined.join(', ')}
                </span>
              </div>
            )}
            {validationResult.analysis.componentsUsed.length > 0 && (
              <div>
                <span className="text-gray-500">Components: </span>
                <span className="font-mono">
                  {validationResult.analysis.componentsUsed.join(', ')}
                </span>
              </div>
            )}
            {validationResult.analysis.unresolvedReferences.length > 0 && (
              <div className="text-red-600">
                <span className="text-red-500">Unresolved: </span>
                <span className="font-mono">
                  {validationResult.analysis.unresolvedReferences.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diagnostics List */}
      {allDiagnostics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Diagnostics ({allDiagnostics.length})
          </h3>
          <div className="space-y-2">
            {errors.map((d, i) => (
              <DiagnosticItem key={`error-${i}`} diagnostic={d} />
            ))}
            {warnings.map((d, i) => (
              <DiagnosticItem key={`warning-${i}`} diagnostic={d} />
            ))}
            {infos.map((d, i) => (
              <DiagnosticItem key={`info-${i}`} diagnostic={d} />
            ))}
          </div>
        </div>
      )}

      {/* No Issues */}
      {validationResult.valid && allDiagnostics.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          <div className="text-2xl mb-2">
            <span role="img" aria-label="sparkles">
              &#x2728;
            </span>
          </div>
          <p className="text-sm">No issues found</p>
        </div>
      )}
    </div>
  );
}
