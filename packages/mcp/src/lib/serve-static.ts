/**
 * Static file serving for the bundled editor SPA.
 *
 * The MCP serves the prebuilt web editor (copied into ./dist/public at build
 * time) so the browser loads the page and opens its studio WebSocket from the
 * SAME localhost origin. That sidesteps Chrome's Local Network Access block,
 * which forbids a public page (https://simten.dev) from reaching ws://localhost.
 *
 * SPA fallback: any path without a file extension serves index.html, so the
 * client router cold-mounts /circuit (validated by the Step 0 spike). Hashed
 * asset requests that miss return 404 (never masked by the shell).
 */
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Bundled editor assets. dist/lib/serve-static.js -> dist/public */
export const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

/** True when the editor build has been bundled into the package. */
export function publicDirExists(): boolean {
  return existsSync(join(PUBLIC_DIR, 'index.html'));
}

const MIME: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

/**
 * Serve a request from PUBLIC_DIR. Files with an extension are served directly
 * (hashed assets get a long immutable cache; index.html is no-cache); a path
 * with no extension is an SPA route and serves the index.html shell. A missing
 * extensioned file returns 404 so a stale asset hash fails loudly, not blank.
 */
/**
 * The index.html shell, with the local-viewer flag injected once and cached.
 * `window.__simten_local__` is read by the web app (EditorWorkspace.tsx) to hide
 * the Share button — sharing requires a server the local viewer doesn't have.
 * This is a cross-package contract carried only by this string; keep both sides
 * in sync. (Injected early in <head>, so it runs before React renders.)
 */
let cachedShell: Buffer | null = null;
function shellHtml(): Buffer {
  if (cachedShell) return cachedShell;
  let html = readFileSync(join(PUBLIC_DIR, 'index.html'), 'utf8');
  const flag = '<script>window.__simten_local__=true</script>';
  html = /<head[^>]*>/.test(html) ? html.replace(/<head[^>]*>/, (m) => m + flag) : flag + html;
  cachedShell = Buffer.from(html, 'utf8');
  return cachedShell;
}

export function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const reqPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);

  // Resolve within PUBLIC_DIR; strip leading traversal and confirm containment.
  const safeRel = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = join(PUBLIC_DIR, safeRel);
  const contained = candidate === PUBLIC_DIR || candidate.startsWith(PUBLIC_DIR + sep);

  const indexPath = join(PUBLIC_DIR, 'index.html');

  // The HTML shell (root, /index.html, or any SPA route) is served from the
  // flag-injected cache, not streamed raw.
  if (candidate === indexPath || candidate === PUBLIC_DIR) {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
    res.end(shellHtml());
    return;
  }

  const ext = extname(candidate);
  if (contained && ext && existsSync(candidate) && statSync(candidate).isFile()) {
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    createReadStream(candidate).pipe(res);
    return;
  }

  if (ext) {
    // A hashed asset that doesn't exist — surface it, don't mask with the shell.
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }

  // No extension → SPA route → serve the flag-injected shell so the client
  // router mounts it.
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
  res.end(shellHtml());
}
