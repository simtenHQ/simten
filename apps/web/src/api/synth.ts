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

export async function handleVerilogImport(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response> {
  let body: { verilog?: string; top?: string; files?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.verilog !== 'string' || body.verilog.length === 0) {
    return Response.json({ success: false, error: 'verilog source is required' }, { status: 400 });
  }
  if (typeof body.top !== 'string' || body.top.length === 0) {
    return Response.json({ success: false, error: 'top module name is required' }, { status: 400 });
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
      verilog: body.verilog,
      top: body.top,
      target: 'import',
      files: body.files,
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
    // own warnings from the synth log (e.g. implicit/undeclared wires). Strip the
    // per-line source location so repeats collapse, dedupe, and cap the list.
    const yosysWarnings = (synthResult.log ?? '')
      .split('\n')
      .filter((l) => /Warning:/i.test(l))
      .map((l) => l.trim().replace(/\s+at\s+\S+:\d[\d.-]*\s*$/, ''));
    const allWarnings = [...new Set([...warnings, ...yosysWarnings])].slice(0, 12);
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
