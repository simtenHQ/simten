/**
 * HierarchyBreadcrumb Component
 *
 * Renders a breadcrumb navigation bar when the user has drilled into
 * a composite component. Shows the hierarchy path and allows navigation
 * back to any level.
 */

"use client";

import React from "react";
import { useCircuitPreviewStore } from "../stores/circuit-preview-store";

export function HierarchyBreadcrumb() {
  const drillDownStack = useCircuitPreviewStore((state) => state.drillDownStack);
  const navigateTo = useCircuitPreviewStore((state) => state.navigateTo);
  const compiledCircuits = useCircuitPreviewStore(
    (state) => state.compiledCircuits,
  );
  const selectedCircuitIndex = useCircuitPreviewStore(
    (state) => state.selectedCircuitIndex,
  );

  if (drillDownStack.length === 0) return null;

  // Get top-level circuit name
  const topLevelName =
    selectedCircuitIndex >= 0 && selectedCircuitIndex < compiledCircuits.length
      ? compiledCircuits[selectedCircuitIndex].name
      : "Circuit";

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-sm">
      {/* Read-only badge */}
      <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
        Read-Only
      </span>

      {/* Top-level circuit (always clickable) */}
      <button
        onClick={() => navigateTo(0)}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        {topLevelName}
      </button>

      {/* Intermediate segments */}
      {drillDownStack.map((frame, index) => {
        const isLast = index === drillDownStack.length - 1;

        return (
          <React.Fragment key={frame.nodeId}>
            <span className="text-gray-400">&gt;</span>
            {isLast ? (
              // Current (deepest) segment — not clickable
              <span className="font-medium text-gray-900">
                {frame.nodeLabel}{" "}
                <span className="text-gray-500">({frame.componentName})</span>
              </span>
            ) : (
              // Intermediate segment — clickable
              <button
                onClick={() => navigateTo(index + 1)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {frame.nodeLabel}{" "}
                <span className="text-blue-400">({frame.componentName})</span>
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
