/**
 * Two plain servers for the e2e run:
 *   HOST  someone else's page that iframes whatever `?src=` names.
 *   SITE  a page sent with simten.dev's own headers (siteHeaders() from
 *         apps/web/src/api/headers.ts, as the web worker sends them), to
 *         check the main site still refuses to be framed.
 */

import { createServer } from 'node:http';
import { siteHeaders as webSiteHeaders } from '../../web/src/api/headers.ts';
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

const siteHeaders = webSiteHeaders();
createServer((_req, res) => {
  res.writeHead(200, Object.fromEntries([...siteHeaders, ['Content-Type', 'text/html']]));
  res.end('<!doctype html><title>simten.dev</title><p>simten.dev stand-in</p>');
}).listen(SITE_PORT);
