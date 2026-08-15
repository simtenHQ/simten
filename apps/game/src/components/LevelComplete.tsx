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
   * What the next level lets you use that this one did not, and the full set it
   * joins.
   *
   * Both derived, so the card can only ever name something the grader accepts
   * and the editor offers — a hardcoded "unlocked!" would be a promise the game
   * does not keep.
   */
  const unlocked = gatesGainedAfter(level, next);
  const owned = next?.allowed ?? level.allowed;

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

        {/* What you leave with, as things rather than a sentence about things.
            The row grows by one on each of the first seven levels, so the
            reward is watching the set fill up — which a line of prose saying
            "Xor unlocked" cannot do.

            The last three levels add no gate; they add a circuit. Showing that
            keeps the block in place without pretending a part changed hands,
            and "built" rather than "unlocked" is deliberate: the campaign does
            not let a later level reuse your HalfAdder, so claiming an unlock
            would promise something the grader rejects. */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {unlocked.length > 0 ? 'Your gates' : 'You built'}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {(unlocked.length > 0 ? owned : [level.target]).map((name) => (
              <li
                key={name}
                className={
                  unlocked.length === 0 || unlocked.includes(name)
                    ? 'rounded border border-emerald-600/40 bg-emerald-500/10 px-2 py-1 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400'
                    : 'rounded border border-border px-2 py-1 font-mono text-xs text-muted-foreground'
                }
              >
                {name}
              </li>
            ))}
          </ul>
        </div>

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
               gets. Sending them back to a map of levels they have already
               solved wastes it. `/circuit` opens on the example catalog —
               Snake, a RISC-V computer, npm output baked into a ROM — so the
               next thing they see is the range, and they pick. */
            <a
              href="https://simten.dev/circuit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              More demos →
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
