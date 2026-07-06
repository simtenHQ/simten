/**
 * Generic FPGA build pipeline: compile firmware → build verilog → synth → PnR
 * → flash. Knows nothing about any specific project; everything
 * project-specific flows through the Project descriptor in types.ts.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeVerilogHash, readCache, writeCache } from './ecpbram.js';
import { runBuild, runPatch, runSynth } from './synth-client.js';
import type {
  CompileStageResult,
  FirmwareBuild,
  FlashStageResult,
  PipelineOptions,
  PipelineResult,
  StageError,
  SynthStageResult,
} from './types.js';

export const HARDWARE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function suggestForSynthError(msg: string): string | undefined {
  const m = msg.toLowerCase();
  if (m.includes('econnrefused') || m.includes('fetch failed')) {
    return 'synth container down — start apps/synth (docker run -p 8792:8080 simten-synth-local)';
  }
  return undefined;
}

function suggestForFlashError(stderr: string): string | undefined {
  if (/unable to open|resource busy/i.test(stderr)) return 'picocom still running?';
  if (/no supported device/i.test(stderr)) return 'FPGA not detected — check USB cable / power';
  return undefined;
}

export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const { project } = opts;
  const baseDir = HARDWARE_DIR;
  const warnings: string[] = [];

  // ── Stage: compile firmware (if project has one) ──────────────────────────
  let firmware: FirmwareBuild | undefined;
  let compile: CompileStageResult | undefined;
  let firmwareHex: string | undefined;

  if (project.firmware) {
    if (!opts.firmwareSourcePath) {
      return fail(
        'compile',
        'project requires firmware but no --firmware given',
        '',
        'pass --firmware=<path> to a C/Rust source file',
      );
    }
    const source = readFileSync(opts.firmwareSourcePath, 'utf8');
    const language = opts.firmwareLanguage ?? inferLanguage(opts.firmwareSourcePath);
    try {
      firmware = await project.firmware.compile(source, { language });
    } catch (e) {
      const msg = (e as Error).message;
      return fail('compile', msg, msg.slice(-1000));
    }
    const fits_imem = firmware.binary.length <= project.firmware.imemBytes;
    compile = {
      firmware_bytes: firmware.binary.length,
      fits_imem,
      disassembly_first_40_lines: firmware.disassembly
        ? firmware.disassembly.split('\n').slice(0, 40).join('\n')
        : undefined,
    };
    if (!fits_imem) {
      return {
        ok: false,
        stage: 'compile',
        compile,
        warnings,
        error: {
          stage: 'compile',
          message: `firmware is ${firmware.binary.length} bytes; IMEM limit is ${project.firmware.imemBytes} bytes`,
          stderr_tail: '',
          suggestion: `expand IMEM or shrink firmware (project ${project.name} limit ${project.firmware.imemBytes} B)`,
        },
      };
    }
  }

  // ── Stage: build verilog ──────────────────────────────────────────────────
  let built;
  try {
    built = await project.buildVerilog({ baseDir, firmware });
  } catch (e) {
    const msg = (e as Error).message;
    return fail('synth', `buildVerilog failed: ${msg}`, msg.slice(-1000));
  }

  // Extract the $readmemh hex for the cache + patch paths (if the project
  // supplies one in extraFiles keyed by any .hex name).
  const hexKey = Object.keys(built.extraFiles ?? {}).find((k) => k.endsWith('.hex'));
  firmwareHex = hexKey ? built.extraFiles![hexKey] : undefined;

  // ── Stage: synth + PnR (with optional ecpbram fast path) ──────────────────
  let synth: SynthStageResult | undefined;
  let bitstream: Buffer | undefined;

  const cacheKey = {
    project: project.name,
    verilogHash: computeVerilogHash(built.verilog, built.firmwareInitRange),
  };

  const cached = opts.fullRebuild ? null : readCache(baseDir, cacheKey);
  const canFastPath = cached && firmwareHex && cached.firmwareHex !== firmwareHex;

  if (canFastPath) {
    try {
      const patchResp = await runPatch({
        config: cached!.config,
        fromHex: cached!.firmwareHex,
        toHex: firmwareHex!,
        top: built.topModule,
        device: built.device,
      });
      if (patchResp.success && patchResp.bitstream) {
        bitstream = Buffer.from(patchResp.bitstream, 'base64');
        synth = {
          cached: true,
          bitstream_kb: Math.round(bitstream.length / 1024),
          warnings: [],
        };
        // Update cache with the new firmware hex for next-iteration fast path.
        writeCache(baseDir, cacheKey, { ...cached!, firmwareHex: firmwareHex! });
      } else {
        warnings.push(`fast path unavailable: ${patchResp.error ?? 'patch returned no bitstream'}`);
      }
    } catch (e) {
      warnings.push(`fast path failed: ${(e as Error).message} — falling through to full build`);
    }
  }

  if (!bitstream) {
    // Full synth + PnR path.
    try {
      const synthResp = await runSynth({
        verilog: built.verilog,
        files: built.extraFiles ?? {},
        top: built.topModule,
      });
      if (!synthResp.success) {
        return fail(
          'synth',
          synthResp.error ?? 'synth failed',
          (synthResp.log ?? '').slice(-1000),
          suggestForSynthError(synthResp.error ?? synthResp.log ?? ''),
        );
      }

      const buildResp = await runBuild({
        netlist: synthResp.netlist!,
        top: built.topModule,
        lpf: built.lpf,
        device: built.device,
      });
      if (!buildResp.success) {
        return fail(
          'synth',
          buildResp.error ?? 'build failed',
          (buildResp.log ?? '').slice(-1000),
          suggestForSynthError(buildResp.error ?? buildResp.log ?? ''),
        );
      }

      bitstream = Buffer.from(buildResp.bitstream!, 'base64');
      const synthWarnings = extractWarnings(synthResp.log ?? '');
      synth = {
        cached: false,
        bitstream_kb: Math.round(bitstream.length / 1024),
        timing_achieved_mhz: extractAchievedMhz(buildResp.timing),
        timing_target_mhz: extractTargetMhz(buildResp.timing),
        utilization: extractUtilization(buildResp.utilization),
        warnings: synthWarnings,
      };

      // Cache the post-PnR config for future firmware-only fast-path hits.
      if (buildResp.config && firmwareHex) {
        writeCache(baseDir, cacheKey, {
          config: buildResp.config,
          firmwareHex,
          top: built.topModule,
          device: built.device.chip,
          package: built.device.package,
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      return fail('synth', msg, msg.slice(-1000), suggestForSynthError(msg));
    }
  }

  // ── Stage: write bitstream ────────────────────────────────────────────────
  // Write into the project's own folder so each project is self-contained
  // and artifacts are easy to .gitignore via a projects/*/*.bit rule.
  const bitPath = resolve(project.projectDir, project.bitFile);
  writeFileSync(bitPath, bitstream);

  // ── Stage: flash (optional) ───────────────────────────────────────────────
  let flash: FlashStageResult | undefined;
  if (opts.flash) {
    const started = Date.now();
    const proc = spawnSync('openFPGALoader', ['-b', 'ulx3s', bitPath], {
      encoding: 'utf8',
    });
    const duration = Date.now() - started;
    if (proc.status !== 0) {
      const stderr = (proc.stderr ?? '') + (proc.stdout ?? '');
      return {
        ok: false,
        stage: 'flash',
        compile,
        synth,
        warnings,
        bitstream,
        error: {
          stage: 'flash',
          message: `openFPGALoader exited ${proc.status}`,
          stderr_tail: stderr.slice(-1500),
          suggestion: suggestForFlashError(stderr),
        },
      };
    }
    flash = { flashed: true, flash_duration_ms: duration };
  }

  return {
    ok: true,
    stage: flash ? 'flash' : 'synth',
    compile,
    synth,
    flash,
    warnings,
    bitstream,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

function fail(
  stage: StageError['stage'],
  message: string,
  stderr_tail: string,
  suggestion?: string,
): PipelineResult {
  return {
    ok: false,
    stage: stage === 'run' || stage === 'match' ? 'flash' : stage,
    warnings: [],
    error: { stage, message, stderr_tail, suggestion },
  };
}

function inferLanguage(path: string): string {
  if (path.endsWith('.rs')) return 'rust';
  if (path.endsWith('.s') || path.endsWith('.S')) return 'asm';
  return 'c';
}

function extractWarnings(log: string): string[] {
  return log
    .split('\n')
    .filter((l) => /warning/i.test(l) || /readmem/i.test(l))
    .slice(0, 20);
}

function extractAchievedMhz(t: unknown): number | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const rec = t as Record<string, unknown>;
  const v = rec.achieved_mhz ?? rec.achievedMhz ?? rec.achieved ?? rec.maxFrequencyMhz;
  return typeof v === 'number' ? v : undefined;
}

function extractTargetMhz(t: unknown): number | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const rec = t as Record<string, unknown>;
  const v = rec.target_mhz ?? rec.targetMhz ?? rec.target;
  return typeof v === 'number' ? v : undefined;
}

function extractUtilization(u: unknown): SynthStageResult['utilization'] {
  if (!u || typeof u !== 'object') return undefined;
  const rec = u as Record<string, unknown>;
  const pick = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'number') return v;
    }
    return undefined;
  };
  return {
    lut: pick('lut', 'LUT', 'trellis_comb', 'TRELLIS_COMB') ?? 0,
    ff: pick('ff', 'FF', 'trellis_ff', 'TRELLIS_FF') ?? 0,
    bram: pick('bram', 'BRAM', 'trellis_bram', 'TRELLIS_BRAM') ?? 0,
    io: pick('io', 'IO', 'trellis_io', 'TRELLIS_IO'),
  };
}
