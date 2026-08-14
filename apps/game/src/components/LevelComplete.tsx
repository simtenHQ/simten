/**
 * The moment a level is finished.
 *
 * Deliberately arrives *after* the victory run, not instead of it. The run —
 * switches flipping, lamp following the truth table — is the proof; this is the
 * receipt. Opening a dialog over a circuit still demonstrating itself would
 * step on the better of the two.
 *
 * Dismissible on purpose. `par` only means something if you can close this,
 * go back, and try to beat it — a completion screen whose only exit is "next"
 * quietly says optimising was never the point.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@simten/ui/primitives/dialog';
import { Link } from '@tanstack/react-router';
import { gatesGainedAfter } from '../game/levels';
import type { Level } from '../game/types';

interface LevelCompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: Level;
  /** The level after this one, or undefined at the end of the campaign. */
  next: Level | undefined;
}

export function LevelComplete({ open, onOpenChange, level, next }: LevelCompleteProps) {
  /**
   * What the next level lets you use that this one did not.
   *
   * Derived rather than authored, so it can only ever name something the grader
   * will actually accept and the editor will actually offer — a hardcoded
   * "unlocked!" would be a promise the game does not keep. Where the level
   * grants no gate, `outro.reward` says what was gained instead, so the card
   * keeps its shape for all ten levels rather than for the middle six.
   */
  const unlocked = gatesGainedAfter(level, next);
  const reward = unlocked.length > 0 ? null : level.outro.reward;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 sm:max-w-lg">
        <DialogHeader className="space-y-2">
          {/* Fixed text, not the level name. `{level.title} solved` reads
              "NOT SOLVED" on the NOT level and "AND SOLVED" on the next one:
              the titles are gate names, so appending a past participle turns
              half of them into a denial of the thing that just happened. */}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Level complete
          </p>
          <DialogTitle className="text-2xl leading-tight">{level.outro.headline}</DialogTitle>
        </DialogHeader>

        {/* The body doubles as the dialog's accessible description. Radix warns
            when a DialogContent has none, and this is the text that describes
            it — a separate sr-only line would say the same thing twice. */}
        <DialogDescription className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {level.outro.body}
        </DialogDescription>

        {/* The reward, given its own block rather than trailing the prose as
            another grey paragraph. Earning a gate is the one thing on this card
            that changes what you can do next, so it should not read as a
            footnote to the text above it. */}
        {(unlocked.length > 0 || reward) && (
          <div className="mt-5 rounded-md border border-emerald-600/25 bg-emerald-500/[0.06] px-3 py-2.5">
            <p className="text-sm leading-relaxed text-foreground">
              {unlocked.length > 0 ? (
                <>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {unlocked.join(', ')}
                  </span>{' '}
                  unlocked. You can use {unlocked.length === 1 ? 'it' : 'them'} from here on.
                </>
              ) : (
                reward
              )}
            </p>
          </div>
        )}

        <DialogFooter className="mt-6 gap-2">
          {/* Closing is a real choice, not a dismissal: it is how you go back
              and try to beat par. */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Back to the circuit
          </button>
          {next ? (
            <Link
              to="/$levelId"
              params={{ levelId: next.id }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              Next: {next.title} →
            </Link>
          ) : (
            /* End of the campaign, and the highest-intent moment the game
               gets: someone has just built an adder out of NANDs and knows
               what it cost. Sending them back to a map of levels they have
               already solved wastes it. The editor is where the same language
               stops being a puzzle and starts being a tool. */
            <a
              href="https://simten.dev/circuit?example=rv32i-computer"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              See where this goes →
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
