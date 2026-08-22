/**
 * Verilog Import API Handler — Verilog source → clean, editable simten TypeScript.
 *
 * Runs yosys on the synth container (the `import` target: generic RTL netlist,
 * no techmapping) then lifts that netlist into simten source with
 * @simten/core's importer. The lift is pure TS and runs here in the worker.
 *
 * Production: uses the SYNTH Cloudflare service binding.
 * Local dev:  falls back to the synth container on localhost:8792.
 */

import { buildFromIR, circuitToSource } from '@simten/core/circuit';
import { importNetlist, type YosysNetlist } from '@simten/core/import';

interface SynthContainerResponse {
  success: boolean;
  netlist?: string;
  stats?: { cells: number; wires: number; cellBreakdown: Record<string, number> };
  log?: string;
  error?: string;
}

/** One file written into the container's work directory at `path`. */
interface SourceFile {
  path: string;
  content: string;
}

/** One `chparam -set` assignment applied to the top module before elaboration. */
interface Param {
  name: string;
  value: string;
  kind: 'string' | 'number';
}

interface ImportBody {
  verilog?: string;
  sources?: SourceFile[];
  includes?: SourceFile[];
  files?: Record<string, string>;
  params?: Param[];
  top?: string;
}

// The container interpolates paths, parameter names and parameter values into a
// single `yosys -p` script and rejects anything outside these charsets. The
// same checks run here so a typo comes back as one sentence from the worker
// instead of a yosys parse error relayed through three hops.
//
// Sizes are deliberately NOT re-checked here: the container owns that budget
// (`maxSourceSize`/`maxFilesSize`) and already answers with a clear message, and
// a third copy of the numbers is the drift `scripts/check-synth-limits.ts`
// exists to prevent.
const IDENT = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const INT_VALUE = /^-?[0-9]+$/;
const SIZED_VALUE = /^[0-9]*'[sS]?[bBoOdDhH][0-9a-fA-FxXzZ_]+$/;
const STRING_VALUE = /^[A-Za-z0-9._/+-]{0,128}$/;
const PATH_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const MAX_PATH_DEPTH = 8;

function checkPath(path: unknown, what: string): string | undefined {
  if (typeof path !== 'string' || path.length === 0) return `${what}: every file needs a path`;
  if (path.startsWith('/')) return `${what}: absolute paths are not allowed (${path})`;
  const segments = path.split('/');
  if (segments.length > MAX_PATH_DEPTH)
    return `${what}: ${path} is more than ${MAX_PATH_DEPTH} levels deep`;
  for (const segment of segments) {
    if (!PATH_SEGMENT.test(segment)) {
      return `${what}: "${segment}" is not allowed in ${path} — letters, digits, '_', '.' and '-', with no leading dot and no '..'`;
    }
  }
  return undefined;
}

function checkParam(p: Param): string | undefined {
  if (!IDENT.test(p.name ?? '')) return `"${p.name}" is not a valid parameter name`;
  if (p.kind === 'string') {
    return STRING_VALUE.test(p.value)
      ? undefined
      : `parameter ${p.name}: "${p.value}" must be at most 128 characters of letters, digits, '.', '_', '/', '+' and '-'`;
  }
  return INT_VALUE.test(p.value) || SIZED_VALUE.test(p.value)
    ? undefined
    : `parameter ${p.name}: "${p.value}" is neither an integer nor a Verilog sized constant`;
}

/** First failing check across the whole request, or undefined if it is clean. */
function validateImport(body: ImportBody): string | undefined {
  if (!IDENT.test(body.top ?? '')) return `"${body.top}" is not a valid module name`;
  for (const [what, list] of [
    ['source', body.sources],
    ['include', body.includes],
  ] as const) {
    for (const f of list ?? []) {
      const bad = checkPath(f?.path, what);
      if (bad) return bad;
      if (typeof f?.content !== 'string') return `${what} ${f?.path}: missing content`;
    }
  }
  for (const name of Object.keys(body.files ?? {})) {
    const bad = checkPath(name, 'data file');
    if (bad) return bad;
  }
  for (const p of body.params ?? []) {
    const bad = checkParam(p);
    if (bad) return bad;
  }
  return undefined;
}

