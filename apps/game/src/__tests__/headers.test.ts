import { describe, expect, it } from 'vitest';
import { gameCsp, gameHeaders } from '../headers';

// The policy play.simten.dev has sent since the CSP was enforced (#489). A
// build with no VITE_SANDBOX_ORIGIN must keep sending exactly this.
const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net https://data.jsdelivr.com https://cloudflareinsights.com; worker-src 'self' blob: data:; frame-src https://sandbox.simtenusercontent.dev; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

describe('gameCsp', () => {
  it('is the production policy when the build sets no sandbox origin', () => {
    expect(gameCsp()).toBe(PRODUCTION_CSP);
    expect(gameCsp('')).toBe(PRODUCTION_CSP);
    expect(gameHeaders()).toEqual([['Content-Security-Policy', PRODUCTION_CSP]]);
  });

  it('frames the sandbox the build points at, and changes nothing else', () => {
    expect(gameCsp('http://localhost:4302')).toBe(
      PRODUCTION_CSP.replace(
        'frame-src https://sandbox.simtenusercontent.dev;',
        'frame-src http://localhost:4302;',
      ),
    );
  });
});
