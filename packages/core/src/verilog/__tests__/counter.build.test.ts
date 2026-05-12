/**
 * Counter end-to-end bitstream test.
 *
 * Counter → exportVerilog (synth_ecp5) → /synth → netlist JSON
 *         → /build (nextpnr-ecp5 + ecppack) → base64 bitstream
 *
 * Proves the full TS → Verilog → synthesis → place-and-route → bitstream
 * pipeline works for a simple sequential circuit. The returned bitstream
 * is a real ECP5 85K .bit file ready to flash to a ULX3S board.
 *
 * Requires SYNTH_URL to be set (same env var as synth tests).
 * Skipped automatically when SYNTH_URL is not set.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import { Adder, Register, Constant, Mux, Or } from '../../std/index.js';
import type { CircuitLibrary } from '../../types/circuit.js';
import { synthesizeVerilog, hasSynth } from './synth.js';
import { buildBitstream, hasBuild } from './build.js';

function buildCounter() {
  const Counter = circuit('Counter', {
    inputs: { enable: bit, clear: bit },
    outputs: { count: bus(8) },
    nodes: { reg: Register(), add: Adder(), one: Constant({ value: 1 }), zero: Constant({ value: 0 }), mux: Mux(), weOr: Or },
    connect: ({ inputs, outputs, nodes: { reg, add, one, zero, mux, weOr } }) => [
      reg.q.to(add.a, outputs.count),
      one.out.to(add.b),
      zero.out.to(add.carry_in, mux.in1),
      add.sum.to(mux.in0),
      inputs.clear.to(mux.sel, weOr.a),
      inputs.enable.to(weOr.b),
      weOr.out.to(reg.we),
      mux.out.to(reg.data),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'Counter') return Counter.circuit;
      return Counter._dependencies.get(name)?.circuit;
    },
    getAllPrimitiveNames: () => [...Counter._dependencies.keys()],
  };

  return { circuit: Counter.circuit, lib };
}

const d = describe.skipIf(!hasSynth() || !hasBuild());

d('Counter — full pipeline to ECP5 bitstream', () => {
  it(
    'synth_ecp5 → nextpnr-ecp5 → ecppack → bitstream',
    { timeout: 180000 },
    async () => {
      const { circuit, lib } = buildCounter();
      const exportResult = exportVerilog(circuit, lib, { target: 'synthesis' });

      // Step 1: Synthesise for ECP5 target
      const synthResp = await synthesizeVerilog(exportResult, 'Counter', 'ecp5');
      if (!synthResp.success) {
        console.error('synth failed:', JSON.stringify({ error: synthResp.error, log: synthResp.log?.slice(-500) }, null, 2));
      }
      expect(synthResp.success).toBe(true);
      expect(synthResp.netlist).toBeTruthy();

      // Step 2: Place-and-route + bitstream
      const buildResp = await buildBitstream(synthResp.netlist!, 'Counter');
      if (!buildResp.success) {
        console.error('build failed:', JSON.stringify({ error: buildResp.error, log: buildResp.log?.slice(-1000) }, null, 2));
      }

      expect(buildResp.success).toBe(true);
      expect(buildResp.bitstream).toBeTruthy();

      // Bitstream should decode to a non-trivial file
      const decoded = Buffer.from(buildResp.bitstream!, 'base64');
      expect(decoded.length).toBeGreaterThan(100_000); // ECP5 85K ~7MB

      // Timing: nextpnr should report a plausible clock frequency
      expect(buildResp.timing).toBeDefined();
      expect(buildResp.timing!.achieved_mhz).toBeGreaterThan(0);

      // Utilization: counter must use at least some combinational cells
      expect(buildResp.utilization).toBeDefined();
      expect(buildResp.utilization!.comb).toBeGreaterThan(0);
    },
  );
});
