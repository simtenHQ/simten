/**
 * Fork: opens a circuit's source in the simten.dev editor, in a new tab. On
 * simten.dev it makes a short share link first (`ShareCircuitProvider`);
 * anywhere else the source travels in the URL.
 */

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../primitives/tooltip';
import { forkUrl } from './fork-url';
import { useShareCircuit } from './share-context';

/**
 * Where Fork links open: simten.dev, except in local development, where the
 * page itself is the editor's origin.
 */
function simtenHost(): string {
  if (typeof window === 'undefined') return 'https://simten.dev';
  return window.location.hostname === 'localhost' ? window.location.origin : 'https://simten.dev';
}

export interface ForkButtonProps {
  /** The source to open, read when the button is clicked. */
  source: () => string;
  className: string;
  tooltipSide?: 'top' | 'bottom';
}

export function ForkButton({ source, className, tooltipSide = 'top' }: ForkButtonProps) {
  const [forkError, setForkError] = useState<string | null>(null);
  const [forkPending, setForkPending] = useState(false);
  const shareCircuit = useShareCircuit();

  const onFork = async () => {
    if (forkPending) return;
    try {
      const text = source();
      setForkPending(true);
      const url = await forkUrl({ source: text, shareCircuit, host: simtenHost() });
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setForkError(err instanceof Error ? err.message : "Couldn't fork this circuit");
      setTimeout(() => setForkError(null), 3000);
    } finally {
      setForkPending(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onFork} className={`cursor-pointer ${className}`}>
            {forkError ? 'Fork failed' : forkPending ? 'Forking…' : 'Fork →'}
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>
          {forkError ?? 'Open and modify this circuit in the Simten editor'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
