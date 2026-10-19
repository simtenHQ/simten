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

import { useState } from 'react';
import { explain } from '../game/explain';
import { readNumbers } from '../game/numbers';
import { givenParts } from '../game/parts';
import type { GradeResult, Level } from '../game/types';
import { TruthTable } from './TruthTable';

interface SpecPanelProps {
  level: Level;
  /** Read for the failing column only; the table is the whole verdict now. */
  result: GradeResult | null;
  /** Row currently being driven through the circuit by the victory run. */
  activeRow: number | null;
  /** How many rows the victory run has proven so far. */
  provenRows: number;
  /** A submit is being graded, or a pass is still sweeping the table. */
  checking: boolean;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** The chip a gate name wears, shared by the allowed list and inline prose. */
const CHIP = 'rounded border border-border px-1.5 py-0.5 font-mono text-xs text-foreground';

/**
 * Prose with `backticked` names rendered as chips.
 *
 * Briefs and failure messages both name gates, ports and circuits in
 * backticks. Rendered as plain text the backticks showed up literally; drawn
 * as the same chip the allowed-gates list uses, "make an `OR` gate" points at
 * the thing sitting in that list, so the two read as one instruction.
 */
function Prose({ text, className }: { text: string; className: string }) {
  return (
    <p className={className}>
      {text.split(/`([^`]+)`/).map((part, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no id
          <code key={i} className={`${CHIP} mx-0.5`}>
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function SpecPanel({ level, result, activeRow, provenRows, checking }: SpecPanelProps) {
  // The column the grader stopped on: it reports the step's position, because
  // on a sequential level the same inputs can appear at several steps.
  const failure = result?.status === 'fail' ? result.failure : null;
  const failedIndex = failure?.kind === 'vector' ? failure.index : null;
  const reason = explain(result, level);
  const parts = givenParts(level);
  // Which column the decimal footnote reads: the one under the pointer, or
  // failing that the one the grader stopped on.
  const [hovered, setHovered] = useState<number | null>(null);
  const focus = hovered ?? failedIndex;
  const asNumbers = focus === null ? null : readNumbers(level, level.vectors[focus]);
  return (
    <div className="h-full overflow-x-auto overflow-y-auto px-6 py-4">
      {/* Four equal columns across the sheet. They sit inside its padding, so
          the first-level tour's spotlight still has a visible frame (it had none
          when this ran to the screen's edges). */}
      <div
        data-tour="spec"
        className="grid h-full w-full grid-cols-[repeat(4,minmax(200px,1fr))] divide-x divide-border [&>*]:px-6 [&>*:first-child]:pl-0"
      >
        <div>
          <Heading>Goal</Heading>
          <Prose
            text={level.brief}
            className="max-w-md text-[13px] leading-relaxed text-muted-foreground"
          />
        </div>

        <div>
          {/* A sequential level's rows are ordered steps, not independent cases.
            Calling that a truth table would tell the player order does not
            matter, when order is the entire lesson. */}
          <Heading>{level.sequential ? 'Sequence' : 'Truth table'}</Heading>
          <TruthTable
            level={level}
            active={activeRow}
            proven={failedIndex ?? provenRows}
            failed={failedIndex}
            onHover={setHovered}
          />
          {/* Footnote: how to read the table. */}
          <p className="mt-1.5 max-w-[240px] text-[11px] text-muted-foreground">
            {level.sequential
              ? 'Each column is one tick of the clock, read left to right.'
              : 'Expected outputs for each input combination.'}
          </p>
          {/* Rows of bits are hard to check by eye, so arithmetic levels read
              one column back in decimal. */}
          {level.numbers && (
            <p className="mt-0.5 max-w-[240px] font-mono text-[11px] text-muted-foreground">
              {asNumbers ?? 'Hover a column to read it as numbers.'}
            </p>
          )}
        </div>

        {/* What you may build with, stated up front. It used to appear only in
          the `forbidden` failure message, so the way to find out what a level
          permits was to use something it did not. The unlock line on the
          previous level's completion card promises a gate; this is where that
          promise is visible on arrival. */}
        <div>
          <Heading>You can use</Heading>
          <ul className="flex max-w-[240px] flex-wrap gap-1.5">
            {level.allowed.map((name) => (
              <li key={name} className={CHIP}>
                {name}
              </li>
            ))}
          </ul>
          {/* Parts the starter code hands over. They were invisible here, so a
              list of gates read as "only these", with a finished adder sitting
              at the top of the editor. */}
          {parts.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 text-[11px] text-muted-foreground">
                And these parts, finished, at the top of your code:
              </p>
              <ul className="flex max-w-[240px] flex-wrap gap-1.5">
                {parts.map((name) => (
                  <li key={name} className={CHIP}>
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* What the last submit said. Always here, so a verdict never moves the
            rest of the sheet or turns up somewhere new; a wrong output also
            reddens its column in the table. */}
        <div>
          <Heading>Feedback</Heading>
          {checking ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">Checking…</p>
          ) : reason ? (
            <Prose
              text={reason}
              className="max-w-md text-[13px] leading-relaxed text-amber-600 dark:text-amber-400"
            />
          ) : result?.status === 'pass' ? (
            <p className="text-[13px] leading-relaxed text-emerald-600 dark:text-emerald-400">
              Passed, using {result.gates} {result.gates === 1 ? 'gate' : 'gates'}.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Press Submit to check your circuit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
