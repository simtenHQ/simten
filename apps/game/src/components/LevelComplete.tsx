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
import type { Level } from '../game/types';

interface LevelCompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: Level;
  gates: number;
  /** The level after this one, or undefined at the end of the campaign. */
  next: Level | undefined;
  /** Position in the campaign, for the "3 of 4" line. */
  position: number;
  total: number;
}

export function LevelComplete({
  open,
  onOpenChange,
  level,
  gates,
  next,
  position,
  total,
}: LevelCompleteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogDescription className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {level.title} · {position} of {total}
          </DialogDescription>
          <DialogTitle className="text-2xl">{level.outro.headline}</DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">{level.outro.body}</p>

        <div className="flex items-baseline gap-2 rounded-lg border border-border bg-card/60 px-4 py-3">
          <span className="font-mono text-3xl font-semibold tabular-nums leading-none">
            {gates}
          </span>
          <span className="text-xs text-muted-foreground">
            {gates === 1 ? 'gate' : 'gates'} used
          </span>
        </div>

        <DialogFooter>
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
              to="/play/$levelId"
              params={{ levelId: next.id }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              Next: {next.title} →
            </Link>
          ) : (
            <Link
              to="/play"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              That is the last one — back to the levels
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
