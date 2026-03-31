"use client";

import React from "react";

interface LoadingSkeletonProps {
  height?: number | string;
}

/**
 * Loading skeleton for circuit embeds.
 * Shows fake node placeholders with connecting lines, matching the dark theme.
 * Respects height to prevent layout shift.
 */
export function LoadingSkeleton({ height = 300 }: LoadingSkeletonProps) {
  return (
    <div
      className="rounded-xl border border-[var(--embed-border)] bg-[var(--embed-bg-primary)] overflow-hidden flex items-center justify-center"
      style={{ height }}
      role="status"
      aria-label="Loading circuit"
    >
      <div className="flex items-center gap-8">
        {/* Input nodes */}
        <div className="flex flex-col gap-4">
          <div className="w-20 h-14 rounded-lg bg-[var(--embed-bg-tertiary)]/60 animate-pulse" />
          <div className="w-20 h-14 rounded-lg bg-[var(--embed-bg-tertiary)]/60 animate-pulse" style={{ animationDelay: "150ms" }} />
        </div>

        {/* Connecting lines */}
        <div className="flex flex-col gap-6 items-center">
          <div className="w-12 h-0.5 bg-[var(--embed-border)]/40 animate-pulse" style={{ animationDelay: "300ms" }} />
          <div className="w-12 h-0.5 bg-[var(--embed-border)]/40 animate-pulse" style={{ animationDelay: "350ms" }} />
        </div>

        {/* Logic node */}
        <div className="w-24 h-20 rounded-lg bg-[var(--embed-bg-tertiary)]/60 animate-pulse" style={{ animationDelay: "200ms" }} />

        {/* Connecting line */}
        <div className="w-12 h-0.5 bg-[var(--embed-border)]/40 animate-pulse" style={{ animationDelay: "400ms" }} />

        {/* Output node */}
        <div className="w-20 h-14 rounded-lg bg-[var(--embed-bg-tertiary)]/60 animate-pulse" style={{ animationDelay: "250ms" }} />
      </div>

      {/* Screen reader text */}
      <span className="sr-only">Compiling and laying out circuit...</span>
    </div>
  );
}
