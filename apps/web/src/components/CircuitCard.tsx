/**
 * The card a circuit sits in on simten.dev's blog, docs and landing page: the
 * canvas, its clock controls, an optional title bar, and a Fork button that
 * opens the circuit in the editor.
 *
 * `CircuitCard` simulates a circuit itself. A page that drives the circuit or
 * reads its values calls `useSimulation` and passes the result to
 * `SimulationCard` instead.
 */

import type { Circuit, InputKey } from '@simten/core';
import { circuitToSource } from '@simten/core/internal';
import {
  CircuitCanvas,
  ClockControls,
  type UseSimulationResult,
  useSimulation,
} from '@simten/react';
import { ForkButton } from '@simten/shared/fork';
import type { CSSProperties, ReactElement } from 'react';
import { useTheme } from '@/components/ThemeProvider';

type Position = { x: number; y: number };

/**
 * Node positions. A circuit with ports is drawn with a switch on each input
 * port and a lamp on each output, named after the ports, around the circuit
 * itself as `dut`. A circuit without ports is drawn as it is, so its own nodes
 * are placed.
 */
type CardLayout<C extends Circuit> =
  C extends Circuit<infer Ins, infer Outs, infer Ns>
    ? Partial<Record<keyof Ins | keyof Outs | keyof Ns | 'dut', Position>>
    : Record<string, Position>;

interface CardChrome {
  /**
   * Container height. When omitted, the card sizes itself to its width, at
   * an aspect ratio inferred from `layout` (3:2 without one), clamped for
   * small screens.
   */
  height?: number | string;
  /** Show the clock controls for a sequential circuit. @default true */
  showControls?: boolean;
  title?: string;
  description?: string;
}

interface CircuitCardProps<C extends Circuit> extends CardChrome {
  circuit: C;
  layout?: CardLayout<C>;
  /** Where the inputs start, and where reset puts them back. */
  initialInputs?: Partial<Record<InputKey<C>, number>>;
  /** The source Fork opens. Defaults to the circuit turned back into source. */
  forkSource?: string;
}

interface SimulationCardProps extends CardChrome {
  simulation: UseSimulationResult;
  layout?: Record<string, Position>;
  /** The source Fork opens, read when it's clicked. */
  forkSource: () => string;
}

// Approximate node footprint used when inferring aspect ratio from a layout.
// Layout coords are top-left of each node, so we add ~one node's width/height
// to the bounding box so the rightmost / bottommost nodes aren't clipped.
const NODE_W = 160;
const NODE_H = 90;

function inferAspectFromLayout(layout: Record<string, Position> | undefined): number {
  if (!layout) return 1.5; // default 3:2, sane for auto-laid-out circuits
  const positions = Object.values(layout);
  if (positions.length === 0) return 1.5;
  const w = Math.max(...positions.map((p) => p.x)) + NODE_W;
  const h = Math.max(...positions.map((p) => p.y)) + NODE_H;
  if (w <= 0 || h <= 0) return 1.5;
  return w / h;
}

export function CircuitCard<C extends Circuit>({
  circuit,
  layout,
  forkSource,
  initialInputs,
  ...chrome
}: CircuitCardProps<C>): ReactElement {
  const simulation = useSimulation(circuit as Circuit, { initialInputs });
  return (
    <SimulationCard
      simulation={simulation}
      layout={layout as Record<string, Position> | undefined}
      forkSource={() => forkSource ?? circuitToSource(circuit)}
      {...chrome}
    />
  );
}

export function SimulationCard({
  simulation,
  height,
  showControls = true,
  layout,
  title,
  description,
  forkSource,
}: SimulationCardProps): ReactElement {
  const { resolvedTheme } = useTheme();
  const hasInfoBar = title || description;

  // Sizing: a given `height`, or width-responsive by aspect ratio with clamps.
  const responsiveStyle: CSSProperties = {
    width: '100%',
    aspectRatio: String(inferAspectFromLayout(layout)),
    minHeight: 240,
    maxHeight: '70vh',
  };
  const outerStyle: CSSProperties | undefined = hasInfoBar
    ? undefined
    : height === undefined
      ? responsiveStyle
      : { height };
  const canvasStyle: CSSProperties = hasInfoBar
    ? height === undefined
      ? responsiveStyle
      : { height }
    : { height: '100%' };

  const { state } = simulation;

  return (
    <div
      style={outerStyle}
      className={`relative flex flex-col ${hasInfoBar ? 'rounded-xl border border-[var(--embed-border)] overflow-hidden bg-[var(--embed-bg-secondary)]' : ''}`}
    >
      {!hasInfoBar && (
        <ForkButton
          source={forkSource}
          tooltipSide="bottom"
          className="absolute top-2 right-2 z-10 hidden md:flex items-center px-2.5 py-1 rounded border border-[var(--embed-border)] bg-[var(--embed-bg-secondary)] text-[11px] text-[var(--embed-text-primary)] hover:opacity-80 transition-colors shadow-sm"
        />
      )}
      <div style={canvasStyle} className="min-h-0">
        {state.ready ? (
          <div
            style={{ height: '100%' }}
            className="flex flex-col"
            data-embed-theme={resolvedTheme}
          >
            <div className="flex-1 min-h-0">
              <CircuitCanvas simulation={simulation} layout={layout} />
            </div>
            {showControls && <ClockControls simulation={simulation} />}
          </div>
        ) : (
          // Its own loading and error states.
          <CircuitCanvas simulation={simulation} />
        )}
      </div>
      {hasInfoBar && (
        <div className="border-t border-[var(--embed-border)] px-4 py-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-[var(--embed-text-primary)]">{title}</div>
            {description && (
              <div className="text-sm text-[var(--embed-text-secondary)] mt-1.5 leading-relaxed">
                {description}
              </div>
            )}
          </div>
          <ForkButton
            source={forkSource}
            tooltipSide="top"
            className="hidden md:flex items-center shrink-0 px-3 py-1.5 rounded border border-[var(--embed-border)] text-xs text-[var(--embed-text-primary)] hover:opacity-80 transition-colors"
          />
        </div>
      )}
    </div>
  );
}
