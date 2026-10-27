import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiEnv } from '../limits';
import { handleApiRoute } from '../routes';
import { fakeBudget, fakeRateLimiter } from './fakes';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function post(path: string, body: unknown, contentType: string | null = 'application/json') {
  const headers = new Headers({ 'CF-Connecting-IP': '203.0.113.7' });
  if (contentType) headers.set('Content-Type', contentType);
  return new Request(`https://simten.dev${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function compilerBinding() {
  return {
    fetch: vi.fn(async () => Response.json({ success: true, binary: [1, 2, 3] })),
  };
}

const COMPILE_BODY = { source: 'int main() { return 0; }', language: 'c' };

describe('handleApiRoute', () => {
  it('passes requests it does not own through to the app', async () => {
    expect(await handleApiRoute(new Request('https://simten.dev/api/search'), {})).toBeNull();
    expect(await handleApiRoute(new Request('https://simten.dev/api/compile'), {})).toBeNull();
    expect(await handleApiRoute(post('/api/__proto__', {}), {})).toBeNull();
  });

  it.each([
    ['/api/compile'],
    ['/api/verify'],
    ['/api/verilog-import'],
  ])('%s rejects a POST that is not JSON with 415', async (path) => {
    for (const type of [
      null,
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
    ]) {
      const res = await handleApiRoute(post(path, {}, type), {});
      expect(res?.status).toBe(415);
    }
  });

  it('accepts JSON with parameters and any casing', async () => {
    vi.stubEnv('DEV', false);
    const env: ApiEnv = {
      COMPILE_RL: fakeRateLimiter(),
      DAILY_BUDGET: fakeBudget(),
      COMPILER: compilerBinding(),
    };
    const res = await handleApiRoute(
      post('/api/compile', COMPILE_BODY, 'Application/JSON; charset=utf-8'),
      env,
    );
    expect(res?.status).toBe(200);
    expect(await res?.json()).toMatchObject({ success: true });
  });

  it('refuses compile in a deployed build without its limits, and never calls the container', async () => {
    vi.stubEnv('DEV', false);
    const compiler = compilerBinding();
    const res = await handleApiRoute(post('/api/compile', COMPILE_BODY), { COMPILER: compiler });
    expect(res?.status).toBe(503);
    expect(compiler.fetch).not.toHaveBeenCalled();
  });

  it('answers 429 from verify once its rate limit is spent', async () => {
    vi.stubEnv('DEV', false);
    const env: ApiEnv = { VERIFY_RL: fakeRateLimiter(0), DAILY_BUDGET: fakeBudget() };
    const res = await handleApiRoute(post('/api/verify', { verilog: 'm', testbench: 't' }), env);
    expect(res?.status).toBe(429);
    expect(await res?.json()).toMatchObject({ success: false, compileError: expect.any(String) });
  });

  it('does not fall back to localhost in a deployed build', async () => {
    vi.stubEnv('DEV', false);
    const fetchSpy = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const env: ApiEnv = { COMPILE_RL: fakeRateLimiter(), DAILY_BUDGET: fakeBudget() };
    const res = await handleApiRoute(post('/api/compile', COMPILE_BODY), env);
    expect(res?.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the local container on the dev server', async () => {
    vi.stubEnv('DEV', true);
    const fetchSpy = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handleApiRoute(post('/api/compile', COMPILE_BODY), {});
    expect(res?.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:55001/compile', expect.anything());
  });
});
