/**
 * The embed page's one Worker route: `GET /api/share/<id>` returns the share's
 * source. Everything else is static assets (wrangler.jsonc sends only /api/*
 * here).
 *
 * It answers 404 for a share it can't see, without deciding whether the share
 * is missing or not here yet: KV is eventually consistent, so a link created
 * seconds ago in another region reads as missing for up to about a minute.
 * The page retries (see `fetch-share.ts`).
 */

import { isShareHash, loadShare, type ShareKV } from '@simten/shared/share';

export interface Env {
  CIRCUIT_SHARES: ShareKV;
}

const SHARE_PATH = /^\/api\/share\/([^/]+)$/;

function json(body: object, status: number, cache: string): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const match = new URL(request.url).pathname.match(SHARE_PATH);
  if (!match || request.method !== 'GET') return json({ error: 'not found' }, 404, 'no-store');

  const id = match[1];
  if (!isShareHash(id)) return json({ error: 'invalid share id' }, 400, 'no-store');

  const source = await loadShare(env.CIRCUIT_SHARES, id);
  // Not cached: the page asks again while the share propagates.
  if (source === null) return json({ error: 'not found' }, 404, 'no-store');

  // Content-addressed: the source behind an id never changes.
  return json({ source }, 200, 'public, max-age=31536000, immutable');
}

export default { fetch: handleRequest };
