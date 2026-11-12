/**
 * Builds the NES to WebAssembly for the demo page, once per cartridge shape
 * (16 or 32 KB PRG, horizontal or vertical mirroring), as two models stepped
 * at their own rates (halves.ts, split.cc): fast enough to play at full speed.
 * Needs Yosys (oss-cad-suite) and Emscripten (em++) on the PATH.
 *
 *   npx tsx demo/build.ts                   (from nes/)
 *   npx tsx demo/build.ts --check=game.nes  also checks the split against the
 *                                           whole NES as one model, natively
 *                                           (clang++), on that ROM's shape
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Circuit } from '@simten/core';
import {
  type CxxrtlManifest,
  cxxrtlHarness,
  cxxrtlManifest,
  exportVerilog,
  HARNESS_EXPORTS,
} from '@simten/core/verilog';
import { Nes } from '../src/board.js';
import { type CartShape, NesCpuHalf, NesPpuHalf } from './halves.js';

const here = import.meta.dirname;
const out = join(here, 'public');
const runtime = join(
  execFileSync('yosys-config', ['--datdir']).toString().trim(),
  'include/backends/cxxrtl/runtime',
);
const video = {
  we: 'video_we',
  x: 'video_x',
  y: 'video_y',
  data: 'color',
  width: 256,
  height: 240,
};
// One 44.1 kHz sample per 121.75 PPU dots.
const audio = { data: 'audio', ticksPerSample: 5_369_318 / 44_100 };
const exportsFlag = `-sEXPORTED_FUNCTIONS=${HARNESS_EXPORTS.map((e) => `_${e}`).join(',')}`;

/** What the page reads: split.cc's ports and memories, in its order. */
const manifest: CxxrtlManifest = {
  top: 'Nes',
  ports: [
    { name: 'pad1', width: 8, direction: 'input' },
    { name: 'pad2', width: 8, direction: 'input' },
    { name: 'video_x', width: 8, direction: 'output' },
    { name: 'video_y', width: 8, direction: 'output' },
    { name: 'video_we', width: 1, direction: 'output' },
    { name: 'color', width: 6, direction: 'output' },
    { name: 'audio', width: 16, direction: 'output' },
  ],
  memories: [
    { name: 'cart_prg', width: 8, depth: 65536 },
    { name: 'cart_chr', width: 8, depth: 65536 },
    { name: 'console_ram', width: 8, depth: 2048 },
  ],
  video,
  audio,
};

/** One model's C++, in its own namespace. */
function cxxrtl(dir: string, circuit: Circuit, file: string, namespace: string) {
  const top = circuit.name;
  writeFileSync(join(dir, `${file}.v`), exportVerilog(circuit).verilog);
  execFileSync(
    'yosys',
    [
      '-q',
      '-p',
      `read_verilog ${file}.v; hierarchy -top ${top}; proc; write_cxxrtl -namespace ${namespace} ${file}.cc`,
    ],
    { cwd: dir, stdio: 'ignore' },
  );
}

/** A directory with the split's two models and its harness. */
function splitSources(shape: CartShape): string {
  const dir = mkdtempSync(join(tmpdir(), 'nes-split-'));
  cxxrtl(dir, NesCpuHalf(shape), 'cpu', 'cpu_ns');
  cxxrtl(dir, NesPpuHalf(shape), 'ppu', 'ppu_ns');
  writeFileSync(join(dir, 'split.cc'), readFileSync(join(here, 'split.cc')));
  return dir;
}

const audioTicks = `-DAUDIO_TICKS=${audio.ticksPerSample}`;

function build(shape: Required<CartShape>) {
  const name = `nes-${shape.prgSize / 1024}k-${shape.vertical ? 'v' : 'h'}`;
  const t = performance.now();
  const dir = splitSources(shape);
  execFileSync(
    'em++',
    [
      '-O3',
      '-std=c++17',
      `-I${runtime}`,
      audioTicks,
      'split.cc',
      '-o',
      'sim.wasm',
      '--no-entry',
      '-sSTANDALONE_WASM',
      '-sALLOW_MEMORY_GROWTH',
      exportsFlag,
    ],
    { cwd: dir, stdio: 'ignore' },
  );
  writeFileSync(join(out, `${name}.wasm`), readFileSync(join(dir, 'sim.wasm')));
  writeFileSync(join(out, `${name}.json`), JSON.stringify(manifest));
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${((performance.now() - t) / 1000).toFixed(1)} s`);
}

/** Runs `rom` on the split and on the whole NES as one model; they must agree. */
function check(rom: string) {
  const bytes = readFileSync(rom);
  const shape = { prgSize: bytes[4] * 0x4000, vertical: bytes[6] & 1 };
  const run = (dir: string, harness: string, args: string[]) => {
    execFileSync(
      'clang++',
      [
        '-O3',
        '-std=c++17',
        `-I${runtime}`,
        audioTicks,
        harness,
        join(here, 'check.cc'),
        '-o',
        'check',
      ],
      { cwd: dir, stdio: 'ignore' },
    );
    return execFileSync(join(dir, 'check'), [rom, ...args])
      .toString()
      .trim();
  };

  const split = splitSources(shape);
  const got = run(split, 'split.cc', ['0', '1', '0']);
  rmSync(split, { recursive: true, force: true });

  const whole = mkdtempSync(join(tmpdir(), 'nes-whole-'));
  const verilog = exportVerilog(Nes(shape)).verilog;
  const m = cxxrtlManifest(verilog, video, audio);
  writeFileSync(join(whole, 'design.v'), verilog);
  writeFileSync(join(whole, 'harness.cc'), cxxrtlHarness(m));
  execFileSync(
    'yosys',
    ['-q', '-p', 'read_verilog design.v; hierarchy -top Nes; proc; write_cxxrtl design.cc'],
    { cwd: whole, stdio: 'ignore' },
  );
  const index = (name: string) => String(m.memories.findIndex((mem) => mem.name === name));
  const pad1 = String(m.ports.findIndex((p) => p.name === 'pad1'));
  const want = run(whole, 'harness.cc', [index('cart_prg'), index('cart_chr'), pad1]);
  rmSync(whole, { recursive: true, force: true });

  console.log(`split: ${got}\nwhole: ${want}`);
  if (got !== want) throw new Error('the split build differs from the whole NES');
  console.log('match');
}

const checkArg = process.argv.find((a) => a.startsWith('--check='));
if (checkArg) check(checkArg.slice('--check='.length));
for (const prgSize of [0x4000, 0x8000]) {
  for (const vertical of [0, 1]) build({ prgSize, vertical });
}
