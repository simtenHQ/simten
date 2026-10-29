/**
 * The circuit itself: the share's source text, compiled and simulated in the
 * sandbox iframe by `useSimulation`, drawn by `SimulationView`. Loaded as its
 * own chunk, in parallel with the share.
 */

import '@simten/react/styles.css';
import { SimulationView } from '@simten/react/embed';
import { useSimulation } from '@simten/react/sandbox';
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';

interface CircuitOptions {
  /** The share's source text. */
  source: string;
  theme: 'light' | 'dark';
  /** Show the clock controls for a sequential circuit. */
  controls: boolean;
}

function Circuit({ source, theme, controls }: CircuitOptions) {
  // The source text itself is simulated, so the behavior of anything it
  // defines runs exactly as written. The last circuit it builds is the one shown.
  const input = useMemo(() => ({ source }), [source]);
  const simulation = useSimulation(input, { harness: true, debounceMs: 0 });
  return (
    <div data-embed-theme={theme} style={{ height: '100%' }}>
      <SimulationView simulation={simulation} height="100%" showControls={controls} theme={theme} />
    </div>
  );
}

/** Renders the circuit into `container`. Call the result again to change the theme. */
export function mountCircuit(
  container: HTMLElement,
  options: CircuitOptions,
): (theme: 'light' | 'dark') => void {
  const root = createRoot(container);
  root.render(<Circuit {...options} />);
  return (theme) => root.render(<Circuit {...options} theme={theme} />);
}
