/**
 * A level's one-time explainer.
 *
 * For the moment a band introduces something the player cannot find on screen.
 * The clock is the case that forced it: at Toggle a flip-flop starts advancing
 * on edges the player never wires, from a clock they never placed, driven by
 * controls that appear for the first time in the campaign. Everything else in
 * the game is discoverable by reading the diagram; that is not.
 *
 * Shown before the level rather than after, unlike `LevelComplete`; this is
 * the thing you need in order to start.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@simten/ui/primitives/dialog';
import type { Level } from '../game/types';

/**
 * `**bold**`, and nothing else.
 *
 * A level is data that could be fetched as plain JSON, so its copy stays a
 * string rather than becoming markup, but the two words this dialog exists to
 * teach deserve to stand out from the paragraph explaining them. One delimiter,
 * parsed here, is cheaper than a markdown dependency and cannot grow into one
 * by accident.
 */
function withEmphasis(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    // Odd indices are the captured groups, so they are the emphasised runs.
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity in a split string
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

export function LevelIntro({
  level,
  open,
  onDismiss,
}: {
  level: Level;
  open: boolean;
  onDismiss: () => void;
}) {
  if (!level.intro) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      {/* `hidden md:grid` for the same reason the spec sheet needs it: the
          portal escapes <DesktopOnly>, and the open effect does not check
          the viewport. */}
      <DialogContent className="hidden md:grid gap-0 sm:max-w-lg">
        <DialogHeader className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Something new
          </p>
          <DialogTitle className="text-2xl leading-tight">{level.intro.headline}</DialogTitle>
        </DialogHeader>

        <DialogDescription className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {withEmphasis(level.intro.body)}
        </DialogDescription>

        {level.intro.link && (
          <p className="mt-4 text-xs text-muted-foreground">
            Read more:{' '}
            <a
              href={level.intro.link.href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {level.intro.link.label} ↗
            </a>
          </p>
        )}

        <DialogFooter className="mt-6">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Got it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
