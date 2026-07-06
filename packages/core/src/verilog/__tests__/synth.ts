/**
 * Yosys synthesis smoke-test helper.
 *
 * Tests that use this helper POST an `{ verilog, files, top, target }` request
 * to the deployed Cloudflare Workers synth service (which runs Yosys in a
 * container) and assert on the parsed response. Used to prove that exported
 * Verilog is actually synthesizable, not just simulatable.
 *
 * Usage:
 *   import { synthesizeVerilog, hasSynth } from './synth.js';
 *
 *   describe.skipIf(!hasSynth())('HalfAdder synthesis', () => {
 *     it('synthesizes cleanly', async () => {
 *       const result = exportVerilog(circuit, library, { target: 'synthesis' });
 *       const resp = await synthesizeVerilog(result, 'HalfAdder');
 *       expect(resp.success).toBe(true);
 *       expect(resp.stats?.cells).toBeGreaterThan(0);
 *     });
 *   });
 *
 * Set `SYNTH_URL` to the deployed Worker endpoint (including `/synth` path)
 * or `http://localhost:55003/synth` for the local container.
 * When unset, `hasSynth()` returns false and tests should skip.
 */

import type { ExportResult } from '../types.js';

export type SynthTarget = 'generic' | 'ice40' | 'ecp5';

export interface SynthStats {
  cells: number;
  wires: number;
  cellBreakdown: Record<string, number>;
}

export interface SynthResponse {
  success: boolean;
  stats?: SynthStats;
  netlist?: string;
  log: string;
  error?: string;
}

/** True when SYNTH_URL is set. Use with `describe.skipIf(!hasSynth())`. */
export function hasSynth(): boolean {
  return typeof process !== 'undefined' && !!process.env?.SYNTH_URL;
}

/** Resolved synth endpoint or null when unset. */
export function synthUrl(): string | null {
  if (typeof process === 'undefined') return null;
  return process.env?.SYNTH_URL ?? null;
}

/**
 * POST Verilog to the synth service and return the parsed response.
 * Throws only on network failures — synthesis errors come back as
 * `{ success: false, error }` on the response.
 *
 * @param result  - ExportResult from exportVerilog(..., { target: 'synthesis' })
 * @param top     - Top module name (must match the module name in the Verilog)
 * @param target  - Synthesis target (default: 'generic')
 */
export async function synthesizeVerilog(
  result: ExportResult,
  top: string,
  target: SynthTarget = 'generic',
): Promise<SynthResponse> {
  const url = synthUrl();
  if (!url) {
    throw new Error('SYNTH_URL is not set. Skip synth tests with `describe.skipIf(!hasSynth())`.');
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verilog: result.verilog,
      files: result.files,
      top,
      target,
    }),
  });

  if (!resp.ok && resp.status !== 400) {
    throw new Error(`Synth service returned HTTP ${resp.status}: ${await resp.text()}`);
  }

  return (await resp.json()) as SynthResponse;
}
