/**
 * A test bench around MOS6502_Core: 64 KB of RAM served one bus cycle per
 * tick, plus a way to load register state directly into the core.
 */

import { libraryOf } from '../../../circuit/behavior.js';
import { internalsOf } from '../../../circuit/internals.js';
import { elaborate } from '../../../simulator/elaboration.js';
import { createEngine } from '../../../simulator/engine.js';
import { SimulationSession } from '../../../simulator/simulation-session.js';
import { MOS6502_Core } from '../../mos6502-cpu.js';

export interface CpuState {
  pc: number;
  s: number;
  a: number;
  x: number;
  y: number;
  p: number;
}

export type BusCycle = [addr: number, data: number, kind: 'read' | 'write'];

export function createMachine() {
  // Driven through the session rather than simulate(), so `load` can settle
  // the logic after poking registers without a clock edge.
  const core = MOS6502_Core({ debug: true });
  const library = libraryOf(core);
  const engine = createEngine(elaborate(internalsOf(core).ir, library.definitions), { library });
  engine.runCombinational();
  const session = new SimulationSession(engine, { isSequential: true });
  const sim = {
    get: (port: string) => Number(session.getState().portValues.get(`__top__.${port}`)),
    set: (values: Record<string, number>) => {
      for (const [port, value] of Object.entries(values)) session.setNode(port, value);
    },
    setNode: (id: string, value: number) => session.setNode(id, value),
    tick: () => session.tick(),
  };
  const mem = new Uint8Array(0x10000);

  return {
    mem,

    /** Puts the core at an instruction boundary: the next cycle fetches at `pc`. */
    load(state: CpuState) {
      const set = (id: string, v: number) => sim.setNode(id, v);
      set('timing.t', 0);
      set('timing.kind', 0);
      set('timing.acr', 0);
      set('timing.adir', 0);
      set('timing.pending', 0);
      set('timing.nmi_prev', 0);
      set('timing.nmi_latch', 0);
      set('pc.pcl', state.pc & 0xff);
      set('pc.pch', state.pc >> 8);
      set('ab.abl', state.pc & 0xff);
      set('ab.abh', state.pc >> 8);
      set('latch.wr', 0);
      set('regs.a', state.a);
      set('regs.x', state.x);
      set('regs.y', state.y);
      set('regs.s', state.s);
      set('status.p', (state.p & 0xef) | 0x20);
      sim.set({ data_in: 0, irq: 0, nmi: 0, reset: 0 });
      session.runCombinational();
    },

    /** Runs one clock cycle against `mem` and returns the bus cycle it made. */
    step(): BusCycle {
      const addr = sim.get('addr');
      if (sim.get('rw')) {
        const data = mem[addr];
        sim.set({ data_in: data });
        sim.tick();
        return [addr, data, 'read'];
      }
      const data = sim.get('data_out');
      mem[addr] = data;
      sim.tick();
      return [addr, data, 'write'];
    },

    /** True when the next cycle is an opcode fetch. */
    fetching: () => sim.get('sync') === 1,

    state: (): CpuState => ({
      pc: sim.get('pc'),
      s: sim.get('s'),
      a: sim.get('a'),
      x: sim.get('x'),
      y: sim.get('y'),
      p: sim.get('p'),
    }),

    /** Address of the next bus cycle. */
    addr: () => sim.get('addr'),
  };
}
