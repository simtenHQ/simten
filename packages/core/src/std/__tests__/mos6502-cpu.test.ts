import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { internalsOf } from '../../circuit/internals.js';
import { simulate } from '../../simulator/simulate.js';
import { checkEvalSynthesizable } from '../../verilog/eval-synth.js';
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

  it('matches every bus cycle with RDY held low before some reads', () => {
    const runner = createHarteRunner({ stall: 0.3 });
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
    expect(Object.keys(core.outputs).sort()).toEqual(['addr', 'data_out', 'rw', 'sync']);
  });

  it('keeps every 6502 eval inside the synthesizable subset', () => {
    const evals = Object.values(MOS6502).map((c) => [c.name, internalsOf(c).behavior] as const);
    for (const [name, entry] of evals) {
      if (!entry) throw new Error(`${name} carries no eval`);
      const res = checkEvalSynthesizable(entry.evalFn, entry.inputNames, entry.outputNames);
      expect({ name, errors: res.errors }).toEqual({ name, errors: [] });
    }
  });
});

// A program with a page crossing, a dummy read, a read-modify-write, the stack
// and a branch loop, run from power-on.
const program = [
  0xa2,
  0x03, //       LDX #$03
  0xbd,
  0xfe,
  0x02, // LDA $02FE,X   (crosses into $0301)
  0x69,
  0x11, //       ADC #$11
  0x9d,
  0x00,
  0x02, // STA $0200,X   (dummy read, write)
  0xfe,
  0x00,
  0x02, // INC $0200,X   (read, dummy write, write)
  0x48, //             PHA
  0x20,
  0x14,
  0x04, // JSR $0414
  0x4c,
  0x11,
  0x04, // JMP *
  0xca, //             $0414: DEX
  0xd0,
  0xfd, //       BNE $0414
  0x60, //             RTS
];

interface Cycle {
  addr: number;
  data: number;
  kind: 'read' | 'write';
  halted: boolean;
}

function boot(options: { rdy?: boolean; decimal?: boolean } = {}, code = program) {
  const sim = simulate(MOS6502_Core({ debug: true, ...options }));
  const mem = new Uint8Array(0x10000);
  mem.set(code, 0x0400);
  mem[0x0301] = 0x20;
  mem.set([0x00, 0x05, 0x00, 0x04, 0x00, 0x04], 0xfffa); // NMI $0500, reset $0400
  mem.set([0xc8, 0x40], 0x0500); // NMI handler: INY; RTI
  return { sim, mem, rdy: options.rdy === true };
}

/** Runs `n` cycles; `pins` drives rdy and nmi per cycle (default: ready, no NMI). */
function trace(
  { sim, mem, rdy: hasRdy }: ReturnType<typeof boot>,
  n: number,
  pins: (cycle: number) => { rdy?: number; nmi?: number } = () => ({}),
): Cycle[] {
  const out: Cycle[] = [];
  for (let i = 0; i < n; i++) {
    const { rdy = 1, nmi = 0 } = pins(i);
    sim.set(hasRdy ? { rdy, nmi } : { nmi });
    const addr = sim.get('addr');
    const read = sim.get('rw') === 1;
    const halted = read && rdy === 0;
    // A halted read gets junk on the data pins; it must be ignored.
    const data = read ? (halted ? mem[addr] ^ 0xff : mem[addr]) : sim.get('data_out');
    if (read) sim.set({ data_in: data });
    else mem[addr] = data;
    out.push({ addr, data, kind: read ? 'read' : 'write', halted });
    sim.tick();
  }
  return out;
}

/** The bus cycles that did something: the trace without the halted ones. */
const unhalted = (cycles: Cycle[]) => cycles.filter((c) => !c.halted);

const regs = ({ sim }: ReturnType<typeof boot>) =>
  (['pc', 'a', 'x', 'y', 's', 'p'] as const).map((r) => sim.get(r));

