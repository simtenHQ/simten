import { Container, getContainer } from '@cloudflare/containers';
import { Hono } from 'hono';

// --- Container Definition ---

export class SynthContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '2m';
}

// --- Worker (API Gateway) ---

// Max request body, mirroring `maxRequestBody` in container_src/main.go. This
// gateway sits in front of the container, so the SMALLER of the two binds — a
// generous container limit is invisible if this one is lower.
//
// The old 120 KB cap was sized for single-file pastes and rejected real
// projects: SERV's 14 files are ~85 KB of JSON and squeaked through, but the
// servant SoC's 18 files are ~136 KB and 413'd here while passing every check
// downstream. Local dev POSTs straight to the container and bypasses this
// entirely, so the mismatch only ever showed up in production.
const MAX_REQUEST_BYTES = 2 * 256 * 1024 + 256 * 1024 + 8 * 1024;

/** One client-supplied file, written into the container's work directory. */
interface SourceFile {
  path?: string;
  content?: string;
}

/** One `chparam -set` assignment applied to the top module. */
interface Param {
  name?: string;
  value?: string;
  kind?: string;
}

/** Mirrors `SynthRequest` in `apps/synth/container_src/main.go`. */
interface SynthBody {
  verilog?: string;
  sources?: SourceFile[];
  includes?: SourceFile[];
  files?: Record<string, string>;
  params?: Param[];
  top?: string;
  target?: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') ?? '*');
  c.res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  c.res.headers.set('Access-Control-Max-Age', '86400');
});

app.options('*', (c) => new Response(null, { status: 204 }));

// Health check
app.get('/', async (c) => {
  const container = getContainer(c.env.SYNTH_CONTAINER);
  const resp = await container.fetch('http://container/health');
  return new Response(resp.body, resp);
});

// Synth endpoint
app.post('/synth', async (c) => {
  const contentType = c.req.header('Content-Type');
  if (!contentType?.includes('application/json')) {
    return c.json({ success: false, error: 'Content-Type must be application/json' }, 400);
  }

  const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);
  if (contentLength > MAX_REQUEST_BYTES) {
    return c.json(
      {
        success: false,
        error: `Request too large: ${contentLength} bytes (limit ${MAX_REQUEST_BYTES})`,
      },
      413,
    );
  }

  let body: SynthBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  // A single pasted module arrives as `verilog`; a multi-file project arrives as
  // `sources`. Either is enough, and requiring both would reject every real
  // project.
  const hasVerilog = typeof body.verilog === 'string' && body.verilog.length > 0;
  const hasSources = Array.isArray(body.sources) && body.sources.length > 0;
  if (!hasVerilog && !hasSources) {
    return c.json({ success: false, error: 'verilog source is required' }, 400);
  }

  if (typeof body.top !== 'string' || body.top.length === 0) {
    return c.json({ success: false, error: 'top module name is required' }, 400);
  }

  const container = getContainer(c.env.SYNTH_CONTAINER);
  const resp = await container.fetch('http://container/synth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Every field of the container's SynthRequest has to be named here. This
    // re-serialization is not a formality — a field added to the container and
    // forgotten here is dropped in production and nowhere else, because local
    // dev POSTs straight to the container and never runs this file.
    // `scripts/check-synth-limits.ts` fails the build when the two drift.
    body: JSON.stringify({
      verilog: body.verilog ?? '',
      sources: body.sources ?? [],
      includes: body.includes ?? [],
      files: body.files ?? {},
      params: body.params ?? [],
      top: body.top,
      target: body.target ?? 'generic',
    }),
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Build endpoint (nextpnr-ecp5 + ecppack)
app.post('/build', async (c) => {
  const contentType = c.req.header('Content-Type');
  if (!contentType?.includes('application/json')) {
    return c.json({ success: false, error: 'Content-Type must be application/json' }, 400);
  }

  let body: { netlist?: string; top?: string; lpf?: string; device?: string; package?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  if (typeof body.netlist !== 'string' || body.netlist.length === 0) {
    return c.json({ success: false, error: 'netlist is required' }, 400);
  }

  if (typeof body.top !== 'string' || body.top.length === 0) {
    return c.json({ success: false, error: 'top module name is required' }, 400);
  }

  const container = getContainer(c.env.SYNTH_CONTAINER);
  const resp = await container.fetch('http://container/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      netlist: body.netlist,
      top: body.top,
      lpf: body.lpf ?? '',
      device: body.device ?? 'LFE5U-85F',
      package: body.package ?? 'CABGA381',
    }),
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  });
});

export default app;
