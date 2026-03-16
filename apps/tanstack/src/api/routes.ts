/**
 * API route dispatcher for Cloudflare Workers.
 *
 * Intercepts /api/* requests before they reach TanStack Start's SSR handler.
 * Returns a Response if matched, or null to pass through.
 */

import { handleChat } from './chat/handler';
import { handleCompile } from './compile';
import { handleStreamTest } from './stream-test';

export async function handleApiRoute(request: Request, env: Record<string, unknown>): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === '/api/chat' && request.method === 'POST') {
    return handleChat(request, env as Record<string, string | undefined>);
  }

  if (url.pathname === '/api/compile' && request.method === 'POST') {
    return handleCompile(request, env);
  }

  if (url.pathname === '/api/stream-test' && request.method === 'GET') {
    return handleStreamTest(env as Record<string, string | undefined>);
  }

  return null;
}
