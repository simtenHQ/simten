/**
 * The APU's mixer. On the chip it is analog: the pulse channels share one
 * nonlinear DAC and triangle, noise and DMC another, which the NESdev wiki
 * models as
 *
 *   pulse = 95.88 / (8128 / (p1 + p2) + 100)
 *   tnd   = 159.79 / (1 / (t / 8227 + n / 12241 + d / 22638) + 100)
 *
 * The digital stand-in is the wiki's two lookup tables, a close fit to those:
 * pulse[p1 + p2] = 95.52 / (8128 / i + 100) and tnd[3t + 2n + d] =
 * 163.67 / (24329 / i + 100). Their sum, 0 to ~1, comes out as an unsigned
 * 16-bit sample.
 */

import { bus, circuit, mem } from '@simten/core';
import { romFromWords } from '@simten/core/std';

/** Full scale: the loudest possible sum, ~1.0003, stays under 65536. */
const SCALE = 65000;

/** The two tables, as 16-bit samples. */
export function mixerTables(): { pulse: number[]; tnd: number[] } {
  const pulse = Array.from({ length: 32 }, (_, i) =>
    i === 0 ? 0 : Math.round((95.52 / (8128 / i + 100)) * SCALE),
  );
  const tnd = Array.from({ length: 256 }, (_, i) =>
    i === 0 ? 0 : Math.round((163.67 / (24329 / i + 100)) * SCALE),
  );
  return { pulse, tnd };
}

const tables = mixerTables();

/** How `eval` sees a memory: indexable, 0 where unset. */
type Table = Map<number, number> & Record<number, number>;

interface MixerIn {
  p1: number;
  p2: number;
  t: number;
  n: number;
  d: number;
  pulse: Table;
  tnd: Table;
}

export const ApuMixer = circuit('ApuMixer', {
  inputs: { p1: bus(4), p2: bus(4), t: bus(4), n: bus(4), d: bus(7) },
  outputs: { audio: bus(16) },
  state: {
    pulse: mem(32, 16, romFromWords(tables.pulse, 16)),
    tnd: mem(256, 16, romFromWords(tables.tnd, 16)),
  },
  eval: ({ p1, p2, t, n, d, pulse, tnd }: MixerIn) => ({
    audio: (pulse[p1 + p2] + tnd[3 * t + 2 * n + d]) & 0xffff,
  }),
  onTick: ({ pulse, tnd }: MixerIn) => ({ pulse, tnd }),
  meta: { category: 'io', icon: 'MIX', description: 'NES APU mixer' },
});
