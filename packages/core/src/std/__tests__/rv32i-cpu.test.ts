import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { RV32I_Core } from '../rv32i-cpu.js';

const NOP = 0x00000013; // addi x0, x0, 0

/**
 * Validates the `debug:true` pipeline-PC outputs (`if_pc/id_pc/ex_pc/mem_pc4/wb_pc4`)
 * are wired to the correct stage registers' `.q`.
 *
 * The program is all-NOP and straight-line: no load-use stalls, no branch/jump
 * flushes, so the pipeline never bubbles. The stub instruction feed is therefore
 * trivially correct (always NOP regardless of `instr_addr`) — a failure here is
 * the `.q`→output mapping, not the harness.
 *
 * The assertions are *cross-cycle shift invariants*: a PC observed in IF at cycle
 * t must reappear in ID at t+1, EX at t+2, … one stage per cycle. That pins each
 * output to the right register without hardcoding an assumed pipeline depth. The
 * EX→MEM shift is the "ex_pc and mem_pc4−4 agree one cycle apart" check.
 */
describe('RV32I_Core debug pipeline-PC outputs', () => {
  it('flow IF→ID→EX→MEM→WB, one stage per cycle (correct .q mapping)', () => {
    const sim = simulate(RV32I_Core({ debug: true }));
    sim.set({ instruction: NOP, data_read: 0, net_rx_data: 0, net_rx_valid: 0, net_rx_frame: 0, debug_addr: 0 });

    const u = (n: number) => n >>> 0;
    type Snap = { instr_addr: number; if_pc: number; id_pc: number; ex_pc: number; mem: number; wb: number };
    const snaps: Snap[] = [];

    for (let cycle = 0; cycle < 24; cycle++) {
      snaps.push({
        instr_addr: u(sim.get('instr_addr')),
        if_pc: u(sim.get('if_pc')),
        id_pc: u(sim.get('id_pc')),
        ex_pc: u(sim.get('ex_pc')),
        mem: u(u(sim.get('mem_pc4')) - 4), // the debugger hook subtracts 4
        wb: u(u(sim.get('wb_pc4')) - 4),
      });
      sim.set({ instruction: NOP, data_read: 0 }); // feed off instr_addr (always NOP)
      sim.tick();
    }
    sim.dispose();

    // Steady window: pipeline full, before any wrap.
    for (let t = 8; t <= 16; t++) {
      const s = snaps[t];
      const next = snaps[t + 1];

      // if_pc is pc.q — identical to instr_addr.
      expect(s.if_pc).toBe(s.instr_addr);
      // straight-line: PC advances by 4 each cycle.
      expect(next.if_pc).toBe(u(s.if_pc + 4));
      // one stage per cycle: the value in stage N at t is in stage N+1 at t+1.
      expect(next.id_pc).toBe(s.if_pc);
      expect(next.ex_pc).toBe(s.id_pc);
      expect(next.mem).toBe(s.ex_pc);   // EX→MEM: ex_pc[t] == (mem_pc4-4)[t+1]
      expect(next.wb).toBe(s.mem);      // MEM→WB
      // sanity: the five stage views are distinct at a steady cycle (no aliased wiring).
      expect(new Set([s.if_pc, s.id_pc, s.ex_pc, s.mem, s.wb]).size).toBe(5);
    }
  });

  it('debug:false exposes none of the debug ports', () => {
    const core = RV32I_Core();
    const outs = new Set(core.circuit.outputs.map((p) => p.name));
    const ins = new Set(core.circuit.inputs.map((p) => p.name));
    for (const p of ['debug_value', 'if_pc', 'id_pc', 'ex_pc', 'mem_pc4', 'wb_pc4']) {
      expect(outs.has(p)).toBe(false);
    }
    expect(ins.has('debug_addr')).toBe(false);
  });
});
