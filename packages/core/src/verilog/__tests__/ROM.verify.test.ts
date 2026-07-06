/**
 * ROM co-simulation verification.
 *
 * Preloads a ROM with distinct values at a handful of addresses, exports
 * the circuit to Verilog, and asserts iverilog reads back the same
 * values the JS simulator does.
 *
 * Preloading path: real apps load ROM contents at runtime via
 * `sim.setNode(romNodeId, Map)` (see RV32I debugger). To exercise the
 * same data in the exported Verilog, we also inject the ROM's state
 * through a library override so the exporter's `collectStateInits`
 * picks it up at export time. Two paths, same data — and co-sim proves
 * they agree.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { generateSequentialTestbench, type SequentialTestVector } from '../testbench-gen.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { ROM } from '../../std/index.js';
import { createSimulatorFromCircuit } from '../../simulator/index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { verifyVerilog, hasVerifier } from './verify.js';

// Preloaded ROM contents: a handful of distinct values at scattered
// addresses. Lets us assert the init block is emitted with correct
// data AND that addressing works for the non-contiguous pattern.
const ROM_CONTENTS: Array<[number, number]> = [
  [0x0000, 0xde],
  [0x0001, 0xad],
  [0x0002, 0xbe],
  [0x0003, 0xef],
  [0x0010, 0xca],
  [0x0011, 0xfe],
];

// Addresses to read back in the test. Covers populated AND unpopulated
// addresses (the latter should read 0 from both simulators).
const READ_SEQUENCE: number[] = [0x0000, 0x0001, 0x0002, 0x0003, 0x0010, 0x0011, 0x0020, 0x0005];

function buildRom() {
  const RomWrapper = circuit('RomWrapper', {
    inputs: { addr: bus(16) },
    outputs: { data_out: bus(8) },
    nodes: { r: ROM },
    connect: ({ inputs, outputs, nodes: { r } }) => [
      inputs.addr.to(r.addr),
      r.data_out.to(outputs.data_out),
    ],
  });

  // Inject preloaded ROM state by constructing a custom library whose
  // `ROM` definition has `state[0].initialValue.data` populated. The
  // exporter's collectStateInits reads this at export time; the
  // simulator's initializer reads it at sim start.
  const romDefWithData: Circuit = {
    ...ROM.circuit,
    state: [
      {
        ...ROM.circuit.state[0],
        initialValue: {
          data: new Map<number, number>(ROM_CONTENTS),
          addressWidth: 16,
          dataWidth: 8,
        },
      },
    ],
  };

  const lib: CircuitLibrary = {
    resolveCircuit: (name) =>
      name === 'RomWrapper' ? RomWrapper.circuit : name === 'ROM' ? romDefWithData : undefined,
    getAllPrimitiveNames: () => ['ROM'],
  };

  return { circuit: RomWrapper.circuit, lib };
}

function runSimulator(addrs: number[]): number[] {
  const { circuit, lib } = buildRom();
  const sim = createSimulatorFromCircuit(circuit, lib);

  // Preload ROM contents the same way real apps do: setNode with a Map.
  // The flat node id for the `r: ROM` sub-node inside RomWrapper is `r`
  // at the top level. The simulator stores sequential state keyed by
  // flat node id, so this matches what the Verilog init block emits.
  sim.setNode('r', new Map<number, number>(ROM_CONTENTS));
  sim.runCombinational();

  const outputs: number[] = [];
  for (const addr of addrs) {
    sim.setNode('addr', addr);
    sim.tick();
    const v = sim.getPortValues().get('__top__.data_out');
    outputs.push(typeof v === 'number' ? (v >>> 0) & 0xff : 0);
  }
  return outputs;
}

function buildVectors(addrs: number[]): SequentialTestVector[] {
  return addrs.map((addr, i) => ({
    cycle: i + 1,
    setInputs: { addr },
    expect: { data_out: 0 },
  }));
}

const d = describe.skipIf(!hasVerifier());

d('ROM — JS simulator vs iverilog co-simulation (preloaded contents)', () => {
  it('reads back preloaded values and 0 at unpopulated addresses', { timeout: 30000 }, async () => {
    const simOutputs = runSimulator(READ_SEQUENCE);

    // Sanity: simulator should match ROM_CONTENTS exactly for the
    // populated addresses (catches accidental preload failures before
    // we even call the verifier).
    const expected = READ_SEQUENCE.map((a) => ROM_CONTENTS.find(([k]) => k === a)?.[1] ?? 0);
    expect(simOutputs).toEqual(expected);

    const { circuit, lib } = buildRom();
    const { verilog } = exportVerilog(circuit, lib);
    const testbench = generateSequentialTestbench(circuit, buildVectors(READ_SEQUENCE));

    const result = await verifyVerilog(verilog, testbench);

    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('verifier response:', JSON.stringify(result, null, 2));
    }

    expect(result.success).toBe(true);
    expect(result.results).toBeDefined();

    const veriOutputs = result
      .results!.sort((a, b) => a.testCase - b.testCase)
      .map((r) => r.outputs.data_out & 0xff);

    expect(veriOutputs).toEqual(simOutputs);
  });
});
