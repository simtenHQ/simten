/**
 * API route dispatcher for Cloudflare Workers.
 *
 * Intercepts /api/* requests before they reach TanStack Start's SSR handler.
 * Returns a Response if matched, or null to pass through.
 */

import { handleCompile } from './compile';
import { handleVerify } from './verify';

export async function handleApiRoute(request: Request, env: Record<string, unknown>): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === '/api/compile' && request.method === 'POST') {
    return handleCompile(request, env);
  }

  if (url.pathname === '/api/verify' && request.method === 'POST') {
    return handleVerify(request, env);
  }

  return null;
}
