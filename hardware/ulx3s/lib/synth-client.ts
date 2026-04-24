/**
 * HTTP clients for the apps/synth container.
 *
 * The container exposes:
 *   POST /synth    → Yosys synth_ecp5 on Verilog → JSON netlist + stats
 *   POST /build    → nextpnr-ecp5 + ecppack on netlist → bitstream + timing/util
 *   POST /patch    → ecpbram + ecppack on cached .config + new hex → patched bitstream
 *
 * Endpoints are parsed out of cpu_build.ts (lines 389-438) and kept identical
 * in shape so behavior is unchanged for existing callers.
 */

import type { DeviceSpec } from './types.js';

export const SYNTH_URL = process.env.SYNTH_URL ?? 'http://localhost:8792/synth';
export const BUILD_URL = process.env.BUILD_URL ?? 'http://localhost:8792/build';
export const PATCH_URL = process.env.PATCH_URL ?? 'http://localhost:8792/patch';

export interface SynthResponse {
  success: boolean;
  netlist?: string;
  stats?: { cells?: number; wires?: number; cellBreakdown?: Record<string, number> };
  log: string;
  error?: string;
}

export interface BuildResponse {
  success: boolean;
  bitstream?: string; // base64
  config?: string; // base64-encoded .config (for later ecpbram patching)
  timing?: {
    achieved_mhz?: number;
    target_mhz?: number;
  } | Record<string, unknown>;
  utilization?: {
    lut?: number;
    ff?: number;
    bram?: number;
    io?: number;
  } | Record<string, unknown>;
  log: string;
  error?: string;
}

export interface PatchResponse {
  success: boolean;
  bitstream?: string; // base64
  log: string;
  error?: string;
}

export async function runSynth(args: {
  verilog: string;
  files: Record<string, string>;
  top: string;
  target?: 'ecp5';
}): Promise<SynthResponse> {
  const resp = await fetch(SYNTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: 'ecp5', ...args }),
  });
  return (await resp.json()) as SynthResponse;
}

export async function runBuild(args: {
  netlist: string;
  top: string;
  lpf: string;
  device: DeviceSpec;
}): Promise<BuildResponse> {
  const resp = await fetch(BUILD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      netlist: args.netlist,
      top: args.top,
      lpf: args.lpf,
      device: args.device.chip,
      package: args.device.package,
    }),
  });
  return (await resp.json()) as BuildResponse;
}

export async function runPatch(args: {
  config: string; // base64 cached .config
  fromHex: string; // previous $readmemh hex
  toHex: string; // new $readmemh hex
  top: string;
  device: DeviceSpec;
}): Promise<PatchResponse> {
  const resp = await fetch(PATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: args.config,
      fromHex: args.fromHex,
      toHex: args.toHex,
      top: args.top,
      device: args.device.chip,
      package: args.device.package,
    }),
  });
  return (await resp.json()) as PatchResponse;
}
