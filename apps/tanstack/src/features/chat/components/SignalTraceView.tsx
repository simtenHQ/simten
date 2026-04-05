/**
 * SignalTraceView Component
 *
 * Inline sparkline visualizations for signals the agent is watching.
 * Renders a mini SVG waveform for each requested signal, highlighting
 * transitions. Not a full waveform viewer — just a visual hint.
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { SimulationTrace } from '@turing-incomplete/core';

// ============================================================================
// Constants
// ============================================================================

const SPARKLINE_HEIGHT = 24;
const SPARKLINE_WIDTH = 80;
const BASELINE_Y = SPARKLINE_HEIGHT - 3;
const TOP_Y = 3;

// ============================================================================
// Types
// ============================================================================

interface SignalTraceViewProps {
  /** Simulation trace containing signal data */
  trace: SimulationTrace;
  /** Names of signals to display */
  signalNames: string[];
  /** How many of the most recent cycles to show (default: 16) */
  windowSize?: number;
  /** Additional class names */
  className?: string;
}

interface SparklineProps {
  /** Signal values (boolean or numeric) over the window */
  values: (boolean | number)[];
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Whether the signal is purely boolean */
  isBit: boolean;
}

// ============================================================================
// SignalTraceView
// ============================================================================

export function SignalTraceView({
  trace,
  signalNames,
  windowSize = 16,
  className,
}: SignalTraceViewProps) {
  // Merge signals and registers into a single lookup
  const allSignals = useMemo(
    () => ({ ...trace.registers, ...trace.signals }),
    [trace]
  );

  // Filter to only the signals that actually exist in the trace
  const availableSignals = useMemo(
    () => signalNames.filter((name) => allSignals[name] !== undefined),
    [signalNames, allSignals]
  );

  if (availableSignals.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-1', className)}>
      {availableSignals.map((name) => {
        const rawValues = allSignals[name];
        // Take only the last windowSize samples
        const windowed = rawValues.slice(-windowSize);
        const isBit = typeof windowed[0] === 'boolean';

        return (
          <SignalRow
            key={name}
            name={name}
            values={windowed}
            isBit={isBit}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Individual Signal Row
// ============================================================================

interface SignalRowProps {
  name: string;
  values: (boolean | number)[];
  isBit: boolean;
}

function SignalRow({ name, values, isBit }: SignalRowProps) {
  const transitionCount = useMemo(() => countTransitions(values), [values]);

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Signal name */}
      <span
        className="w-20 truncate text-right font-mono text-muted-foreground flex-shrink-0"
        title={name}
      >
        {name}
      </span>

      {/* Sparkline */}
      <Sparkline
        values={values}
        isBit={isBit}
        width={SPARKLINE_WIDTH}
        height={SPARKLINE_HEIGHT}
      />

      {/* Transition count */}
      {transitionCount > 0 && (
        <span className="text-muted-foreground tabular-nums">
          {transitionCount}T
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Sparkline SVG
// ============================================================================

function Sparkline({ values, isBit, width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT }: SparklineProps) {
  const pathData = useMemo(
    () =>
      isBit
        ? buildBitPath(values as boolean[], width, height)
        : buildNumericPath(values as number[], width, height),
    [values, isBit, width, height]
  );

  const transitionXs = useMemo(
    () => (isBit ? getTransitionXPositions(values as boolean[], width) : []),
    [values, isBit, width]
  );

  return (
    <svg
      width={width}
      height={height}
      className="flex-shrink-0 rounded overflow-visible"
      style={{ background: 'var(--color-muted, #f1f5f9)' }}
    >
      {/* Transition highlight lines (for bit signals) */}
      {transitionXs.map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={TOP_Y - 1}
          x2={x}
          y2={BASELINE_Y + 1}
          stroke="#f59e0b"
          strokeWidth={1}
          strokeOpacity={0.7}
        />
      ))}

      {/* Waveform path */}
      <path
        d={pathData}
        fill="none"
        stroke={isBit ? '#3b82f6' : '#8b5cf6'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================================
// Path Building Helpers
// ============================================================================

/**
 * Build an SVG path for a boolean (digital) signal — step function.
 */
function buildBitPath(values: boolean[], width: number, _height: number): string {
  if (values.length === 0) return '';

  const n = values.length;
  const stepW = width / n;
  const hiY = TOP_Y;
  const loY = BASELINE_Y;

  const segments: string[] = [];

  for (let i = 0; i < n; i++) {
    const x = i * stepW;
    const nextX = (i + 1) * stepW;
    const y = values[i] ? hiY : loY;
    const nextY = i + 1 < n ? (values[i + 1] ? hiY : loY) : y;

    if (i === 0) {
      segments.push(`M ${x.toFixed(1)} ${y}`);
    }

    segments.push(`H ${nextX.toFixed(1)}`);

    // Vertical step at transition
    if (nextY !== y) {
      segments.push(`V ${nextY}`);
    }
  }

  return segments.join(' ');
}

/**
 * Build an SVG path for a numeric (bus) signal — scaled line.
 */
function buildNumericPath(values: number[], width: number, _height: number): string {
  if (values.length === 0) return '';

  const n = values.length;
  const stepW = width / Math.max(n - 1, 1);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Avoid division by zero

  const scaleY = (v: number) => {
    const normalized = (v - min) / range; // 0..1
    return BASELINE_Y - normalized * (BASELINE_Y - TOP_Y);
  };

  const points = values.map((v, i) => `${(i * stepW).toFixed(1)},${scaleY(v).toFixed(1)}`);

  return `M ${points.join(' L ')}`;
}

/**
 * Get X positions where bit signal transitions occur.
 */
function getTransitionXPositions(values: boolean[], width: number): number[] {
  const n = values.length;
  if (n < 2) return [];

  const stepW = width / n;
  const xs: number[] = [];

  for (let i = 1; i < n; i++) {
    if (values[i] !== values[i - 1]) {
      xs.push(i * stepW);
    }
  }

  return xs;
}

/**
 * Count the number of value transitions in a signal trace.
 */
function countTransitions(values: (boolean | number)[]): number {
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) count++;
  }
  return count;
}
