/**
 * The introduction: what this is, in two sentences.
 *
 * Opens itself on a first visit, and the map's "What is this?" reopens it after
 * that. Controlled from the outside for exactly that reason — the answer to
 * "what is this" is already written here, so the header link pointing at
 * simten.dev sent people off the site to read a worse version of it.
 *
 * The seen flag is written on dismissal rather than on open, so closing the tab
 * mid-read brings it back.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@simten/ui/primitives/dialog';
import { INTRO_SEEN_KEY, writeStored } from '../game/storage';

export function IntroDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dismiss = () => {
    writeStored(INTRO_SEEN_KEY, true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <img src="/favicon.svg" alt="" width={40} height={40} className="mb-3" />
          <DialogTitle className="text-2xl">TypeScript meets hardware</DialogTitle>
          <DialogDescription className="sr-only">What this is, and how it works.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Build a computer from logic gates, one layer of abstraction at a time.</p>
          <p>
            You do this by writing TypeScript rather than dragging wires. The circuit draws itself
            as you type.
          </p>
          <p>
            Take it as far as you like:{' '}
            <a
              href="https://simten.dev/blog/rv32i-cpu"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              CPUs that run C
            </a>
            ,{' '}
            <a
              href="https://simten.dev/blog/how-tpus-work"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              accelerators
            </a>
            ,{' '}
            <a
              href="https://simten.dev/blog/snake-in-hardware"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              games
            </a>
            . Then export to Verilog and flash your designs to real silicon on FPGAs.
          </p>
          <p>Good luck.</p>
        </div>

        <DialogFooter className="sm:items-end sm:justify-between">
          <a
            href="https://simten.dev"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Built on Simten, a TypeScript HDL ↗
          </a>
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
