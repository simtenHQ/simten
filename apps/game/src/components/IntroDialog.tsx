/**
 * First-visit introduction.
 *
 * Someone arriving cold sees a list of level titles and no reason to care. This
 * says what the thing is in two sentences and gets out of the way.
 *
 * Shown once, then never again — the flag is written on dismissal rather than
 * on open, so closing the tab mid-read brings it back.
 *
 * It renders closed on the server and opens after mount. Reading storage during
 * render would either mismatch hydration or flash the dialog on every visit.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@simten/ui/primitives/dialog';
import { useEffect, useState } from 'react';
import { INTRO_SEEN_KEY, readStored, writeStored } from '../game/storage';

export function IntroDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!readStored(INTRO_SEEN_KEY, false)) setOpen(true);
  }, []);

  const dismiss = () => {
    writeStored(INTRO_SEEN_KEY, true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <img src="/favicon.svg" alt="" width={40} height={40} className="mb-3" />
          <DialogTitle className="text-2xl">Build a computer from one gate</DialogTitle>
          <DialogDescription className="sr-only">What this is, and how it works.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            You get one gate: NAND. Every other gate gets built out of it, and everything after that
            gets built out of those.
          </p>
          <p>
            You build by writing TypeScript rather than dragging wires, and the diagram draws itself
            as you type. The same code runs on a real FPGA.
          </p>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start building
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
