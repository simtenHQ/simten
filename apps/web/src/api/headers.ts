/**
 * Site-wide response headers.
 *
 * Cloudflare applies `_headers` to static assets only, which covers the
 * prerendered pages but not what the worker renders. So the build writes
 * `_headers` from `headersFile()` (vite.config.ts), and the worker entry
 * (app/server.ts) applies `siteHeaders()` to its own responses. Both take the
 * sandbox origin the build points at, so this file is the one place these
 * headers are written.
 *
 * The CSP is enforced: the browser blocks anything it does not allow. What it
 * allows, from what the site loads:
 *   script-src  'unsafe-inline'   TanStack Start's hydration scripts are inline.
 *               'wasm-unsafe-eval' the cc65 compiler in the 6502 posts is wasm.
 *               cdn.jsdelivr.net  Monaco and the TypeScript compiler for the editor.
 *               static.cloudflareinsights.com  Cloudflare Web Analytics.
 *   style-src   'unsafe-inline'   React style props and Monaco's injected styles.
 *   font-src    cdn.jsdelivr.net  Monaco's icon font; the site's own fonts are self-hosted.
 *   connect-src cdn.jsdelivr.net, data.jsdelivr.com  Monaco and npm type acquisition.
 *               api.github.com, raw.githubusercontent.com  Verilog import from a GitHub repo.
 *               cloudflareinsights.com  Cloudflare Web Analytics.
 *               ws://localhost:*  the editor's connection to a local MCP server.
 *   worker-src  blob: data:       Monaco's language workers.
 *   frame-src   the sandbox, the iframe that runs circuit code. It is the
 *               origin the build points at (VITE_SANDBOX_ORIGIN, as in
 *               packages/sandbox/src/sandbox-client.ts), by default
 *               sandbox.simtenusercontent.dev.
 *               embed.simten.dev  the live preview in the Share dialog's Embed tab.
 *               www.youtube.com   the video in the Breakout post.
 * Dropping 'unsafe-inline' and adding a report endpoint are tracked in #464.
 */

const PROD_SANDBOX_ORIGIN = 'https://sandbox.simtenusercontent.dev';

/** The site's CSP. An unset or empty `sandboxOrigin` means the production sandbox. */
export function siteCsp(sandboxOrigin?: string): string {
  const sandbox = sandboxOrigin || PROD_SANDBOX_ORIGIN;
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://cdn.jsdelivr.net https://data.jsdelivr.com https://api.github.com https://raw.githubusercontent.com https://cloudflareinsights.com ws://localhost:*",
    "worker-src 'self' blob: data:",
    `frame-src ${sandbox} https://embed.simten.dev https://www.youtube.com`,
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** The headers every page gets, as `[name, value]` pairs. */
export function siteHeaders(sandboxOrigin?: string): Array<[string, string]> {
  return [['Content-Security-Policy', siteCsp(sandboxOrigin)]];
}

/** The `_headers` file Cloudflare applies to the static assets. */
export function headersFile(sandboxOrigin?: string): string {
  return [
    '# https://developers.cloudflare.com/workers/static-assets/headers',
    '# Written at build time from apps/web/src/api/headers.ts.',
    '',
    '/*',
    ...siteHeaders(sandboxOrigin).map(([name, value]) => `  ${name}: ${value}`),
    '',
    '# https://opennext.js.org/cloudflare/caching#static-assets-caching',
    '/_next/static/*',
    '  Cache-Control: public,max-age=31536000,immutable',
    '',
  ].join('\n');
}

/** `response` with each header added unless the response already sets it. */
export function withHeaders(response: Response, headers: Array<[string, string]>): Response {
  const missing = headers.filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  const copy = new Response(response.body, response);
  for (const [name, value] of missing) copy.headers.set(name, value);
  return copy;
}
