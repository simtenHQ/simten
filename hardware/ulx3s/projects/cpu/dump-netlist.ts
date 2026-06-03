#!/usr/bin/env bun
/**
 * Dump the elaborated flat netlist of RV32I_CPU_Core as canonical JSON.
 *
 * This is the FPGA byte-identity invariant (see GOLDEN.md): it is *pre-codegen*
 * (the circuit IR after elaboration, before the Verilog exporter), so it is
 * stable against exporter/toolchain churn and isolates exactly the question the
 * consolidation cares about — did the circuit change?
 *
 *   bun hardware/ulx3s/projects/cpu/dump-netlist.ts            # print to stdout
 *   bun hardware/ulx3s/projects/cpu/dump-netlist.ts --check    # diff vs golden, exit 1 on drift
 *
 * `--check` regenerates and compares against netlist.golden.json. A non-empty
 * diff means the FPGA netlist moved. If that change is INTENTIONAL, do not just
 * regenerate the golden — follow the update ritual in GOLDEN.md (re-flash + run
 * firmware on a real ULX3S, record the evidence), because the golden's authority
 * comes entirely from the last hardware-verified netlist behind it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { elaborate } from '@simten/core/simulator';
import { buildCPUCore } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(__dirname, 'netlist.golden.json');

/** Canonical, deterministic serialization of the flattened RV32I_CPU_Core netlist. */
export function dumpNetlist(): string {
  const { circuit, lib } = buildCPUCore();
  const flat = elaborate(circuit, lib, false, { expandReferences: true });

  const canonical = {
    top: circuit.name,
    nodes: flat.nodes.map((n) => ({
      id: n.id,
      primitiveType: n.primitiveType,
      arguments: n.arguments,
    })),
    connections: flat.connections.map((c) => ({
      source: c.source,
      target: c.target,
      portType: c.portType,
    })),
  };

  return JSON.stringify(canonical, null, 2) + '\n';
}

function main() {
  const json = dumpNetlist();

  if (process.argv.includes('--check')) {
    let golden: string;
    try {
      golden = readFileSync(GOLDEN_PATH, 'utf8');
    } catch {
      console.error(`No golden at ${GOLDEN_PATH}. Generate it with: bun ${process.argv[1]} > netlist.golden.json`);
      process.exit(1);
    }
    if (json !== golden) {
      console.error('✗ FPGA netlist drifted from netlist.golden.json.');
      console.error('  If unintentional: a node/connection order or argument changed in the shared core.');
      console.error('  If intentional: follow the update ritual in hardware/ulx3s/projects/cpu/GOLDEN.md');
      console.error('  (re-flash + run firmware on a real ULX3S, then regenerate the golden).');
      process.exit(1);
    }
    console.log('✓ FPGA netlist matches golden.');
    return;
  }

  if (process.argv.includes('--write')) {
    writeFileSync(GOLDEN_PATH, json);
    console.error(`Wrote ${GOLDEN_PATH}`);
    return;
  }

  process.stdout.write(json);
}

const isMain = (import.meta as { main?: boolean }).main
  ?? (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url));
if (isMain) main();
