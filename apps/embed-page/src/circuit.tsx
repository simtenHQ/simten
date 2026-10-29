/**
 * The circuit itself: the share's source text, compiled and simulated in the
 * sandbox iframe by `useSimulation`, drawn by `CircuitCanvas` with
 * `ClockControls` under it. Loaded as its own chunk, in parallel with the share.
 */

import '@simten/react/styles.css';
import { CircuitCanvas, ClockControls, useSimulation } from '@simten/react';
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
  const simulation = useSimulation(input);
  const { ready } = simulation.state;
  return (
    <div data-embed-theme={theme} style={{ height: '100%' }}>
      {ready ? (
        <div style={{ height: '100%' }} className="flex flex-col" data-embed-theme={theme}>
          <div className="flex-1 min-h-0">
            <CircuitCanvas simulation={simulation} theme={theme} />
          </div>
          {controls && <ClockControls simulation={simulation} />}
        </div>
      ) : (
        // Its own loading and error states.
        <CircuitCanvas simulation={simulation} />
      )}
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
