/**
 * WebComponentEmbed — bridge between code strings and the embed card.
 *
 * Internal to the web component registration. Not a public API.
 * Takes a `code` string (from the <circuit-embed> HTML attribute), compiles
 * and simulates it in the sandbox (isolated iframe, separate origin) with
 * `useSimulation`, and draws it in the same card `CircuitEmbed` uses.
 *
 * Security: code executes only inside the sandbox iframe, never in the main
 * frame. Only plain Circuit IR and port values cross the boundary.
 */

import { SandboxProvider, useSimulation } from '@simten/ui/sandbox';
import { useMemo } from 'react';
import { EmbedCard } from '../CircuitEmbed';
import { SimulationView } from '../CircuitViewer';

export interface WebComponentEmbedProps {
  code?: string;
  height?: number;
  showControls?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  href?: string;
  autoRunSpeed?: number;
  theme?: 'light' | 'dark';
}

function WebComponentEmbedInner({
  code,
  height,
  showControls,
  title,
  subtitle,
  description,
  href,
  autoRunSpeed,
  theme,
}: WebComponentEmbedProps) {
  // The source text itself is simulated, so the behavior of anything it
  // defines runs exactly as written. The last circuit it builds is the one shown.
  const source = useMemo(() => (code ? { source: code } : null), [code]);
  const simulation = useSimulation(source, { harness: true, debounceMs: 0 });

  if (!code) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-500">
        No circuit code provided
      </div>
    );
  }

  return (
    <div data-embed-theme={theme ?? 'dark'}>
      <EmbedCard
        height={height}
        title={title}
        subtitle={subtitle}
        description={description}
        href={href}
        forkSource={() => code}
      >
        <SimulationView
          simulation={simulation}
          height="100%"
          showControls={showControls}
          theme={theme}
          autoRunSpeed={autoRunSpeed}
        />
      </EmbedCard>
    </div>
  );
}

/** One sandbox per element, so several on a page can't trample each other. */
export function WebComponentEmbed(props: WebComponentEmbedProps) {
  return (
    <SandboxProvider>
      <WebComponentEmbedInner {...props} />
    </SandboxProvider>
  );
}
