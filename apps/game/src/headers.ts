/**
 * The game's response headers, applied by the worker entry (app/server.ts) to
 * every page it renders.
 *
 * The CSP is enforced: the browser blocks anything it does not allow. What it
 * allows, from what the game loads:
 *   script-src  'unsafe-inline'  the theme and newcomer scripts in <head>, and
 *                                TanStack Start's hydration scripts.
 *               cdn.jsdelivr.net Monaco and the TypeScript compiler.
 *               static.cloudflareinsights.com  Cloudflare Web Analytics.
 *   style-src   'unsafe-inline'  React style props, React Flow and Monaco.
 *   font-src    cdn.jsdelivr.net Monaco's icon font; the game's fonts are self-hosted.
 *   connect-src cdn.jsdelivr.net, data.jsdelivr.com  Monaco and npm type acquisition.
 *               cloudflareinsights.com  Cloudflare Web Analytics.
 *   worker-src  blob: data:      Monaco's language workers.
 *   frame-src   the sandbox, the iframe that runs player code. It is the
 *               origin the build points at (VITE_SANDBOX_ORIGIN, as in
 *               packages/sandbox/src/sandbox-client.ts), by default
 *               sandbox.simtenusercontent.dev.
 * Dropping 'unsafe-inline' and adding a report endpoint are tracked in #464.
 */

const PROD_SANDBOX_ORIGIN = 'https://sandbox.simtenusercontent.dev';

/** The game's CSP. An unset or empty `sandboxOrigin` means the production sandbox. */
export function gameCsp(sandboxOrigin?: string): string {
  const sandbox = sandboxOrigin || PROD_SANDBOX_ORIGIN;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://cdn.jsdelivr.net https://data.jsdelivr.com https://cloudflareinsights.com",
    "worker-src 'self' blob: data:",
    `frame-src ${sandbox}`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** The headers every page gets, as `[name, value]` pairs. */
export function gameHeaders(sandboxOrigin?: string): Array<[string, string]> {
  return [['Content-Security-Policy', gameCsp(sandboxOrigin)]];
}
