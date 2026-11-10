/**
 * Runs nestest on the NES board and compares the CPU against nestest.log at
 * every instruction boundary: PC, the opcode byte, A, X, Y, P, SP and the
 * CPU cycle count. The log's PPU column is ignored (there is no PPU yet).
 *
 * Starting state: nestest's automated mode starts at $C000 with P=$24,
 * SP=$FD at cycle 7. The core's power-on reset sequence gives exactly that
 * (P powers up as $24, S as $00, and the reset sequence decrements S three
 * times), so the runner only points the reset vector at
 * $C000 in its copy of PRG ROM. The core and the board are unchanged.
 *
 * The log's first 5003 lines use official opcodes only; from line 5004 on
 * nestest tests the unofficial ones (marked `*` in the log).
 */

import { nodesOf } from '@simten/core/internal';
import { createNes } from '../src/board.js';
import type { INesRom } from '../src/ines.js';

/** Last log line of the official-opcode section. */
export const OFFICIAL_LINES = 5003;

interface CpuState {
  pc: number;
  opcode: number;
  a: number;
  x: number;
  y: number;
  p: number;
  sp: number;
  cyc: number;
}

export interface LogLine extends CpuState {
  /** 1-based line number in nestest.log. */
  line: number;
  /** The line as written, for messages. */
  text: string;
  unofficial: boolean;
}

interface Mismatch {
  /** The log line whose state didn't match. */
  expected: LogLine;
  got: CpuState;
  /** The instruction that produced the wrong state: the line before. */
  culprit: LogLine;
}

interface NestestResult {
  lines: number;
  /** Lines that matched, counting the ones after a resync. */
  matched: number;
  mismatches: Mismatch[];
  /** Unofficial-opcode lines whose resulting state matched the next line. */
  unofficial: { passed: LogLine[]; failed: LogLine[] };
}

const FIELDS = ['pc', 'opcode', 'a', 'x', 'y', 'p', 'sp', 'cyc'] as const;

const LINE =
  /^([0-9A-F]{4}) {2}([0-9A-F]{2}).{7}(.).*A:([0-9A-F]{2}) X:([0-9A-F]{2}) Y:([0-9A-F]{2}) P:([0-9A-F]{2}) SP:([0-9A-F]{2}).*CYC:(\d+)/;

export function parseLog(text: string): LogLine[] {
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .map((l, i) => {
      const m = LINE.exec(l);
      if (!m) throw new Error(`nestest.log line ${i + 1}: can't parse "${l}"`);
      const h = (s: string) => Number.parseInt(s, 16);
      return {
        line: i + 1,
        text: l,
        unofficial: m[3] === '*',
        pc: h(m[1]),
        opcode: h(m[2]),
        a: h(m[4]),
        x: h(m[5]),
        y: h(m[6]),
        p: h(m[7]),
        sp: h(m[8]),
        cyc: Number(m[9]),
      };
    });
}

const hex = (v: number, digits = 2) => v.toString(16).toUpperCase().padStart(digits, '0');

function formatState(s: CpuState): string {
  return `${hex(s.pc, 4)}  ${hex(s.opcode)}  A:${hex(s.a)} X:${hex(s.x)} Y:${hex(s.y)} P:${hex(s.p)} SP:${hex(s.sp)} CYC:${s.cyc}`;
}

/** The fields of `got` that differ from `expected`. */
function diffFields(expected: CpuState, got: CpuState): string[] {
  return FIELDS.filter((f) => expected[f] !== got[f]);
}

/**
 * A NES with nestest inserted, its reset vector pointing at $C000, and a way
 * to step it one instruction at a time.
 */
function createRunner(rom: INesRom) {
  const prg = rom.prg.slice();
  prg[prg.length - 4] = 0x00;
  prg[prg.length - 3] = 0xc0;
  const sim = createNes({ ...rom, prg }, { debug: true });
  // The reset sequence is 7 cycles, as the log counts it, but the core powers
  // up one cycle into it (T1), so the count starts at 1.
  let cyc = 1;

  const tick = () => {
    sim.tick();
    cyc++;
  };

  return {
    /** Runs to the next opcode fetch and returns the state there. */
    next(): CpuState {
      const limit = cyc + 100;
      while (!sim.get('sync')) {
        if (cyc > limit) throw new Error(`no opcode fetch for 100 cycles after cycle ${cyc - 100}`);
        tick();
      }
      return {
        pc: sim.get('addr'),
        opcode: sim.get('data'),
        a: sim.get('a'),
        x: sim.get('x'),
        y: sim.get('y'),
        p: sim.get('p'),
        sp: sim.get('s'),
        cyc,
      };
    },

    /** Starts this instruction, so the next `next()` finds the following one. */
    advance: tick,

    /** Loads `s` into the core so its next cycle fetches the opcode at `s.pc`. */
    load(s: CpuState) {
      const nodes = nodesOf(sim);
      const values: Record<string, number> = {
        'timing.t': 0,
        'timing.kind': 0,
        'timing.acr': 0,
        'timing.adir': 0,
        'timing.pending': 0,
        'timing.nmi_prev': 0,
        'timing.nmi_latch': 0,
        'pc.pcl': s.pc & 0xff,
        'pc.pch': s.pc >> 8,
        'ab.abl': s.pc & 0xff,
        'ab.abh': s.pc >> 8,
        'latch.wr': 0,
        'regs.a': s.a,
        'regs.x': s.x,
        'regs.y': s.y,
        'regs.s': s.sp,
        'status.p': (s.p & 0xef) | 0x20,
      };
      for (const [path, value] of Object.entries(values)) nodes.set(`cpu.${path}`, value);
      cyc = s.cyc;
    },
  };
}

/**
 * Runs nestest against `log`. Stops at the first mismatch, unless `resync`
 * is set: then it loads the expected state into the core and carries on, so
 * one failing instruction doesn't hide the rest. Memory the failing
 * instruction should have written stays wrong, so later lines can fail
 * because of it.
 */
export function runNestest(
  rom: INesRom,
  log: LogLine[],
  { resync = false }: { resync?: boolean } = {},
): NestestResult {
  const runner = createRunner(rom);
  const result: NestestResult = {
    lines: log.length,
    matched: 0,
    mismatches: [],
    unofficial: { passed: [], failed: [] },
  };

  for (const [i, expected] of log.entries()) {
    const got = runner.next();
    const ok = diffFields(expected, got).length === 0;
    const culprit = log[i - 1];
    if (culprit?.unofficial)
      (ok ? result.unofficial.passed : result.unofficial.failed).push(culprit);
    if (ok) {
      result.matched++;
    } else {
      result.mismatches.push({ expected, got, culprit: culprit ?? expected });
      if (!resync) break;
      runner.load(expected);
    }
    runner.advance();
  }
  return result;
}

/** A readable report of the first mismatch. */
export function describeMismatch({ expected, got, culprit }: Mismatch): string {
  return [
    `line ${expected.line}: ${diffFields(expected, got).join(', ')} differ`,
    `  after  ${culprit.text}`,
    `  expect ${formatState(expected)}`,
    `  got    ${formatState(got)}`,
  ].join('\n');
}
