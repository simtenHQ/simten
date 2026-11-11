/**
 * Builds the NES bitstream with a local Yosys/nextpnr (oss-cad-suite), and
 * optionally loads it onto the board over USB. The design is too big for the
 * synth container's request limits.
 *
 *   tsx projects/nes/build.ts [--flash] [--rom=game.nes]
 *
 * --rom bakes a game in (see index.ts); without it the board waits for one
 * from load.ts. Tools come from $OSS_CAD_SUITE (default /opt/oss-cad-suite).
 * Everything is written to a directory outside the repo, so a baked ROM never
 * lands in the working tree.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cartFromINes, nesVerilog } from './index.js';

const args = process.argv.slice(2);
const flash = args.includes('--flash');
const romArg = args.find((a) => a.startsWith('--rom='))?.slice('--rom='.length);
const tools = join(process.env.OSS_CAD_SUITE ?? '/opt/oss-cad-suite', 'bin');
const out = join(tmpdir(), 'simten-nes-build');
mkdirSync(out, { recursive: true });

const started = Date.now();
const step = (name: string, cmd: string, cmdArgs: string[]) => {
  const t = Date.now();
  try {
    execFileSync(join(tools, cmd), cmdArgs, { cwd: out, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    process.stderr.write(`${e.stdout?.toString().slice(-3000) ?? ''}${e.stderr ?? ''}`);
    throw new Error(`${name} failed; logs in ${out}`);
  }
  console.log(`${name}: ${((Date.now() - t) / 1000).toFixed(0)} s`);
};

const baked = romArg ? cartFromINes(new Uint8Array(readFileSync(resolve(romArg)))) : undefined;
const { verilog, files } = nesVerilog(baked);
writeFileSync(join(out, 'top.v'), verilog);
writeFileSync(
  join(out, 'top.lpf'),
  readFileSync(new URL('./ulx3s_nes.lpf', import.meta.url), 'utf8'),
);
for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);

step('yosys', 'yosys', [
  '-q',
  '-l',
  'yosys.log',
  '-p',
  'read_verilog top.v; synth_ecp5 -top nes_top -json top.json',
]);
step('nextpnr', 'nextpnr-ecp5', [
  '--85k',
  '--package',
  'CABGA381',
  '--json',
  'top.json',
  '--lpf',
  'top.lpf',
  '--textcfg',
  'top.config',
  '--log',
  'pnr.log',
  '--quiet',
]);
step('ecppack', 'ecppack', ['--compress', '--input', 'top.config', '--bit', 'nes.bit']);

const log = readFileSync(join(out, 'pnr.log'), 'utf8');
for (const line of log.split('\n')) {
  if (/TRELLIS_COMB:|DP16KD:|Max frequency for clock/.test(line)) console.log(line.trim());
}
console.log(`bitstream: ${join(out, 'nes.bit')} (${((Date.now() - started) / 1000).toFixed(0)} s)`);

if (flash) {
  execFileSync('openFPGALoader', ['-b', 'ulx3s', join(out, 'nes.bit')], { stdio: 'inherit' });
}
