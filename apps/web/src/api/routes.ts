/**
 * API route dispatcher for Cloudflare Workers.
 *
 * Intercepts /api/* requests before they reach TanStack Start's SSR handler.
 * Returns a Response if matched, or null to pass through.
 */

import { handleCompile } from './compile';
import type { ApiEnv } from './limits';
import { handleShare, handleSharePreflight } from './share';
import { handleVerilogImport } from './synth';
import { handleVerify } from './verify';

type Handler = (request: Request, env: ApiEnv) => Promise<Response>;

/** Every route here is a JSON POST. */
const POST_ROUTES = new Map<string, Handler>([
  ['/api/compile', handleCompile],
  ['/api/verify', handleVerify],
  ['/api/verilog-import', handleVerilogImport],
]);

/** Answers CORS, unlike the routes above: see `share.ts`. */
const SHARE_ROUTE = '/api/share';

export async function handleApiRoute(request: Request, env: ApiEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === SHARE_ROUTE && request.method === 'OPTIONS') return handleSharePreflight();
  const handler = path === SHARE_ROUTE ? handleShare : POST_ROUTES.get(path);
  if (!handler || request.method !== 'POST') return null;

  // Browsers send a JSON content type to another origin only after a CORS
  // preflight, and the routes in POST_ROUTES answer none, so in a browser only
  // same-origin pages can call them.
  if (!isJson(request)) {
    return Response.json(
      { success: false, error: 'Content-Type must be application/json' },
      { status: 415 },
    );
  }
  return handler(request, env);
}

function isJson(request: Request): boolean {
  const type = request.headers.get('Content-Type') ?? '';
  return type.split(';')[0].trim().toLowerCase() === 'application/json';
}
