/**
 * RV32I ALU end-to-end bitstream test.
 *
 * RV32I_ALU → exportVerilog (synth_ecp5) → /synth → netlist JSON
 *           → /build (nextpnr-ecp5 + ecppack) → base64 bitstream
 *
 * Tests the purely combinational path — no clock, no flip-flops.
 * nextpnr handles combinational-only designs differently (no timing
 * constraint to meet), so this exercises a different code path than
 * the Counter (sequential) test.
 *
 * Requires SYNTH_URL to be set. Skipped otherwise.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bus, bit } from '../../circuit/index.js';
import { RV32I_ALU } from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';
import { buildBitstream, hasBuild } from './build.js';

function buildALU() {
  const ALU = circuit('RV32I_ALU_Top', {
    in: { a: bus(32), b: bus(32), alu_op: bus(4) },
    out: { result: bus(32), zero: bit },
    nodes: { alu: RV32I_ALU },
    connect: ({ in: i, out: o, alu }) => [
      i.a.to(alu.a), i.b.to(alu.b), i.alu_op.to(alu.alu_op),
      alu.result.to(o.result), alu.zero.to(o.zero),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => name === 'RV32I_ALU_Top' ? ALU.circuit : ALU._dependencies.get(name)?.circuit,
    getAllPrimitiveNames: () => [...ALU._dependencies.keys()],
  };

  return { circuit: ALU.circuit, lib };
}

const d = describe.skipIf(!hasSynth() || !hasBuild());

d('RV32I_ALU — full pipeline to ECP5 bitstream (combinational)', () => {
  it(
    'synth_ecp5 → nextpnr-ecp5 → ecppack → bitstream',
    { timeout: 180000 },
    async () => {
      const { circuit, lib } = buildALU();
      const exportResult = exportVerilog(circuit, lib, { target: 'synthesis' });

      // Step 1: Synthesise for ECP5
      const synthResp = await synthesizeVerilog(exportResult, 'RV32I_ALU_Top', 'ecp5');
      if (!synthResp.success) {
        console.error('synth failed:', JSON.stringify({ error: synthResp.error, log: synthResp.log?.slice(-500) }, null, 2));
      }
      expect(synthResp.success).toBe(true);
      expect(synthResp.netlist).toBeTruthy();

      // Step 2: Place-and-route + bitstream
      const buildResp = await buildBitstream(synthResp.netlist!, 'RV32I_ALU_Top');
      if (!buildResp.success) {
        console.error('build failed:', JSON.stringify({ error: buildResp.error, log: buildResp.log?.slice(-1000) }, null, 2));
      }

      expect(buildResp.success).toBe(true);
      expect(buildResp.bitstream).toBeTruthy();

      // Valid ECP5 bitstream
      const decoded = Buffer.from(buildResp.bitstream!, 'base64');
      expect(decoded.length).toBeGreaterThan(100_000);

      // Combinational design — may have no clocked timing report, that's fine
      // Utilization must show combinational cells
      expect(buildResp.utilization).toBeDefined();
      expect(buildResp.utilization!.comb).toBeGreaterThan(0);
    },
  );
});
