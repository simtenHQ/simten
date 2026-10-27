/**
 * Two plain servers for the e2e run:
 *   HOST  someone else's page that iframes whatever `?src=` names.
 *   SITE  a page sent with simten.dev's own headers (the `/*` block of
 *         apps/web/public/_headers, read the way the web worker reads it), to
 *         check the main site still refuses to be framed.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { siteWideHeaders } from '../../web/src/api/headers.ts';
import { HOST_PORT, SITE_PORT } from './setup.ts';

const escapeAttribute = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

createServer((req, res) => {
  const src = new URL(req.url ?? '/', 'http://localhost').searchParams.get('src') ?? '';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<title>Someone's course page</title>
<h1>A course page</h1>
<iframe id="frame" src="${escapeAttribute(src)}" style="width:100%; aspect-ratio:4/3; border:0"
        title="Toggle (Simten)"></iframe>`);
}).listen(HOST_PORT);

const siteHeaders = siteWideHeaders(
  readFileSync(new URL('../../web/public/_headers', import.meta.url), 'utf8'),
);
createServer((_req, res) => {
  res.writeHead(200, Object.fromEntries([...siteHeaders, ['Content-Type', 'text/html']]));
  res.end('<!doctype html><title>simten.dev</title><p>simten.dev stand-in</p>');
}).listen(SITE_PORT);
