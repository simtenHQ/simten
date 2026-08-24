/**
 * Clock-port classification.
 *
 * A port is treated as the module's clock when every consumer of its net is a
 * clock pin. Two things used to break that for reasons unrelated to clocking:
 *
 *   - a `$display` in a clocked block, which yosys lowers to a `$print` cell
 *     whose trigger hangs off the clock net. The importer already drops those
 *     when lifting, but they still counted as data consumers first.
 *   - a submodule taking a clock it never reads, which left the port with no
 *     consumers at all and so never classified — disqualifying the clock of
 *     every module above it.
 *
 * Both were found by importing a real NES core (strigeus/fpganes), where the
 * simplest mapper takes an unused `clk` and the PPU logs with `$display`.
 * Between them they failed the whole import.
 *
 * The assertions are behavioural: a register that latched every tick regardless
 * of the clock would satisfy a structural check just as happily.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFromIR } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import type { YosysNetlist } from '../index.js';
import { importNetlist } from '../index.js';

function build() {
  const netlist: YosysNetlist = JSON.parse(
    readFileSync(new URL('../__fixtures__/clock-classification.json', import.meta.url), 'utf8'),
  );
  const result = importNetlist(netlist, 'clock_classification');
  const deps = [...result.library.values()].filter((c) => c.name !== result.top.name);
  return { result, sim: simulate(buildFromIR(result.top, deps) as never) };
}

describe('clock classification', () => {
  it('imports a design that logs with $display and has an unused child clock', () => {
    expect(() => build()).not.toThrow();
  });

  it('drops the clock port rather than leaving it as data', () => {
    const { result } = build();
    expect(result.top.inputs.map((p) => p.name)).not.toContain('clk');
    expect(result.warnings.some((w) => w.includes("Dropped clock port 'clk'"))).toBe(true);
  });

  it('reports the dropped $display instead of swallowing it', () => {
    const { result } = build();
    expect(result.warnings.some((w) => /\$display/.test(w))).toBe(true);
  });

  it('the register still latches on the clock', () => {
    const { sim } = build();
    try {
      sim.set({ d: 0x5a } as never);
      sim.tick();
      expect(sim.get('latched' as never)).toBe(0x5a);

      // Changing d without a tick must not reach the register.
      sim.set({ d: 0x11 } as never);
      expect(sim.get('latched' as never)).toBe(0x5a);

      sim.tick();
      expect(sim.get('latched' as never)).toBe(0x11);
    } finally {
      sim.dispose();
    }
  });

  it('the child with the unused clock still works', () => {
    const { sim } = build();
    try {
      sim.set({ d: 0x0f } as never);
      sim.tick();
      // Combinational inverter: unaffected by the clock it never reads.
      expect(sim.get('inverted' as never)).toBe(0xf0);
    } finally {
      sim.dispose();
    }
  });
});
