/**
 * Cloudflare Workers entry point: TanStack Start's handler, plus the game's
 * response headers. Every page is rendered here (nothing is prerendered), so
 * this is the one place those headers are set.
 */

import handler from '@tanstack/react-start/server-entry';

/**
 * Report-only for now: violations are logged in the browser console and
 * nothing is blocked. What it allows, from what the game loads:
 *   script-src  'unsafe-inline'  the theme and newcomer scripts in <head>, and
 *                                TanStack Start's hydration scripts.
 *               cdn.jsdelivr.net Monaco and the TypeScript compiler.
 *               static.cloudflareinsights.com  Cloudflare Web Analytics.
 *   style-src   'unsafe-inline'  React style props, React Flow and Monaco.
 *   font-src    cdn.jsdelivr.net Monaco's icon font; the game's fonts are self-hosted.
 *   connect-src cdn.jsdelivr.net, data.jsdelivr.com  Monaco and npm type acquisition.
 *               cloudflareinsights.com  Cloudflare Web Analytics.
 *   worker-src  blob: data:      Monaco's language workers.
 *   frame-src   sandbox.simten.dev  the iframe that runs player code.
 * When this has run clean in the console for a while, rename the header to
 * Content-Security-Policy to enforce it.
 */
const HEADERS: Array<[string, string]> = [
  [
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "font-src 'self' data: https://cdn.jsdelivr.net",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://cdn.jsdelivr.net https://data.jsdelivr.com https://cloudflareinsights.com",
      "worker-src 'self' blob: data:",
      'frame-src https://sandbox.simten.dev',
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  ],
];

export default {
  async fetch(request: Request): Promise<Response> {
    const response = await handler.fetch(request);
    // Not on the dev server: Vite's client and HMR would only add noise.
    if (import.meta.env.DEV) return response;
    const withHeaders = new Response(response.body, response);
    for (const [name, value] of HEADERS) withHeaders.headers.set(name, value);
    return withHeaders;
  },
};
