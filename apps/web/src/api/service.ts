import { isDevServer } from './deploy-mode';
import type { ServiceFetcher } from './limits';

/**
 * Call a container service through its binding. Only the dev server falls back
 * to the service running locally under `wrangler dev`; a deployed build with
 * no binding rejects, and the caller reports it as a service error.
 */
export function callService(
  binding: ServiceFetcher | undefined,
  bindingUrl: string,
  devUrl: string,
  init: RequestInit,
): Promise<Response> {
  if (binding) return binding.fetch(bindingUrl, init);
  if (isDevServer()) return fetch(devUrl, init);
  return Promise.reject(new Error('service binding is not configured'));
}