describe('MOS6502_Core RDY', () => {
  const N = 90;
  const base = trace(boot({ rdy: true }), N);

  it('runs exactly like the core without RDY while RDY is high', () => {
    expect(trace(boot(), N)).toEqual(base);
    expect(base.some((c) => c.kind === 'write')).toBe(true);
  });

  it('has no RDY pin unless asked, so the default core never halts', () => {
    expect(Object.keys(MOS6502_Core().inputs).sort()).toEqual(['data_in', 'irq', 'nmi', 'reset']);
    expect(Object.keys(MOS6502_Core({ rdy: true }).inputs)).toContain('rdy');
  });

  it('halting on any read cycle repeats that read and shifts the trace', () => {
    const ref = boot({ rdy: true });
    trace(ref, N);
    const reads = base.flatMap((c, i) => (c.kind === 'read' ? [i] : []));
    expect(reads.length).toBeGreaterThan(50);
    for (const at of reads) {
      for (const len of [1, 3]) {
        const m = boot({ rdy: true });
        const got = trace(m, N + len, (i) => ({ rdy: i >= at && i < at + len ? 0 : 1 }));
        const held = got.slice(at, at + len + 1);
        expect(held.every((c) => c.addr === base[at].addr && c.kind === 'read')).toBe(true);
        expect(unhalted(got)).toEqual(base);
        expect(regs(m)).toEqual(regs(ref));
      }
    }
  });

  it('completes a write while RDY is low and halts on the next read', () => {
    // INC's dummy write and write are back to back; hold RDY low across both.
    const w = base.findIndex((c, i) => c.kind === 'write' && base[i + 1]?.kind === 'write');
    expect(w).toBeGreaterThan(0);
    const got = trace(boot({ rdy: true }), N + 2, (i) => ({ rdy: i >= w && i < w + 4 ? 0 : 1 }));
    expect(got.slice(w, w + 2)).toEqual(base.slice(w, w + 2));
    expect(got.slice(w + 2, w + 4).map((c) => c.halted)).toEqual([true, true]);
    expect(unhalted(got)).toEqual(base);
  });

  it('takes an NMI that pulses during a halt, as if it arrived when the halt ends', () => {
    // NMI rises for one cycle at `at` in a run without halts...
    const at = 30;
    expect(base[at].kind).toBe('read');
    const ref = boot({ rdy: true });
    const want = trace(ref, N, (i) => ({ nmi: i === at ? 1 : 0 }));
    expect(want.some((c) => c.addr === 0x0500)).toBe(true);
    // ...and pulses for two cycles inside a 6-cycle halt that starts there.
    const m = boot({ rdy: true });
    const got = trace(m, N + 6, (i) => ({
      rdy: i >= at && i < at + 6 ? 0 : 1,
      nmi: i === at + 2 || i === at + 3 ? 1 : 0,
    }));
    expect(unhalted(got)).toEqual(want);
    expect(regs(m)).toEqual(regs(ref));
  });

  it('takes an NMI that rises during a halt and stays high exactly once', () => {
    const m = boot({ rdy: true });
    const got = trace(m, N + 4, (i) => ({ rdy: i >= 30 && i < 34 ? 0 : 1, nmi: i >= 31 ? 1 : 0 }));
    expect(got.filter((c) => c.addr === 0x0500 && !c.halted).length).toBe(1);
    expect(m.sim.get('y')).toBe(1);
  });
});

describe('MOS6502_Core decimal option', () => {
  // SED; CLC; LDA #$09; ADC #$01; STA $10; SEC; LDA #$10; SBC #$01; STA $11; PHP; JMP *
  const code = [
    0xf8, 0x18, 0xa9, 0x09, 0x69, 0x01, 0x85, 0x10, 0x38, 0xa9, 0x10, 0xe9, 0x01, 0x85, 0x11, 0x08,
    0x4c, 0x10, 0x04,
  ];

  it('adds and subtracts in binary with D set when decimal is off', () => {
    const m = boot({ decimal: false }, code);
    trace(m, 60);
    expect([m.mem[0x10], m.mem[0x11]]).toEqual([0x0a, 0x0f]);
    expect(m.sim.get('p') & 0x08).toBe(0x08);
    expect(m.mem[0x01fd] & 0x08).toBe(0x08); // pushed by PHP
  });

  it('adds and subtracts in BCD with D set by default', () => {
    const m = boot({}, code);
    trace(m, 60);
    expect([m.mem[0x10], m.mem[0x11]]).toEqual([0x10, 0x09]);
  });
});
