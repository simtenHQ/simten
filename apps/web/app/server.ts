/**
 * Custom Cloudflare Workers entry point.
 *
 * Intercepts /api/* requests for raw HTTP handlers (streaming, service bindings),
 * then falls through to TanStack Start's SSR handler for everything else.
 */

import handler from '@tanstack/react-start/server-entry';
import { handleApiRoute } from '../src/api/routes';

export default {
  async fetch(request: Request, env: Record<string, unknown>, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle /api/* routes with our custom handlers
    if (url.pathname.startsWith('/api/')) {
      const apiResponse = await handleApiRoute(request, env);
      if (apiResponse) return apiResponse;
    }

    // Fall through to TanStack Start SSR
    return handler.fetch(request);
  },
};
