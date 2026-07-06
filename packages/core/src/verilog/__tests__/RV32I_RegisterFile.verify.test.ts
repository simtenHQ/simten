/**
 * RV32I_RegisterFile co-simulation verification.
 *
 * Checks three non-obvious RISC-V contract points end-to-end:
 *   1. Register x0 is hardwired to zero — writes to it are discarded,
 *      reads always return 0, even right after a write.
 *   2. A write on posedge is visible on the rs1/rs2 reads the NEXT
 *      cycle, not immediately.
 *   3. The WS4b debug read port (`debug_rs` → `debug_read`) observes
 *      the same values as the architectural rs1/rs2 reads.
 *
 * Co-simulates against iverilog: both engines should agree on every
 * read cycle.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import { RV32I_RegisterFile } from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { exportVerilog } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { hasVerifier, verifyVerilog } from './verify.js';

interface Step {
  rs1: number;
  rs2: number;
  rd: number;
  write_data: number;
  we: number;
  debug_rs: number;
}

// Scenario covering all three contract points:
//   Cycles 1-3: write distinct values to x1, x5, x31
//   Cycle 4: try writing to x0 (should be ignored)
//   Cycles 5-8: read back each register via rs1 AND debug_rs in parallel
const SEQUENCE: Step[] = [
  { rs1: 0, rs2: 0, rd: 1, write_data: 0xaaaaaaaa, we: 1, debug_rs: 0 },
  { rs1: 0, rs2: 0, rd: 5, write_data: 0xbeef0000, we: 1, debug_rs: 0 },
  { rs1: 0, rs2: 0, rd: 31, write_data: 0xdeadbeef, we: 1, debug_rs: 0 },
  { rs1: 0, rs2: 0, rd: 0, write_data: 0xffffffff, we: 1, debug_rs: 0 }, // write to x0 — ignored
  { rs1: 1, rs2: 31, rd: 0, write_data: 0, we: 0, debug_rs: 5 },
  { rs1: 5, rs2: 1, rd: 0, write_data: 0, we: 0, debug_rs: 31 },
  { rs1: 0, rs2: 0, rd: 0, write_data: 0, we: 0, debug_rs: 0 }, // x0 via every port
  { rs1: 31, rs2: 5, rd: 0, write_data: 0, we: 0, debug_rs: 1 },
];

function buildRegfile() {
  const RegFileWrapper = circuit('RegFileWrapper', {
    inputs: {
      rs1: bus(5),
      rs2: bus(5),
      rd: bus(5),
      write_data: bus(32),
      we: bit,
      debug_rs: bus(5),
    },
    outputs: {
      read1: bus(32),
      read2: bus(32),
      debug_read: bus(32),
    },
    nodes: { rf: RV32I_RegisterFile },
    connect: ({ inputs, outputs, nodes: { rf } }) => [
      inputs.rs1.to(rf.rs1),
      inputs.rs2.to(rf.rs2),
      inputs.rd.to(rf.rd),
      inputs.write_data.to(rf.write_data),
      inputs.we.to(rf.we),
      inputs.debug_rs.to(rf.debug_rs),
      rf.read1.to(outputs.read1),
      rf.read2.to(outputs.read2),
      rf.debug_read.to(outputs.debug_read),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) =>
      name === 'RegFileWrapper'
        ? RegFileWrapper.circuit
        : name === 'RV32I_RegisterFile'
          ? RV32I_RegisterFile.circuit
          : undefined,
    getAllPrimitiveNames: () => ['RV32I_RegisterFile'],
  };

  return { circuit: RegFileWrapper.circuit, lib };
}

interface SampleOut {
  read1: number;
  read2: number;
  debug_read: number;
}

function runSimulator(steps: Step[]): SampleOut[] {
  const { circuit, lib } = buildRegfile();
  const sim = createSimulatorFromCircuit(circuit, lib);
  const outputs: SampleOut[] = [];
  for (const step of steps) {
    sim.setNode('rs1', step.rs1);
    sim.setNode('rs2', step.rs2);
    sim.setNode('rd', step.rd);
    sim.setNode('write_data', step.write_data);
    sim.setNode('we', step.we);
    sim.setNode('debug_rs', step.debug_rs);
    sim.tick();
    const pv = sim.getPortValues();
    const pick = (name: string) => {
      const v = pv.get(`__top__.${name}`);
      return typeof v === 'number' ? v >>> 0 : 0;
    };
    outputs.push({
      read1: pick('read1'),
      read2: pick('read2'),
      debug_read: pick('debug_read'),
    });
  }
  return outputs;
}

function buildVectors(steps: Step[]): SequentialTestVector[] {
  return steps.map((s, i) => ({
    cycle: i + 1,
    setInputs: {
      rs1: s.rs1,
      rs2: s.rs2,
      rd: s.rd,
      write_data: s.write_data,
      we: s.we,
      debug_rs: s.debug_rs,
    },
    expect: { read1: 0, read2: 0, debug_read: 0 },
  }));
}

const d = describe.skipIf(!hasVerifier());

d('RV32I_RegisterFile — JS simulator vs iverilog co-simulation', () => {
  it('x0 reads zero; writes visible next cycle; debug_read matches rs-port reads', {
    timeout: 30000,
  }, async () => {
    const simOutputs = runSimulator(SEQUENCE);

    // Extra sanity: x0 reads must always be 0, even after we wrote 0xFF
    // to rd=0 on cycle 4. Checks the simulator before we even call the
    // verifier.
    const x0Reads = simOutputs[6];
    expect(x0Reads.read1).toBe(0);
    expect(x0Reads.read2).toBe(0);
    expect(x0Reads.debug_read).toBe(0);

    const { circuit, lib } = buildRegfile();
    const { verilog } = exportVerilog(circuit, lib);
    const testbench = generateSequentialTestbench(circuit, buildVectors(SEQUENCE));

    const result = await verifyVerilog(verilog, testbench);

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('verifier response:', JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();
    expect(result.results!.length).toBe(SEQUENCE.length);

    const veriOutputs = result
      .results!.sort((a, b) => a.testCase - b.testCase)
      .map((r) => ({
        read1: r.outputs.read1 >>> 0,
        read2: r.outputs.read2 >>> 0,
        debug_read: r.outputs.debug_read >>> 0,
      }));

    expect(veriOutputs).toEqual(simOutputs);
  });
});
