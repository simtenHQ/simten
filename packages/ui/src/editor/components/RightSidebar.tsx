/**
 * RightSidebar Component
 *
 * Sidebar with diagnostics panel.
 */

'use client';

import { DiagnosticsPanel } from './DiagnosticsPanel';
import { useAnalysisStore } from '../stores/analysis-store';

export function RightSidebar() {
  const validationResult = useAnalysisStore((state) => state.validationResult);

  // Count errors for the header badge
  const errorCount = validationResult?.diagnostics.filter(
    (d) => d.severity === 'error'
  ).length ?? 0;

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex border-b border-gray-200 bg-white">
        <div className="flex-1 px-3 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 bg-blue-50">
          Diagnostics
          {errorCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {errorCount}
            </span>
          )}
          {validationResult && errorCount === 0 && (
            <span className="ml-1 text-green-500">{'\u2713'}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <DiagnosticsPanel />
        </div>
      </div>
    </div>
  );
}
