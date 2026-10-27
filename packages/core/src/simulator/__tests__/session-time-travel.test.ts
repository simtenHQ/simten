/**
 * Time-travel for stateful display components.
 *
 * The editor's stepBack/stepForward reads circuit state back through a
 * `Simulation` with history (which drives the engine's snapshot/restore).
 * Registers and wires are observed via port values; memory (RAM) and text
 * (Console/UART) are observed via the engine's *sequential state*, which
 * `nodesOf(sim).peripherals()` reports for nodes on a peripheral bus.
 *
 * Regression: `getState()` (sequential state) and `getPortValues()` share one
 * `cacheValid` flag. `restore()` invalidated the flag but didn't clear the
 * cached sequential state, and a read of port values before sequential state
 * re-validated the flag, so `getState()` handed back the pre-restore (latest)
 * state. Result: registers rewound under time-travel but RAM framebuffers and
 * console text did not. These tests drive the real history path and assert
 * both kinds of state rewind.
 */
import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { Console, RAM } from '../../std/index.js';
import { simulate } from '../simulate.js';
import { nodesOf, type Simulation } from '../simulation.js';

/**
 * A RAM framebuffer plus a text Console — the two state shapes that broke.
 * The RAM drives a second Console, which puts it on a peripheral bus.
 */
const Probe = circuit('TimeTravelProbe', {
  inputs: { addr: bus(8), data_in: bus(8), we: bit, ch: bus(8), ch_we: bit },
  outputs: { data_out: bus(8) },
  nodes: { ram: RAM(), con: Console, mon: Console },
  connect: ({ inputs, outputs, nodes: { ram, con, mon } }) => [
    inputs.addr.to(ram.addr),
    inputs.data_in.to(ram.data_in),
    inputs.we.to(ram.we),
    ram.data_out.to(outputs.data_out, mon.data),
    inputs.ch.to(con.data),
    inputs.ch_we.to(con.we),
  ],
});

function ramFrame(sim: Simulation): number[] {
  // Port values first, then sequential state: the order that exposed the bug.
  nodesOf(sim).ports();
  const mem = nodesOf(sim).peripherals().get('ram');
  if (!(mem instanceof Map)) throw new Error('ram is not on the peripheral bus');
  return Array.from({ length: 8 }, (_, i) => mem.get(i) ?? 0);
}

function consoleText(sim: Simulation): string {
  nodesOf(sim).ports();
  const text = nodesOf(sim).peripherals().get('con');
  return typeof text === 'string' ? text : '';
}

describe('time-travel — stateful display components', () => {
  it('stepBack/stepForward rewinds a RAM framebuffer and console text', () => {
    const sim = simulate(Probe, { history: 200 });

    // Tick 8 times: write pixel i = i+1 to address i, and append char 'A'+i.
    const ramFrames: number[][] = [ramFrame(sim)];
    const texts: string[] = [consoleText(sim)];
    for (let i = 0; i < 8; i++) {
      sim.set({ addr: i, data_in: i + 1, we: 1, ch: 65 + i, ch_we: 1 }); // 'A'..'H'
      sim.tick();
      ramFrames.push(ramFrame(sim));
      texts.push(consoleText(sim));
    }

    // Sanity: state actually accumulated.
    expect(ramFrames[8]).not.toEqual(ramFrames[3]);
    expect(texts[8]).toBe('ABCDEFGH');
    expect(sim.history.index).toBe(8);

    // Step back to frame 3 — both RAM and console must rewind.
    while (sim.history.index > 3) sim.stepBack();
    expect(sim.history.index).toBe(3);
    expect(ramFrame(sim)).toEqual(ramFrames[3]);
    expect(consoleText(sim)).toBe('ABC');

    // Step forward — both advance again.
    sim.stepForward();
    expect(ramFrame(sim)).toEqual(ramFrames[4]);
    expect(consoleText(sim)).toBe('ABCD');
  });

  it('seeking directly to an index rewinds sequential state', () => {
    const sim = simulate(Probe, { history: 200 });
    const frames: number[][] = [ramFrame(sim)];
    for (let i = 0; i < 6; i++) {
      sim.set({ addr: i, data_in: i + 10, we: 1 });
      sim.tick();
      frames.push(ramFrame(sim));
    }
    sim.seek(2);
    expect(ramFrame(sim)).toEqual(frames[2]);
    sim.seek(5);
    expect(ramFrame(sim)).toEqual(frames[5]);
  });
});
