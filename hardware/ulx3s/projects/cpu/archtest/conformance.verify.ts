#!/usr/bin/env tsx
/**
 * conformance.verify.ts — Tier-A testbench: the simten RV32I core passes the
 * official riscv-arch-test RV32I-I suite vs Spike, in simulation.
 *
 * Each check compiles a vendored test, runs it on the unchanged structural
 * netlist (via simulate()) and on Spike, and asserts the signatures match (and
 * that the test is pure RV32I — no CSR/trap ops). The engine is suite-lib.ts;
 * harness validity (that a wrong datapath is caught) is proven separately by
 * fault-check.ts.
 *
 * Requires the local toolchain (riscv-none-elf-gcc + spike) — see README.md.
 */

import { verify, declareOracle, describe } from '@simten/core/verify';
import { TESTS, SKIP, runOneTest } from './suite-lib.js';

describe('RV32I_Core');
declareOracle({
  tier: 'A',
  type: 'Spike (riscv-isa-sim) signatures on official riscv/riscv-arch-test rv32i_m/I vectors @6f7f47b',
  independence_basis:
    'Reference signatures come from Spike — an independent third-party ISA ' +
    'simulator — run on the official vectors, decorrelated from this HDL. ' +
    'Accepted gap: the shared boot/halt env macros (model_test.h) are eaten ' +
    'identically by DUT and Spike, so they are NOT independently covered ' +
    '(no upstream reference sigs at this SHA). jalr-01 is skipped (binutils ' +
    '2.45 rejects its `la x0`); logged, not silently dropped.',
});

for (const t of TESTS) {
  if (SKIP[t]) { console.error(`SKIP ${t}: ${SKIP[t]}`); continue; }
  verify.exhaustive(`${t}: DUT signature == Spike (pure RV32I)`, [1], () => {
    const r = runOneTest(t);
    return r.pass && r.trapFree;
  });
}

verify.run();
