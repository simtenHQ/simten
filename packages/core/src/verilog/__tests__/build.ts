/**
 * nextpnr-ecp5 + ecppack build helper.
 *
 * Takes the netlist JSON string from a /synth response, runs place-and-route
 * via nextpnr-ecp5, then ecppack to produce a bitstream.
 *
 * Usage:
 *   import { buildBitstream, hasBuild } from './build.js';
 *
 *   const buildResp = await buildBitstream(synthResp.netlist!, 'Counter');
 *   expect(buildResp.success).toBe(true);
 *   expect(buildResp.bitstream).toBeTruthy();
 *
 * Reuses SYNTH_URL env var — derives the /build endpoint by replacing the
 * trailing '/synth' with '/build' (or appending '/build' if no path).
 * Set SYNTH_URL=http://localhost:8788/synth for local dev.
 */

export interface TimingStats {
  achieved_mhz: number;
  constraint_mhz: number;
}

export interface UtilStats {
  comb: number; // TRELLIS_COMB (combinational LUTs)
  ff: number; // TRELLIS_FF (flip-flops)
  bram: number; // TRELLIS_BRAM
  io: number; // TRELLIS_IO
}

export interface BuildResponse {
  success: boolean;
  bitstream?: string; // base64-encoded .bit file
  timing?: TimingStats;
  utilization?: UtilStats;
  log: string;
  error?: string;
}

export interface BuildOptions {
  lpf?: string; // LPF pin constraint file content
  device?: string; // default: "LFE5U-85F"
  package?: string; // default: "CABGA381"
}

/** True when SYNTH_URL is set (build endpoint lives on the same service). */
export function hasBuild(): boolean {
  return typeof process !== 'undefined' && !!process.env?.SYNTH_URL;
}

/** Derive /build URL from SYNTH_URL by replacing trailing /synth with /build. */
function buildUrl(): string | null {
  if (typeof process === 'undefined') return null;
  const base = process.env?.SYNTH_URL;
  if (!base) return null;
  // Replace trailing /synth (with optional trailing slash) or append /build
  return base.replace(/\/synth\/?$/, '/build');
}

/**
 * POST a Yosys netlist to the build service (nextpnr-ecp5 + ecppack).
 *
 * @param netlist - JSON string from SynthResponse.netlist
 * @param top     - Top module name
 * @param opts    - Optional LPF, device, package overrides
 */
export async function buildBitstream(
  netlist: string,
  top: string,
  opts: BuildOptions = {},
): Promise<BuildResponse> {
  const url = buildUrl();
  if (!url) {
    throw new Error('SYNTH_URL is not set. Skip build tests with `describe.skipIf(!hasBuild())`.');
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      netlist,
      top,
      lpf: opts.lpf ?? '',
      device: opts.device ?? 'LFE5U-85F',
      package: opts.package ?? 'CABGA381',
    }),
  });

  if (!resp.ok && resp.status !== 400) {
    throw new Error(`Build service returned HTTP ${resp.status}: ${await resp.text()}`);
  }

  return (await resp.json()) as BuildResponse;
}
