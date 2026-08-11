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
import { TruthTable } from './TruthTable';

interface SpecPanelProps {
  level: Level;
  /** Read for the failing column only — the table is the whole verdict now. */
  result: GradeResult | null;
  /** Row currently being driven through the circuit by the victory run. */
  activeRow: number | null;
  /** How many rows the victory run has proven so far. */
  provenRows: number;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * What went wrong, in a sentence — for the failures a truth table cannot say.
 *
 * A red column expresses "your circuit computes the wrong thing" better than
 * prose does, so `vector` returns null and the table keeps that job. The other
 * four have nothing to redden: the circuit is missing, misnamed, uses a gate
 * the level forbids, or never ran. Those used to submit in silence, which read
 * as a broken button.
 *
 * Everything here comes off the failure itself — `GradeFailure` was written to
 * carry what the player needs to fix it, and then nothing displayed it.
 */
function explain(result: GradeResult | null): string | null {
  if (!result) return null;
  if (result.status === 'error') return result.message;
  if (result.status !== 'fail') return null;

  const f = result.failure;
  switch (f.kind) {
    case 'vector':
      return null;
    case 'missing-circuit':
      return f.found.length > 0
        ? `No circuit called \`${f.expected}\`. This file defines: ${f.found.join(', ')}.`
        : `No circuit called \`${f.expected}\`. Nothing is exported yet.`;
    case 'interface':
      return `This circuit has ${f.problems.join(', and ')}.`;
    case 'forbidden': {
      const plural = f.used.length > 1;
      return `${f.used.join(', ')} ${plural ? 'are' : 'is'} not allowed on this level. You have: ${f.allowed.join(', ')}.`;
    }
  }
}

export function SpecPanel({ level, result, activeRow, provenRows }: SpecPanelProps) {
  // Which column the grader stopped on. The failure carries the vector it was
  // given rather than its position, and matching on the inputs rather than on
  // object identity keeps this working if a verdict ever crosses postMessage.
  const failure = result?.status === 'fail' ? result.failure : null;
  const failedKey = failure?.kind === 'vector' ? JSON.stringify(failure.vector.inputs) : null;
  const failedAt =
    failedKey === null
      ? -1
      : level.vectors.findIndex((v) => JSON.stringify(v.inputs) === failedKey);
  const failedIndex = failedAt >= 0 ? failedAt : null;
  const reason = explain(result);

  return (
    <div className="flex h-full items-start gap-8 overflow-x-auto overflow-y-auto px-4 py-3">
      <div className="shrink-0">
        <Heading>Truth table</Heading>
        <TruthTable
          level={level}
          active={activeRow}
          proven={failedIndex ?? provenRows}
          failed={failedIndex}
        />
      </div>

      <div className="min-w-[220px] max-w-md shrink-0">
        <Heading>The problem</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">{level.brief}</p>
      </div>

      {reason && (
        <div className="min-w-[220px] max-w-md shrink-0">
          <Heading>Not yet</Heading>
          <p className="text-sm leading-relaxed text-amber-600 dark:text-amber-400">{reason}</p>
        </div>
      )}
    </div>
  );
}
