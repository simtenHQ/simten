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
  /** The level after this one, or undefined at the end of the campaign. */
  next: Level | undefined;
}

export function LevelComplete({ open, onOpenChange, level, next }: LevelCompleteProps) {
  /**
   * What the next level lets you use that this one did not.
   *
   * Derived rather than authored, so it can only ever name something the grader
   * will actually accept and the editor will actually offer. When no level
   * grants anything new it renders nothing, which is the honest result — a
   * hardcoded "unlocked!" would be a promise the game does not keep.
   */
  const unlocked = next ? next.allowed.filter((name) => !level.allowed.includes(name)) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">{level.outro.headline}</DialogTitle>
        </DialogHeader>

        {/* The body doubles as the dialog's accessible description. Radix warns
            when a DialogContent has none, and this is the text that describes
            it — a separate sr-only line would say the same thing twice. */}
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          {level.outro.body}
        </DialogDescription>

        {unlocked.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {unlocked.join(', ')}
            </span>{' '}
            unlocked — you can use {unlocked.length === 1 ? 'it' : 'them'} from here on.
          </p>
        )}

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
              to="/"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline"
            >
              That is the last one — back to the map
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
