import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllCircuitEvals } from '../../circuit/index.js';
import { simulate } from '../../sim/simulate.js';
import { checkSynthesizable } from '../../verilog/eval-synth.js';
import * as MOS6502 from '../mos6502.js';
import { MOS6502_Core } from '../mos6502-cpu.js';
import { createHarteRunner, DOCUMENTED_OPCODES, type HarteCase } from './mos6502/harte.js';

const sample: HarteCase[] = JSON.parse(
  readFileSync(join(import.meta.dirname, 'mos6502', 'harte-sample.json'), 'utf8'),
);

describe('MOS6502_Core vs Tom Harte SingleStepTests (CI sample)', () => {
  it('covers every documented opcode', () => {
    const ops = new Set(sample.map((c) => Number.parseInt(c.name.slice(0, 2), 16)));
    expect([...ops].sort((a, b) => a - b)).toEqual(DOCUMENTED_OPCODES);
  });

  it('matches every bus cycle and the final state', () => {
    const runner = createHarteRunner();
    const failures = sample
      .map((c) => ({ name: c.name, err: runner.run(c) }))
      .filter((r) => r.err !== null);
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('MOS6502_Core', () => {
  it('runs its reset sequence from power-on and fetches from the reset vector', () => {
    const sim = simulate(MOS6502_Core({ debug: true }));
    const mem = new Uint8Array(0x10000);
    mem.set([0xa9, 0x42, 0x8d, 0x00, 0x02, 0x4c, 0x05, 0x04], 0x0400); // LDA #$42; STA $0200; JMP *
    mem[0xfffc] = 0x00;
    mem[0xfffd] = 0x04;
    let firstFetch = -1;
    for (let cycle = 0; cycle < 20; cycle++) {
      const addr = sim.get('addr');
      if (sim.get('sync') && firstFetch < 0) firstFetch = addr;
      if (sim.get('rw')) sim.set({ data_in: mem[addr] });
      else mem[addr] = sim.get('data_out');
      sim.tick();
    }
    expect(firstFetch).toBe(0x0400);
    expect(mem[0x0200]).toBe(0x42);
    expect(sim.get('s')).toBe(0xfd);
    expect(sim.get('p') & 0x04).toBe(0x04);
  });

  it('takes an IRQ after the current instruction when I is clear', () => {
    const sim = simulate(MOS6502_Core({ debug: true }));
    const mem = new Uint8Array(0x10000);
    mem.set([0x58, 0xea, 0x4c, 0x02, 0x04], 0x0400); // CLI; NOP; JMP *
    mem.set([0xe8, 0x40], 0x0500); // handler: INX; RTI
    mem.set([0x00, 0x04, 0x00, 0x04, 0x00, 0x05], 0xfffa);
    let handled = false;
    for (let cycle = 0; cycle < 40; cycle++) {
      const addr = sim.get('addr');
      if (sim.get('sync') && addr === 0x0500) handled = true;
      // Hold IRQ until the handler starts.
      sim.set({ irq: handled ? 0 : 1 });
      if (sim.get('rw')) sim.set({ data_in: mem[addr] });
      else mem[addr] = sim.get('data_out');
      sim.tick();
    }
    expect(handled).toBe(true);
    expect(sim.get('x')).toBe(1);
    // The pushed P has B clear for a hardware interrupt.
    expect(mem[0x01fb] & 0x10).toBe(0);
  });

  it('omits the debug ports unless asked', () => {
    const core = MOS6502_Core();
    expect(core.circuit.outputs.map((p) => p.name).sort()).toEqual([
      'addr',
      'data_out',
      'rw',
      'sync',
    ]);
  });

  it('keeps every 6502 eval inside the synthesizable subset', () => {
    const names = Object.values(MOS6502).map((c) => c.circuit.name);
    const evals = [...getAllCircuitEvals()].filter(([name]) => names.includes(name));
    expect(evals.length).toBe(names.length);
    for (const [name, entry] of evals) {
      const res = checkSynthesizable(entry.evalFn, entry.inputNames, entry.outputNames);
      expect({ name, errors: res.errors }).toEqual({ name, errors: [] });
    }
  });
});
