/**
 * Static file serving for the bundled editor SPA.
 *
 * The MCP serves the prebuilt web editor (copied into ./dist/public at build
 * time) so the browser loads the page and opens its studio WebSocket from the
 * SAME localhost origin. That sidesteps Chrome's Local Network Access block,
 * which forbids a public page (https://simten.dev) from reaching ws://localhost.
 *
 * SPA fallback: any path without a file extension serves index.html, so the
 * standalone viewer mounts at the root path. Hashed asset requests that miss
 * return 404 (never masked by the shell).
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
 * The index.html shell, read once and cached. The viewer is a purpose-built
 * standalone bundle (it omits Share/chat by construction), so the shell is
 * served verbatim — no flag injection, no cross-package contract.
 */
let cachedShell: Buffer | null = null;
function shellHtml(): Buffer {
  if (cachedShell) return cachedShell;
  cachedShell = readFileSync(join(PUBLIC_DIR, 'index.html'));
  return cachedShell;
}

export function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  // decodeURIComponent throws URIError on a malformed escape (e.g. `GET /%`).
  // This runs in the synchronous HTTP listener, so an uncaught throw would crash
  // the whole MCP process — answer with 400 instead.
  let reqPath: string;
  try {
    reqPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Bad request');
    return;
  }

  // Resolve within PUBLIC_DIR; strip leading traversal and confirm containment.
  const safeRel = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = join(PUBLIC_DIR, safeRel);
  const contained = candidate === PUBLIC_DIR || candidate.startsWith(PUBLIC_DIR + sep);

  const indexPath = join(PUBLIC_DIR, 'index.html');

  // The HTML shell (root, /index.html, or any SPA route) is served from the
  // cached read, not streamed raw.
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

  // No extension → SPA route → serve the shell so the client mounts it.
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
  res.end(shellHtml());
}
