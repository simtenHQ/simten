/**
 * Custom Cloudflare Workers entry point.
 *
 * Intercepts /api/* requests for raw HTTP handlers (streaming, service bindings),
 * then falls through to TanStack Start's SSR handler for everything else.
 */

import handler from '@tanstack/react-start/server-entry';
import headersFile from '../public/_headers?raw';
import { isDevServer } from '../src/api/deploy-mode';
import { siteWideHeaders, withHeaders } from '../src/api/headers';
import type { ApiEnv } from '../src/api/limits';
import { handleApiRoute } from '../src/api/routes';

export { DailyBudget } from '../src/api/daily-budget';

const SITE_HEADERS = siteWideHeaders(headersFile);

export default {
  async fetch(request: Request, env: ApiEnv, _ctx: ExecutionContext): Promise<Response> {
    const response = await route(request, env);
    // Not on the dev server: Vite's client and HMR would only add noise.
    return isDevServer() ? response : withHeaders(response, SITE_HEADERS);
  },
};

async function route(request: Request, env: ApiEnv): Promise<Response> {
  const url = new URL(request.url);

  // Handle /api/* routes with our custom handlers
  if (url.pathname.startsWith('/api/')) {
    const apiResponse = await handleApiRoute(request, env);
    if (apiResponse) return apiResponse;
  }

  // Fall through to TanStack Start SSR
  return handler.fetch(request);
}
