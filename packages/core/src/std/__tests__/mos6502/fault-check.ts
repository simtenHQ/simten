/**
 * Proves the Tom Harte harness can fail. Each fault below breaks the core in
 * one small, realistic way; the harness must report mismatches for every one.
 * Run after fetch-harte.ts:
 *
 *   npx tsx src/std/__tests__/mos6502/fault-check.ts
 *
 * Exits 0 when every fault is caught, 1 if the harness misses one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCircuitEval, registerCircuitEval } from '../../../circuit/eval-registry.js';
import { createHarteRunner, type HarteCase } from './harte.js';

type Eval = (inputs: Record<string, unknown>) => Record<string, unknown>;

interface Fault {
  name: string;
  component: string;
  opcodes: string[];
  wrap: (orig: Eval) => Eval;
}

const FAULTS: Fault[] = [
  {
    name: 'decimal ADC never adds $60 to the high nibble',
    component: 'MOS6502_ALU',
    opcodes: ['69'],
    wrap: (orig) => (i) => {
      const out = orig(i);
      if (!i.decimal || i.op !== 0) return out;
      const binary = orig({ ...i, decimal: 0 });
      return { ...out, result: ((out.result as number) - 0x60) & 0xff, c: binary.c };
    },
  },
  {
    name: 'indexed reads skip the page-cross cycle',
    component: 'MOS6502_DecodePLA',
    opcodes: ['bd', 'b1'],
    // acr is bit 3 of the timing state.
    wrap: (orig) => (i) => orig({ ...i, state: (i.state as number) & ~0x08 }),
  },
  {
    name: 'BRK pushes P without the B flag',
    component: 'MOS6502_DecodePLA',
    opcodes: ['00'],
    // B is bit 5 of the data latch's control bus.
    wrap: (orig) => (i) => {
      const out = orig(i);
      return { ...out, latch_ctrl: (out.latch_ctrl as number) & ~0x20 };
    },
  },
  {
    name: 'read-modify-write skips the dummy write',
    component: 'MOS6502_DecodePLA',
    opcodes: ['e6'],
    wrap: (orig) => (i) => {
      const out = orig(i);
      const ctrl = out.latch_ctrl as number;
      // The dummy write stores the unmodified operand (DOR source DATA = 7);
      // write is bit 1.
      return ((ctrl >> 2) & 7) === 7 ? { ...out, latch_ctrl: ctrl & ~0x02 } : out;
    },
  },
];

let blind = 0;
for (const fault of FAULTS) {
  const entry = getCircuitEval(fault.component);
  if (!entry) throw new Error(`no eval registered for ${fault.component}`);
  registerCircuitEval(fault.component, { ...entry, evalFn: fault.wrap(entry.evalFn as Eval) });
  try {
    const runner = createHarteRunner();
    let caught = 0;
    let total = 0;
    for (const op of fault.opcodes) {
      const cases: HarteCase[] = JSON.parse(
        readFileSync(join(import.meta.dirname, 'vectors', `${op}.json`), 'utf8'),
      );
      for (const c of cases.slice(0, 2000)) {
        total++;
        if (runner.run(c) !== null) caught++;
      }
    }
    console.log(`${caught ? 'caught' : 'MISSED'}  ${fault.name}: ${caught}/${total} cases fail`);
    if (!caught) blind++;
  } finally {
    registerCircuitEval(fault.component, entry);
  }
}
process.exit(blind ? 1 : 0);
