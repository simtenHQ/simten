/**
 * `POST /api/share`: create a share link from any origin.
 *
 * The editor creates links through a server function, which only same-origin
 * pages can call. `<circuit-embed>` runs on other people's sites, and its Fork
 * button needs a short link too (#368), so this route answers CORS for any
 * origin. It creates exactly what the server function creates, under the same
 * per-client rate limit and daily cap, and reads nothing back: the only thing
 * a caller learns is the hash of the source it sent.
 */

import { createShare, ShareRejected, validateShareInput } from '../features/share/store';
import type { ApiEnv } from './limits';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** The answer to a CORS preflight for `/api/share`. */
export function handleSharePreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function handleShare(request: Request, env: ApiEnv): Promise<Response> {
  const reply = (body: object, status = 200) =>
    Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });

  if (!env.CIRCUIT_SHARES) return reply({ error: 'Service unavailable' }, 503);

  let source: string;
  try {
    ({ source } = validateShareInput((await request.json()) as { source: string }));
  } catch (err) {
    const message = err instanceof SyntaxError ? 'Invalid JSON' : (err as Error).message;
    return reply({ error: message }, 400);
  }

  try {
    const hash = await createShare(
      { ...env, CIRCUIT_SHARES: env.CIRCUIT_SHARES },
      request.headers.get('CF-Connecting-IP'),
      source,
    );
    env.ANALYTICS?.writeDataPoint({ blobs: ['share_create', hash], doubles: [source.length] });
    return reply({ hash });
  } catch (err) {
    if (err instanceof ShareRejected) return reply({ error: err.message }, err.status);
    throw err;
  }
}
