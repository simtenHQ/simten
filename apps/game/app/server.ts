/**
 * Cloudflare Workers entry point: TanStack Start's handler, plus the game's
 * response headers (src/headers.ts). Every page is rendered here (nothing is
 * prerendered), so this is the one place those headers are set.
 */

import handler from '@tanstack/react-start/server-entry';
import { gameHeaders } from '../src/headers';

// The same origin the build's pages frame their sandbox from (see useSandbox.ts).
const SANDBOX_ORIGIN: string | undefined = import.meta.env.VITE_SANDBOX_ORIGIN;
const HEADERS = gameHeaders(SANDBOX_ORIGIN);

export default {
  async fetch(request: Request): Promise<Response> {
    const response = await handler.fetch(request);
    // Not on the dev server: Vite's client and HMR would only add noise.
    if (import.meta.env.DEV) return response;
    const withHeaders = new Response(response.body, response);
    for (const [name, value] of HEADERS) withHeaders.headers.set(name, value);
    return withHeaders;
  },
};
