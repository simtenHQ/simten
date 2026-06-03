#!/usr/bin/env tsx
/**
 * run-suite.ts — dev CLI: run the whole rv32i_m/I arch-test suite on the
 * unchanged simten core and diff each signature against Spike. Prints a table
 * and exits non-zero if any attempted test diverges or emits a trap op.
 *
 * The Tier-A testbench is conformance.verify.ts (same engine, via suite-lib).
 */

import { TESTS, SKIP, runOneTest } from './suite-lib.js';

let pass = 0, trapFree = 0, skipped = 0, attempted = 0;
for (const t of TESTS) {
  const r = runOneTest(t);
  if (r.skipped) { skipped++; console.log(`⏭️  ${r.test.padEnd(14)} SKIP       ${r.note}`); continue; }
  attempted++;
  if (r.pass) pass++;
  if (r.trapFree) trapFree++;
  console.log(`${r.pass ? '✅' : '❌'} ${r.test.padEnd(14)} ${r.trapFree ? 'trap-free' : 'HAS-TRAP '}  ${r.note}`);
}
console.log(`\n${pass}/${attempted} attempted pass vs Spike · ${trapFree}/${attempted} trap-free (pure RV32I) · ${skipped} skipped (logged above)`);
void SKIP;
process.exit(pass === attempted && trapFree === attempted ? 0 : 1);