export async function handleVerilogImport(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response> {
  let body: ImportBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // A pasted module arrives as `verilog`, a project as `sources`. Either alone
  // is a complete request.
  const hasVerilog = typeof body.verilog === 'string' && body.verilog.length > 0;
  const hasSources = Array.isArray(body.sources) && body.sources.length > 0;
  if (!hasVerilog && !hasSources) {
    return Response.json({ success: false, error: 'verilog source is required' }, { status: 400 });
  }
  if (typeof body.top !== 'string' || body.top.length === 0) {
    return Response.json({ success: false, error: 'top module name is required' }, { status: 400 });
  }

  const invalid = validateImport(body);
  if (invalid) {
    return Response.json({ success: false, error: invalid }, { status: 400 });
  }

  // Rate limit — yosys is CPU-heavy and the container has few instances, so keep
  // this modest per IP (5/min). Mirrors the compile/verify handlers.
  const rl = (
    env as { SYNTH_RL?: { limit: (k: { key: string }) => Promise<{ success: boolean }> } }
  ).SYNTH_RL;
  if (rl) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await rl.limit({ key: ip });
    if (!success) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded — try again in a minute' },
        { status: 429 },
      );
    }
  }

  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verilog: body.verilog ?? '',
      sources: body.sources ?? [],
      includes: body.includes ?? [],
      files: body.files ?? {},
      params: body.params ?? [],
      top: body.top,
      target: 'import',
    }),
  };

  // Service binding (production) → local synth container fallback (dev)
  const synth = env.SYNTH as { fetch: typeof fetch } | undefined;

  let synthResult: SynthContainerResponse;
  try {
    const resp = synth
      ? await synth.fetch('https://synth/synth', reqInit)
      : await fetch('http://localhost:8792/synth', reqInit);
    synthResult = await resp.json();
  } catch (e) {
    return Response.json(
      {
        success: false,
        error: `Synth service error: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 502 },
    );
  }

  if (!synthResult.success || !synthResult.netlist) {
    // yosys couldn't elaborate the Verilog (syntax error, wrong top, …).
    return Response.json(
      {
        success: false,
        error: synthResult.error ?? 'yosys elaboration failed',
        log: synthResult.log,
      },
      { status: 422 },
    );
  }

  // Lift the generic RTL netlist into clean, editable simten source. The
  // importer throws on cell types outside its scope (e.g. $adff/$sdff/$dffe —
  // see issue #237) rather than mis-translate; surface that as a clean 422 with
  // an `unsupported` flag the UI can special-case.
  try {
    const netlist = JSON.parse(synthResult.netlist) as YosysNetlist;
    const { top, library, warnings } = importNetlist(netlist, body.top);
    const deps = [...library.values()].filter((c) => c.name !== top.name);
    const source = circuitToSource(buildFromIR(top, deps));
    // Non-fatal notes: the importer's warnings (e.g. undriven nets) plus yosys's
    // own warnings from the synth log (e.g. implicit/undeclared wires). Drop the
    // line number so repeats of the same problem collapse, but keep the
    // filename — across a 27-file project the old strip took the file with it
    // and merged unrelated warnings from different modules into one entry.
    const yosysWarnings = (synthResult.log ?? '')
      .split('\n')
      .filter((l) => /Warning:/i.test(l))
      .map((l) => l.trim().replace(/(\s+at\s+\S+?):\d[\d.-]*\s*$/, '$1'));
    const allWarnings = [...new Set([...warnings, ...yosysWarnings])].slice(0, 25);
    return Response.json({
      success: true,
      source,
      stats: synthResult.stats,
      warnings: allWarnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        success: false,
        error: `Import failed: ${msg}`,
        unsupported: /unsupported cell/i.test(msg),
      },
      { status: 422 },
    );
  }
}
