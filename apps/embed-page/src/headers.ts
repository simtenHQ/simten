/**
 * The embed page's response headers, written to `_headers` at build time
 * (vite.config.ts). Cloudflare applies them to the static assets, which is
 * every response but /api/*.
 *
 * The CSP is enforced. What it allows, from what the page loads:
 *   script-src  'self'  the page's own bundle. No inline scripts, no CDN.
 *   style-src   'self'  the page's own stylesheet. React sets style props
 *                       through the DOM, which CSP doesn't govern.
 *   img-src     'self' data:  the favicon, and data: images in the canvas.
 *   font-src    'self'  none today; system fonts only.
 *   connect-src 'self'  GET /api/share/<id>.
 *   frame-src   the sandbox, the iframe that runs circuit code. A build
 *               pointed at a local sandbox (VITE_SANDBOX_ORIGIN) adds that
 *               origin; a production build allows only
 *               sandbox.simtenusercontent.dev.
 *   frame-ancestors *   the point of the page: any site may frame it.
 */

const PROD_SANDBOX_ORIGIN = 'https://sandbox.simtenusercontent.dev';

export function embedCsp(sandboxOrigin = PROD_SANDBOX_ORIGIN): string {
  const frames = [...new Set([PROD_SANDBOX_ORIGIN, sandboxOrigin])].join(' ');
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${frames}`,
    'frame-ancestors *',
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** The `_headers` file. Built assets have content hashes in their names, so they cache for good. */
export function headersFile(sandboxOrigin?: string): string {
  return [
    '/*',
    `  Content-Security-Policy: ${embedCsp(sandboxOrigin)}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}
