/**
 * Bitstream cache + ecpbram fast-path helpers.
 *
 * On a full synth+PnR build, the resulting .config (pre-ecppack) is cached in
 * hardware/ulx3s/.cache/ keyed by a hash of the Verilog with the firmware init
 * range zeroed out. On the next run, if the hash matches, we send the cached
 * config + new firmware hex to the synth container's /patch endpoint, which
 * runs ecpbram + ecppack to produce a patched bitstream without re-synthesising.
 *
 * The /patch endpoint is added in a follow-up step; until it exists, readCache()
 * returns null so runPipeline always falls through to the full build.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CacheEntry {
  /** Base64-encoded .config (pre-ecppack). */
  config: string;
  /** The firmware hex ($readmemh format) that produced the cached config. */
  firmwareHex: string;
  /** Top module name. */
  top: string;
  /** Device string (chip) used at synth time. */
  device: string;
  /** Package used at synth time. */
  package: string;
}

export interface CacheKey {
  /** Hash of the Verilog with firmware-init range zeroed. */
  verilogHash: string;
  /** Project name (scopes the cache per-project). */
  project: string;
}

function cacheDir(baseDir: string): string {
  const dir = resolve(baseDir, '.cache');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePath(baseDir: string, key: CacheKey): string {
  return resolve(cacheDir(baseDir), `${key.project}-${key.verilogHash}.json`);
}

/**
 * Compute a cache key from verilog source, zeroing the firmware-init byte
 * range if provided. A firmware-only edit leaves the hash stable.
 */
export function computeVerilogHash(
  verilog: string,
  firmwareInitRange?: { start: number; end: number },
): string {
  let toHash = verilog;
  if (firmwareInitRange) {
    const { start, end } = firmwareInitRange;
    toHash = verilog.slice(0, start) + '\0'.repeat(Math.max(0, end - start)) + verilog.slice(end);
  }
  return createHash('sha256').update(toHash).digest('hex').slice(0, 16);
}

export function readCache(baseDir: string, key: CacheKey): CacheEntry | null {
  const p = cachePath(baseDir, key);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as CacheEntry;
  } catch {
    return null;
  }
}

export function writeCache(baseDir: string, key: CacheKey, entry: CacheEntry): void {
  const p = cachePath(baseDir, key);
  writeFileSync(p, JSON.stringify(entry));
}
