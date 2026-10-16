/**
 * Runs Klaus Dormann's 6502 functional and decimal tests
 * (github.com/Klaus2m5/6502_65C02_functional_tests) on MOS6502_Core.
 *
 * The tests are GPL-3.0, so they are downloaded into ./vectors/dormann rather
 * than committed. The functional test ships as a binary; the decimal test is
 * source only, so it is converted to ca65 syntax and assembled here, with N,
 * V and Z checking switched on (the file defaults to A and C only). Needs
 * ca65/ld65 (cc65) on the PATH.
 *
 * Each test ends in a `JMP *` loop: the runner stops when the CPU fetches the
 * same instruction twice in a row, then checks where it stopped.
 *
 *   npx tsx src/std/__tests__/mos6502/run-dormann.ts [functional|decimal]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMachine } from './machine.js';

const REPO = 'https://raw.githubusercontent.com/Klaus2m5/6502_65C02_functional_tests/master';
const DIR = join(import.meta.dirname, 'vectors', 'dormann');

async function fetchOnce(path: string): Promise<Buffer> {
  const local = join(DIR, path.split('/').pop()!);
  if (!existsSync(local)) {
    mkdirSync(DIR, { recursive: true });
    const res = await fetch(`${REPO}/${path}`);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(local);
}

/** Converts 6502_decimal_test.a65 from as65 to ca65 syntax. */
function toCa65(src: string): string {
  const out = ['.feature labels_without_colons'];
  let inBss = false;
  let bssAddr = 0;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/;.*$/, '').trimEnd();
    const word = line.trim().split(/\s+/);
    if (/^\s+bss$/.test(line)) {
      inBss = true;
      continue;
    }
    if (/^\s+code$/.test(line)) {
      inBss = false;
      continue;
    }
    if (inBss) {
      // `LABEL ds n` reserves zero-page bytes: turn each into an assignment.
      const org = line.match(/^\s+org\s+(\S+)/);
      if (org) bssAddr = Number.parseInt(org[1].replace('$', ''), 16);
      const ds = line.match(/^(\w+)\s+ds\s+(\d+)/);
      if (ds) {
        out.push(`${ds[1]} = $${bssAddr.toString(16)}`);
        bssAddr += Number(ds[2]);
      }
      continue;
    }
    if (/^chk_[nvz]\s*=/.test(line)) {
      out.push(line.replace(/=\s*0/, '= 1'));
    } else if (/^end_of_test\s+macro/.test(line)) {
      out.push('.macro end_of_test', '  jmp *', '.endmacro');
    } else if (word[0] === 'db' || word[0] === 'endm') {
      // Body and end of the end_of_test macro, replaced above.
    } else if (/^\s+org\s/.test(line)) {
      // The code segment is placed at $0200 by the linker config.
    } else if (/^\s+end\s/.test(line)) {
      // `end TEST` names the entry point; the runner starts at $0200.
    } else if (word[0] === 'if' || word[0] === 'else' || word[0] === 'endif') {
      // ca65 spells "not equal" as <>.
      out.push(line.replace(/^(\s+)(if|else|endif)\b/, '$1.$2').replace('!=', '<>'));
    } else {
      out.push(line);
    }
  }
  return `${out.join('\n')}\n`;
}

function assembleDecimal(src: string): Uint8Array {
  const tmp = mkdtempSync(join(tmpdir(), 'dormann-'));
  writeFileSync(join(tmp, 'decimal.s'), toCa65(src));
  writeFileSync(
    join(tmp, 'link.cfg'),
    'MEMORY { RAM: start = $0200, size = $FE00, file = %O; }\nSEGMENTS { CODE: load = RAM, type = rw; }\n',
  );
  execFileSync('ca65', ['-o', join(tmp, 'decimal.o'), join(tmp, 'decimal.s')]);
  execFileSync('ld65', [
    '-C',
    join(tmp, 'link.cfg'),
    '-o',
    join(tmp, 'decimal.bin'),
    join(tmp, 'decimal.o'),
  ]);
  return readFileSync(join(tmp, 'decimal.bin'));
}

/** Runs from `start` until the CPU loops on one instruction; returns that address. */
function runToTrap(image: Uint8Array, at: number, start: number, report: string) {
  const m = createMachine();
  m.mem.set(image, at);
  m.load({ pc: start, s: 0xff, a: 0, x: 0, y: 0, p: 0x24 });
  let last = -1;
  let cycles = 0;
  const began = Date.now();
  for (;;) {
    if (m.fetching()) {
      const pc = m.addr();
      if (pc === last) return { trap: pc, cycles, mem: m.mem };
      last = pc;
    }
    m.step();
    cycles++;
    if (cycles % 5_000_000 === 0) {
      const rate = Math.round(cycles / ((Date.now() - began) / 1000));
      console.log(`  ${report}: ${cycles / 1e6}M cycles, PC $${last.toString(16)}, ${rate}/s`);
    }
  }
}

const which = process.argv[2];
let failed = false;

if (!which || which === 'functional') {
  const bin = await fetchOnce('bin_files/6502_functional_test.bin');
  const { trap, cycles } = runToTrap(bin, 0, 0x0400, 'functional');
  // The success trap in the published binary (see its .lst).
  const ok = trap === 0x3469;
  failed ||= !ok;
  console.log(
    `functional: ${ok ? 'PASS' : 'FAIL'} trapped at $${trap.toString(16)} after ${cycles} cycles`,
  );
}

if (!which || which === 'decimal') {
  const src = (await fetchOnce('6502_decimal_test.a65')).toString('utf8');
  const { trap, cycles, mem } = runToTrap(assembleDecimal(src), 0x0200, 0x0200, 'decimal');
  // ERROR ($0B) is 0 when every result and flag matched.
  const ok = mem[0x0b] === 0;
  failed ||= !ok;
  console.log(
    `decimal: ${ok ? 'PASS' : 'FAIL'} ERROR=${mem[0x0b]} trapped at $${trap.toString(16)} after ${cycles} cycles`,
  );
}

process.exit(failed ? 1 : 0);
