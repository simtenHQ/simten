/**
 * read_waveform MCP tool — query VCD waveform files emitted by iverilog
 * cross-validation runs (or any other source that produces VCD).
 *
 * Returns *only the values you asked for, only at the cycles you asked
 * about*, in a token-efficient shape (positional pairs/triples, packed
 * strings for raw 1-bit traces, hex mirror for wide buses).
 *
 * Pipeline:
 *   1. Resolve vcd_path or test_name → absolute path. Sanity-guard the
 *      requested cycle range BEFORE any file I/O.
 *   2. parseVcd(path, { requestedSignals }) — single-pass: header phase
 *      builds signal maps, body phase only collects retained ids.
 *   3. detectClock + buildCycleMap.
 *   4. Format per request (changes / raw / edges) with output caps.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { parseVcd } from '../lib/vcd-parser.js';
import { detectClock, buildCycleMap } from '../lib/vcd-cycles.js';
import { formatSignals, type FormatKind, type EdgeKind } from '../lib/vcd-format.js';
import { resolveTestName } from '../lib/vcd-resolve-test.js';
import { findRepoRoot } from '../lib/repo-root.js';

const CYCLE_RANGE_HARD_CAP = 50_000;
const PER_SIGNAL_TXN_CAP = 200;
const RAW_CELL_CAP = 20_000;

const schemaShape = {
  vcd_path: z
    .string()
    .optional()
    .describe('Absolute or repo-relative path to a .vcd file. Mutually exclusive with test_name.'),
  test_name: z
    .string()
    .optional()
    .describe(
      'CPU verify-suite test name (e.g. "R-Type ADD basic"). Resolved via shared slugify to hardware/ulx3s/projects/cpu/.vcd/. Mutually exclusive with vcd_path.',
    ),
  signals: z
    .array(z.string())
    .min(1)
    .describe(
      'Signal paths or unique leaf names. Inputs containing "." are matched as full hierarchical paths; otherwise leaf-name match.',
    ),
  cycle_range: z
    .tuple([z.number().int().min(0), z.number().int().min(0)])
    .describe('Inclusive [from, to] cycle window. Cycle 0 = first rising edge of the clock.'),
  format: z
    .enum(['changes', 'raw', 'edges'])
    .optional()
    .default('changes')
    .describe(
      'changes (default): transitions in window + carry-in. raw: value at every cycle. edges: filtered transitions.',
    ),
  edge: z
    .enum(['rising', 'falling', 'any'])
    .optional()
    .default('rising')
    .describe('edges-format only.'),
  clock_signal: z.string().optional().describe('Override clock auto-detection.'),
};

const schema = z.object(schemaShape).refine((v) => Boolean(v.vcd_path) !== Boolean(v.test_name), {
  message: 'exactly one of vcd_path or test_name must be provided',
});

type Args = z.infer<typeof schema>;

interface ToolError {
  error: string;
  [k: string]: unknown;
}

interface ToolReturn {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [x: string]: unknown;
}

function errorReturn(payload: ToolError): ToolReturn {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

function successReturn(payload: unknown): ToolReturn {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function resolvePath(args: Pick<Args, 'vcd_path' | 'test_name'>): { path: string } | ToolError {
  if (args.vcd_path) {
    const p = resolve(findRepoRoot(), args.vcd_path);
    if (!existsSync(p)) return { error: 'vcd_not_found', path: p };
    return { path: p };
  }
  // test_name path
  try {
    const r = resolveTestName(args.test_name!);
    return { path: r.path };
  } catch (e) {
    const msg = (e as Error).message;
    return { error: 'vcd_not_found', message: msg };
  }
}

export async function handleReadWaveform(args: Args) {
  // 1. Sanity-guard cycle range BEFORE any file I/O.
  const [from, to] = args.cycle_range;
  if (to < from) {
    return errorReturn({
      error: 'invalid_cycle_range',
      cycle_range: [from, to],
      reason: 'to < from',
    });
  }
  const span = to - from + 1;
  if (span > CYCLE_RANGE_HARD_CAP) {
    return errorReturn({
      error: 'cycle_range_exceeds_cap',
      cap: CYCLE_RANGE_HARD_CAP,
      requested_span: span,
      format: args.format,
    });
  }

  // 2. Resolve vcd path.
  const resolved = resolvePath(args);
  if ('error' in resolved) return errorReturn(resolved);

  // 3. Parse VCD with retained-id selectivity. autoIncludeClock honors the
  // user's clock_signal override so the right clock id lands in the retained
  // set during the body walk.
  const parsed = await parseVcd(resolved.path, {
    requestedSignals: args.signals,
    autoIncludeClock: args.clock_signal ?? true,
  });

  // Resolution errors → first error wins (the tool returns isError on any).
  if (parsed.resolutionErrors.length > 0) {
    const first = parsed.resolutionErrors[0];
    return errorReturn(first as unknown as ToolError);
  }

  // 4. Clock detection.
  const det = detectClock(parsed, { clockSignal: args.clock_signal });
  if ('error' in det) {
    return errorReturn(det.error as unknown as ToolError);
  }
  const cycleMap = buildCycleMap(parsed, det.clock);

  // Cycle range must also fit within the simulation length.
  if (cycleMap.cycleTimes.length === 0) {
    return errorReturn({
      error: 'no_clock_edges',
      message: 'clock signal had no rising edges in the trace',
    });
  }
  if (to >= cycleMap.cycleTimes.length) {
    return errorReturn({
      error: 'cycle_range_out_of_bounds',
      cycle_range: [from, to],
      total_cycles: cycleMap.cycleTimes.length,
    });
  }

  // 5. Format.
  const formatted = formatSignals(parsed, cycleMap, parsed.resolved, {
    format: args.format as FormatKind,
    cycleRange: [from, to],
    edge: args.edge as EdgeKind,
    perSignalCap: PER_SIGNAL_TXN_CAP,
    rawCellCap: RAW_CELL_CAP,
    clockId: det.clock.id,
  });

  return successReturn({
    vcd: {
      path: resolved.path,
      timescale_ps: parsed.timescalePs,
      total_cycles: cycleMap.cycleTimes.length,
      clock_signal: det.clock.fullPath,
    },
    cycle_range: formatted.effectiveRange,
    signals: formatted.signals,
    warnings: parsed.warnings,
  });
}

export function registerReadWaveformTool(server: McpServer): void {
  server.tool(
    'read_waveform',
    'Query a VCD waveform file (from iverilog cross-validation runs or other simulators) for specific signals over a cycle window. Returns transitions or per-cycle values in a token-efficient shape. Use test_name (e.g. "R-Type ADD basic") for verify-suite VCDs, or vcd_path for arbitrary VCDs (e.g. ILA captures, simulate_firmware output). Format: "changes" (transitions + carry-in, default), "raw" (value at every cycle), "edges" (filtered transitions). Output is capped — narrow cycle_range or request fewer signals if you see truncated:true.',
    schemaShape,
    async (args) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success) {
        return errorReturn({
          error: 'invalid_args',
          message: parsed.error.message,
          issues: parsed.error.issues,
        });
      }
      return handleReadWaveform(parsed.data);
    },
  );
}
