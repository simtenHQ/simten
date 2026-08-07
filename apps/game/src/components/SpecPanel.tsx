/**
 * The level spec, docked under the editor and canvas.
 *
 * It used to be a third vertical column, which meant paying a third of the
 * width for a four-row table and leaving a tall empty gap beneath it. Full
 * width and short suits the content better: the truth table, the constraints
 * and the verdict sit side by side instead of stacking down a narrow strip.
 *
 * Docked rather than overlaid on purpose. The truth table is the thing you
 * glance at constantly while writing, so anything covering the diagram would
 * be opened and closed all day. Same arrangement `/circuit` uses for the
 * waveform viewer, so the two read as one product.
 */

import type { GradeResult, Level } from '../game/types';
import { GradeReport } from './GradeReport';
import { TruthTable } from './TruthTable';

interface SpecPanelProps {
  level: Level;
  result: GradeResult | null;
  /** Row currently being driven through the circuit by the victory run. */
  activeRow: number | null;
  /** How many rows the victory run has proven so far. */
  provenRows: number;
  /** Hold the score back until the run has finished demonstrating it. */
  revealVerdict: boolean;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

export function SpecPanel({ level, result, activeRow, provenRows, revealVerdict }: SpecPanelProps) {
  return (
    <div className="flex h-full items-start gap-8 overflow-x-auto overflow-y-auto px-4 py-3">
      <div className="shrink-0">
        <Heading>Must produce</Heading>
        <TruthTable level={level} active={activeRow} proven={provenRows} />
      </div>

      <div className="min-w-[220px] max-w-md shrink-0">
        <Heading>The problem</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">{level.brief}</p>
      </div>

      {/* Failures only. A pass gets the completion dialog, and the header keeps
          a persistent "Solved · N" chip that reopens it — repeating the score
          here as well would be the third place saying the same thing. */}
      {result && result.status !== 'pass' && (
        <div className="min-w-[260px] shrink-0">
          <GradeReport result={result} level={level} revealed={revealVerdict} />
        </div>
      )}
    </div>
  );
}
