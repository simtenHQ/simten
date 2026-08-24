import { useCircuitSimulator } from '@simten/embed';
import { CircuitCanvas } from '@simten/ui/canvas';
import { useMemo, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { buildVoice, DEFAULT_ENV_STEP, WAVES } from '../circuits';
import { Scope } from '../Scope';
import { useLiveVoice } from '../useLiveVoice';

const LABELS: Record<(typeof WAVES)[number], string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  saw: 'Saw',
};

/** Enough ticks to move the counters visibly without blurring past them. */
const STEP_TICKS = 64;

export function PlayerSection() {
  const [wave, setWave] = useState(3); // saw
  const [decay, setDecay] = useState(DEFAULT_ENV_STEP);

  // Passed explicitly: the canvas otherwise sniffs a `dark` class off <html>,
  // and this app tracks theme in a provider instead — so it rendered light on
  // a dark page.
  const { resolvedTheme } = useTheme();

  const voice = useMemo(() => buildVoice(), []);
  const sim = useCircuitSimulator(voice, { autoHarness: false });
  const { playing, toggle, scope } = useLiveVoice(sim, { wave, decay });

  return (
    <section className="py-12">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Watch it make the sound
      </h2>
      <div className="prose-invert space-y-6">
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          One simulation drives everything below. The trace is the circuit&rsquo;s{' '}
          <code>audio</code> output, sample by sample; the speakers are fed from the same net. Not a
          visualisation of the sound &mdash; the sound.
        </p>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Both controls are <strong>input ports on the circuit</strong>, not settings in the page.
          Changing one sets a signal on the next clock tick &mdash; nothing recompiles, nothing
          reloads. The same two ports exist when this is exported to Verilog, so the knobs survive
          onto an FPGA.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="h-[520px] bg-gray-50 dark:bg-gray-950">
          <CircuitCanvas
            circuit={voice.circuit}
            componentLibrary={sim.componentLibrary ?? undefined}
            portValues={sim.portValues}
            sequentialState={sim.sequentialState}
            draggable={false}
            autoLayout
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <Scope samples={scope} className="w-full h-24 block" />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            audio &mdash; {sim.cycleCount.toLocaleString()} ticks elapsed
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              disabled={!sim.ready}
              className="px-5 py-2.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {playing ? 'Stop' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => sim.tickN(STEP_TICKS)}
              disabled={playing || !sim.ready}
              className="px-4 py-2.5 rounded-md border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Step {STEP_TICKS}
            </button>

            <div className="ml-auto flex flex-wrap gap-2">
              {WAVES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWave(i)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    wave === i
                      ? 'border-blue-500 bg-blue-500/10 text-gray-900 dark:text-white'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  {LABELS[name]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm items-center">
            <div className="flex items-center gap-3">
              <code className="text-gray-500 dark:text-gray-400 shrink-0">wave</code>
              <span className="font-mono text-gray-900 dark:text-white tabular-nums">
                {wave.toString(2).padStart(2, '0')}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                high address bits into the ROM
              </span>
            </div>
            <label className="flex items-center gap-3">
              <code className="text-gray-500 dark:text-gray-400 shrink-0">decay</code>
              <input
                type="range"
                min={1}
                max={60}
                value={decay}
                onChange={(e) => setDecay(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="font-mono text-gray-900 dark:text-white tabular-nums w-7 text-right">
                {decay}
              </span>
            </label>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        All four waveforms live in one ROM, laid end to end, and <code>wave</code> supplies the two
        high address bits &mdash; so picking a timbre is choosing which bank the phase accumulator
        reads from. Each table is band-limited: only the harmonics that fit under the Nyquist
        frequency are summed. Generate a sawtooth the naive way at 22 kHz and its upper harmonics
        fold back down as inharmonic clangour, which is a property of the table rather than of the
        circuit.
      </p>
    </section>
  );
}
