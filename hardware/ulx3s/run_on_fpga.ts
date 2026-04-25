#!/usr/bin/env tsx
/**
 * Unified flash + UART capture tool for tighter Claude/FPGA loops.
 *
 * Runs a project through the full pipeline (compile → synth → flash) and then
 * captures UART until a regex matches or a timeout fires. Emits a human log
 * followed by a structured JSON block so both humans and scripts (and the MCP
 * wrapper in packages/mcp/src/tools/run_on_fpga.ts) can consume the result.
 *
 * Usage (must run under tsx/node, not bun — Bun's NAPI layer doesn't yet
 * support serialport's libuv calls):
 *   pnpm fpga:run --project=cpu \
 *     --firmware=hardware/ulx3s/firmware/fibonacci.c \
 *     --match="514229" --timeout=5000
 *
 *   # or directly:
 *   tsx hardware/ulx3s/run_on_fpga.ts --project=cpu --firmware=... --match=...
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { runPipeline } from './lib/pipeline.js';
import { openAndCapture } from './lib/serial.js';
import { loadProjects, listProjects } from './projects/index.js';
import type { Project, RunResult } from './lib/types.js';

// ── Argv parsing ───────────────────────────────────────────────────────────

interface Args {
  project: string;
  firmware?: string;
  timeoutMs?: number;
  match?: string;
  noFlash: boolean;
  fullRebuild: boolean;
  verbose: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    project: '',
    noFlash: false,
    fullRebuild: false,
    verbose: false,
    help: false,
  };
  for (const raw of argv) {
    const arg = raw.replace(/^--/, '');
    if (arg === 'help' || arg === 'h') out.help = true;
    else if (arg === 'no-flash') out.noFlash = true;
    else if (arg === 'full-rebuild') out.fullRebuild = true;
    else if (arg === 'verbose') out.verbose = true;
    else if (arg.startsWith('project=')) out.project = arg.slice('project='.length);
    else if (arg.startsWith('firmware=')) out.firmware = arg.slice('firmware='.length);
    else if (arg.startsWith('timeout=')) out.timeoutMs = parseInt(arg.slice('timeout='.length), 10);
    else if (arg.startsWith('match=')) out.match = arg.slice('match='.length);
  }
  return out;
}

function usage(known: Record<string, Project>): string {
  return [
    'Usage: pnpm fpga:run --project=<name> [flags]',
    '       (or: tsx hardware/ulx3s/run_on_fpga.ts --project=<name> [flags])',
    '',
    'Projects: ' + listProjects(known).join(', '),
    '',
    'Flags:',
    '  --firmware=<path>     path to firmware source (required for projects with firmware)',
    '  --timeout=<ms>        UART capture timeout (default: project default or 5000)',
    '  --match=<regex>       regex to match against UART output; early-exit on hit',
    '  --no-flash            build only, skip flashing',
    '  --full-rebuild        skip ecpbram cache, force synth + PnR',
    '  --verbose             echo tool stdout (yosys, nextpnr) — default quiet',
    '  --help                show this',
  ].join('\n');
}

// ── picocom handling ───────────────────────────────────────────────────────

function killPicocomIfRunning(): { killed: boolean; pids: number[] } {
  const user = process.env.USER ?? '';
  const pg = spawnSync('pgrep', user ? ['-u', user, 'picocom'] : ['picocom'], { encoding: 'utf8' });
  if (pg.status !== 0 || !pg.stdout?.trim()) return { killed: false, pids: [] };
  const pids = pg.stdout.trim().split('\n').map((s) => parseInt(s, 10)).filter(Number.isFinite);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  // Small grace period for the port to release (synchronous busy-wait is OK
  // here — we're about to spawn a ~30s openFPGALoader anyway).
  const end = Date.now() + 600;
  while (Date.now() < end) {
    const check = spawnSync('pgrep', user ? ['-u', user, 'picocom'] : ['picocom']);
    if (check.status !== 0) break;
    spawnSync('sleep', ['0.05']);
  }
  return { killed: true, pids };
}

// ── Output formatting ──────────────────────────────────────────────────────

function printResult(result: RunResult, verbose: boolean): void {
  if (verbose) {
    // Human-friendly summary above the JSON block.
    console.log(`\nStage reached: ${result.stage}`);
    console.log(`Duration:      ${result.duration_ms} ms`);
    console.log(`Success:       ${result.success}`);
    if (result.error) {
      console.log(`Error stage:   ${result.error.stage}`);
      console.log(`Error:         ${result.error.message}`);
      if (result.error.suggestion) console.log(`Suggestion:    ${result.error.suggestion}`);
    }
    if (result.match) {
      console.log(`Match:         ${result.match.found ? 'FOUND' : 'NOT FOUND'} for /${result.match.pattern}/`);
    }
  }
  console.log('--- BEGIN JSON ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('--- END JSON ---');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const known = await loadProjects();

  if (args.help || !args.project) {
    console.log(usage(known));
    process.exit(args.help ? 0 : 1);
  }

  const project = known[args.project];
  if (!project) {
    console.error(`unknown project "${args.project}" — known: ${listProjects(known).join(', ')}`);
    process.exit(1);
  }

  const started = Date.now();
  const warnings: string[] = [];

  // Resolve firmware path (project-required or project-rejecting).
  let firmwareSourcePath: string | undefined;
  if (project.firmware) {
    if (!args.firmware) {
      const result: RunResult = {
        success: false,
        stage: 'compile',
        duration_ms: Date.now() - started,
        error: {
          stage: 'compile',
          message: `project "${project.name}" requires --firmware=<path>`,
          stderr_tail: '',
        },
        warnings,
      };
      printResult(result, args.verbose);
      process.exit(1);
    }
    firmwareSourcePath = resolve(process.cwd(), args.firmware);
  } else if (args.firmware) {
    warnings.push(`project "${project.name}" has no firmware; ignoring --firmware`);
  }

  // Kill picocom before flashing so we can reliably re-open the port.
  if (!args.noFlash) {
    const k = killPicocomIfRunning();
    if (k.killed) warnings.push(`killed picocom (pids: ${k.pids.join(', ')}) to free serial port`);
  }

  // ── Build + flash ────────────────────────────────────────────────────────
  const pipeline = await runPipeline({
    project,
    firmwareSourcePath,
    firmwareLanguage: firmwareSourcePath?.endsWith('.rs') ? 'rust' : 'c',
    flash: !args.noFlash,
    fullRebuild: args.fullRebuild,
    verbose: args.verbose,
  });
  warnings.push(...pipeline.warnings);

  if (!pipeline.ok) {
    const result: RunResult = {
      success: false,
      stage: pipeline.error?.stage ?? pipeline.stage,
      duration_ms: Date.now() - started,
      compile: pipeline.compile,
      synth: pipeline.synth,
      flash: pipeline.flash,
      error: pipeline.error,
      warnings,
    };
    printResult(result, args.verbose);
    process.exit(1);
  }

  // ── UART capture (optional) ──────────────────────────────────────────────
  let run: RunResult['run'];
  let match: RunResult['match'];

  if (!args.noFlash && project.uart) {
    const timeoutMs = args.timeoutMs ?? project.defaultTimeoutMs ?? 5000;
    const matchRegex = args.match ? new RegExp(args.match) : undefined;
    try {
      const cap = await openAndCapture({
        baud: project.uart.baud,
        timeoutMs,
        matchRegex,
      });
      run = {
        uart_bytes: cap.bytes,
        uart_string: cap.str,
        captured_ms: cap.captured_ms,
        partial: cap.partial,
      };
      if (args.match) {
        match = {
          pattern: args.match,
          found: cap.matchIndex !== undefined,
          position: cap.matchIndex,
        };
      }
    } catch (e) {
      const msg = (e as Error).message;
      const code = (e as NodeJS.ErrnoException).code;
      const result: RunResult = {
        success: false,
        stage: 'run',
        duration_ms: Date.now() - started,
        compile: pipeline.compile,
        synth: pipeline.synth,
        flash: pipeline.flash,
        error: {
          stage: 'run',
          message: msg,
          stderr_tail: '',
          suggestion:
            code === 'ENOENT'
              ? 'no /dev/cu.usbserial-* found — FPGA unplugged or driver missing'
              : undefined,
        },
        warnings,
      };
      printResult(result, args.verbose);
      process.exit(1);
    }
  }

  // ── Assemble final result ────────────────────────────────────────────────
  const matchFailed = !!args.match && (!match || !match.found);
  const finalStage: RunResult['stage'] = args.match
    ? 'match'
    : run
      ? 'run'
      : pipeline.flash
        ? 'flash'
        : 'synth';

  const result: RunResult = {
    success: !matchFailed,
    stage: finalStage,
    duration_ms: Date.now() - started,
    compile: pipeline.compile,
    synth: pipeline.synth,
    flash: pipeline.flash,
    run,
    match,
    warnings,
  };
  printResult(result, args.verbose);
  process.exit(result.success ? 0 : 1);
}

const isMainModule =
  (import.meta as { main?: boolean }).main ??
  (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
