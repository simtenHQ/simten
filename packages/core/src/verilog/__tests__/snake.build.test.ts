/**
 * Snake end-to-end bitstream test.
 *
 * Snake → exportVerilog (synth_ecp5) → /synth → netlist JSON
 *               → /build (nextpnr-ecp5 + ecppack) → base64 bitstream
 *
 * Snake is a complete 8×8 Snake game implemented entirely in logic
 * gates. It has a 4-phase pipeline, circular buffer body storage, DualPortRAM
 * framebuffer, and a VGA-style scan interface:
 *   in:  dir[2]       — 2-bit direction (0=up 1=right 2=down 3=left)
 *        scan_addr[6] — framebuffer scan address (driven by VGA counters)
 *   out: pixel_out[8] — framebuffer pixel value at scan_addr
 *
 * The circuit is the canonical copy from src/examples/snake.ts (shared with
 * the ULX3S FPGA project and the blog demo). No simulation-only primitives
 * (Screen, Input, Switch) — every node maps directly to ECP5 logic,
 * flip-flops, and block RAM.
 *
 * Requires SYNTH_URL to be set. Skipped automatically when unset.
 */

import { describe, it, expect } from 'vitest';
import { exportVerilog } from '../exporter.js';
import { buildSnake } from '../../examples/snake.js';
import { synthesizeVerilog, hasSynth } from './synth.js';
import { buildBitstream, hasBuild } from './build.js';

const d = describe.skipIf(!hasSynth() || !hasBuild());

d('Snake — full pipeline to ECP5 bitstream', () => {
  it('synth_ecp5 → nextpnr-ecp5 → ecppack → bitstream', { timeout: 300_000 }, async () => {
    // nextpnr is slower on a ~100-node circuit
    const { circuit, lib } = buildSnake();
    const exportResult = exportVerilog(circuit, lib, { target: 'synthesis' });

    // Step 1: Synthesise for ECP5 target
    const synthResp = await synthesizeVerilog(exportResult, 'Snake', 'ecp5');
    if (!synthResp.success) {
      console.error(
        'synth failed:',
        JSON.stringify({ error: synthResp.error, log: synthResp.log?.slice(-1000) }, null, 2),
      );
    }
    expect(synthResp.success).toBe(true);
    expect(synthResp.netlist).toBeTruthy();

    // Step 2: Place-and-route + bitstream
    const buildResp = await buildBitstream(synthResp.netlist!, 'Snake');
    if (!buildResp.success) {
      console.error(
        'build failed:',
        JSON.stringify({ error: buildResp.error, log: buildResp.log?.slice(-1500) }, null, 2),
      );
    }

    expect(buildResp.success).toBe(true);
    expect(buildResp.bitstream).toBeTruthy();

    // Bitstream should be a real ECP5 85K file (~1.8MB after ecppack)
    const decoded = Buffer.from(buildResp.bitstream!, 'base64');
    expect(decoded.length).toBeGreaterThan(100_000);

    // nextpnr reports ~99 MHz for Snake on ECP5 85K
    expect(buildResp.timing).toBeDefined();
    expect(buildResp.timing!.achieved_mhz).toBeGreaterThan(50);

    // Utilization: ~491 LUTs, ~51 FFs, 0 BRAM (RAM too small to infer block RAM)
    expect(buildResp.utilization).toBeDefined();
    expect(buildResp.utilization!.comb).toBeGreaterThan(100);
    expect(buildResp.utilization!.ff).toBeGreaterThan(10);
  });
});
