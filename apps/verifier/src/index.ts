import { Container, getContainer } from '@cloudflare/containers';
import { Hono } from 'hono';

// --- Container Definition ---

export class VerifierContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '2m';
}

// --- Worker (API Gateway) ---

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
  const container = getContainer(c.env.VERIFIER_CONTAINER);
  const resp = await container.fetch('http://container/health');
  return new Response(resp.body, resp);
});

// Verify endpoint
app.post('/verify', async (c) => {
  const contentType = c.req.header('Content-Type');
  if (!contentType?.includes('application/json')) {
    return c.json({ success: false, compileError: 'Content-Type must be application/json' }, 400);
  }

  const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);
  if (contentLength > 120 * 1024) {
    return c.json({ success: false, compileError: 'Request too large' }, 413);
  }

  let body: { verilog?: string; testbench?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, compileError: 'Invalid JSON' }, 400);
  }

  if (typeof body.verilog !== 'string' || body.verilog.length === 0) {
    return c.json({ success: false, compileError: 'verilog source is required' }, 400);
  }

  if (typeof body.testbench !== 'string' || body.testbench.length === 0) {
    return c.json({ success: false, compileError: 'testbench source is required' }, 400);
  }

  const container = getContainer(c.env.VERIFIER_CONTAINER);
  const resp = await container.fetch('http://container/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verilog: body.verilog, testbench: body.testbench }),
  });

  return new Response(resp.body, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json' },
  });
});

export default app;
