/**
 * The CXXRTL harness. The build test needs Yosys and Emscripten (`em++`) on
 * the PATH and is skipped without them: it compiles a small circuit to
 * WebAssembly and checks it tick for tick against `simulate()`.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bit, bus, circuit, simulate } from '../../index.js';
import { Constant, DualPortRAM, Register, romFromBytes } from '../../std/index.js';
import { cxxrtlHarness, cxxrtlManifest, HARNESS_EXPORTS, loadCxxrtl } from '../cxxrtl.js';
import { exportVerilog } from '../exporter.js';

const Step = circuit('CxxStep', {
  inputs: { q: bus(8), step: bus(8) },
  outputs: { next: bus(8) },
  eval: ({ q, step }) => ({ next: ((q as number) + (step as number)) & 0xff }),
});

/** A counter that adds `step` each tick, and a RAM written from the inputs. */
const Top = circuit('CxxTop', {
  inputs: { step: bus(8), addr: bus(4), wdata: bus(8), we: bit },
  outputs: { count: bus(8), rdata: bus(8), x: bus(4), y: bus(4), vwe: bit },
  nodes: {
    q: Register({ width: 8 }),
    add: Step,
    ram: DualPortRAM({ addressWidth: 4, dataWidth: 8 }),
    always: Constant({ value: 1 }),
    zero: Constant({ value: 0, width: 4 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.always.out.to(n.q.we),
    n.q.q.to(n.add.q, outputs.count),
    inputs.step.to(n.add.step),
    n.add.next.to(n.q.data),
    inputs.addr.to(n.ram.addrA, n.ram.addrB, outputs.x),
    inputs.wdata.to(n.ram.dataA),
    inputs.we.to(n.ram.weA, outputs.vwe),
    n.ram.outA.to(outputs.rdata),
    n.zero.out.to(outputs.y),
  ],
});

const VIDEO = { we: 'vwe', x: 'x', y: 'y', data: 'count', width: 16, height: 1 };

describe('cxxrtlManifest', () => {
  const { verilog } = exportVerilog(Top);

  it('lists the ports, without the clock and reset, and the memories', () => {
    const m = cxxrtlManifest(verilog);
    expect(m.top).toBe('CxxTop');
    expect(m.ports).toEqual([
      { name: 'step', width: 8, direction: 'input' },
      { name: 'addr', width: 4, direction: 'input' },
      { name: 'wdata', width: 8, direction: 'input' },
      { name: 'we', width: 1, direction: 'input' },
      { name: 'count', width: 8, direction: 'output' },
      { name: 'rdata', width: 8, direction: 'output' },
      { name: 'x', width: 4, direction: 'output' },
      { name: 'y', width: 4, direction: 'output' },
      { name: 'vwe', width: 1, direction: 'output' },
    ]);
    expect(m.memories).toEqual([{ name: 'ram', width: 8, depth: 16 }]);
  });

  it('rejects a video sink on a port that is not an output', () => {
    expect(() => cxxrtlManifest(verilog, { ...VIDEO, we: 'we' })).toThrow(/we is not an output/);
  });

  it('names ports and memories the way CXXRTL mangles them', () => {
    const cc = cxxrtlHarness(cxxrtlManifest(verilog, VIDEO));
    expect(cc).toContain('cxxrtl_design::p_CxxTop');
    expect(cc).toContain('top->p_wdata.set<uint32_t>(v)');
    expect(cc).toContain('top->memory_p_mem__ram[addr]');
    expect(cc).toContain('static uint8_t frame[16];');
  });
});

const has = (cmd: string, arg: string) => spawnSync(cmd, [arg], { stdio: 'ignore' }).status === 0;
const tools = has('yosys', '-V') && has('em++', '--version') && has('yosys-config', '--datdir');

describe.skipIf(!tools)('CXXRTL build', () => {
  it('matches simulate() tick for tick', { timeout: 300_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cxxrtl-'));
    try {
      const { verilog } = exportVerilog(Top);
      const manifest = cxxrtlManifest(verilog, VIDEO);
      writeFileSync(join(dir, 'design.v'), verilog);
      writeFileSync(join(dir, 'harness.cc'), cxxrtlHarness(manifest));
      execFileSync(
        'yosys',
        ['-q', '-p', 'read_verilog design.v; hierarchy -top CxxTop; proc; write_cxxrtl design.cc'],
        { cwd: dir },
      );
      const runtime = `${execFileSync('yosys-config', ['--datdir']).toString().trim()}/include/backends/cxxrtl/runtime`;
      execFileSync(
        'em++',
        [
          '-O2',
          '-std=c++17',
          `-I${runtime}`,
          'harness.cc',
          '-o',
          'sim.wasm',
          '--no-entry',
          '-sSTANDALONE_WASM',
          '-sALLOW_MEMORY_GROWTH',
          `-sEXPORTED_FUNCTIONS=${HARNESS_EXPORTS.map((e) => `_${e}`).join(',')}`,
        ],
        { cwd: dir, stdio: 'ignore' },
      );
      const fast = await loadCxxrtl(readFileSync(join(dir, 'sim.wasm')), manifest);
      const ref = simulate(Top, {
        memory: { ram: romFromBytes(Array.from({ length: 16 }, (_, i) => i * 3)) },
      });
      fast.writeMemory(
        'ram',
        Array.from({ length: 16 }, (_, i) => i * 3),
      );

      let seed = 99;
      const rand = (n: number) => {
        seed = (seed * 1103515245 + 12345) >>> 0;
        return (seed >>> 16) % n;
      };
      const frame = new Array(16).fill(0);
      const outs = ['count', 'rdata', 'x', 'y', 'vwe'];
      for (let t = 0; t < 300; t++) {
        const ins = {
          step: rand(256),
          addr: rand(16),
          wdata: rand(256),
          we: rand(4) === 0 ? 1 : 0,
        };
        ref.set(ins);
        fast.set(ins);
        for (const o of outs) expect([t, o, fast.get(o)]).toEqual([t, o, ref.get(o)]);
        if (ref.get('vwe')) frame[ref.get('x')] = ref.get('count');
        ref.tick();
        fast.tick();
      }
      // Many ticks per call, as a frame is run: no set() between them.
      for (let batch = 0; batch < 20; batch++) {
        const ins = { step: rand(256), addr: rand(16), wdata: rand(256), we: 1 };
        ref.set(ins);
        fast.set(ins);
        const n = 1 + rand(40);
        for (let t = 0; t < n; t++) {
          frame[ref.get('x')] = ref.get('count');
          ref.tick();
        }
        fast.tick(n);
        for (const o of outs) expect([batch, o, fast.get(o)]).toEqual([batch, o, ref.get(o)]);
      }
      expect(Array.from(fast.video() ?? [])).toEqual(frame);
      expect(fast.readMemory('ram', 0, 16)).toEqual(ramOf(ref));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** The reference simulator's RAM contents. */
function ramOf(sim: ReturnType<typeof simulate>) {
  const state = (
    sim.snapshot() as unknown as { sequentialState: { currentState: Map<string, unknown> } }
  ).sequentialState.currentState.get('ram') as Map<number, number> | undefined;
  return Array.from({ length: 16 }, (_, i) => state?.get(i) ?? 0);
}
