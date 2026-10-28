import { describe, expect, it } from 'vitest';
import { headersFile, siteCsp, siteHeaders, withHeaders } from '../headers';

// The policy simten.dev has sent since the CSP was enforced (#489). A build
// with no VITE_SANDBOX_ORIGIN must keep sending exactly this.
const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net https://data.jsdelivr.com https://api.github.com https://raw.githubusercontent.com https://cloudflareinsights.com ws://localhost:*; worker-src 'self' blob: data:; frame-src https://sandbox.simtenusercontent.dev https://embed.simten.dev https://www.youtube.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

describe('siteCsp', () => {
  it('is the production policy when the build sets no sandbox origin', () => {
    expect(siteCsp()).toBe(PRODUCTION_CSP);
    expect(siteCsp('')).toBe(PRODUCTION_CSP);
  });

  it('frames the sandbox the build points at, and changes nothing else', () => {
    expect(siteCsp('http://localhost:4302')).toBe(
      PRODUCTION_CSP.replace(
        'frame-src https://sandbox.simtenusercontent.dev ',
        'frame-src http://localhost:4302 ',
      ),
    );
  });
});

describe('site headers', () => {
  it('send the same CSP from the worker and from _headers', () => {
    expect(siteHeaders()).toEqual([['Content-Security-Policy', PRODUCTION_CSP]]);
    expect(headersFile()).toContain(`\n/*\n  Content-Security-Policy: ${PRODUCTION_CSP}\n`);
    expect(headersFile('http://localhost:4302')).toContain(
      `  Content-Security-Policy: ${siteCsp('http://localhost:4302')}\n`,
    );
  });
});

describe('withHeaders', () => {
  it('adds headers the response does not set and keeps the ones it does', async () => {
    const res = withHeaders(new Response('body', { status: 404, headers: { 'X-Two': 'mine' } }), [
      ['X-One', 'a'],
      ['X-Two', 'b'],
    ]);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-One')).toBe('a');
    expect(res.headers.get('X-Two')).toBe('mine');
    expect(await res.text()).toBe('body');
  });
});
