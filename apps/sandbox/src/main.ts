/**
 * Sandbox iframe main thread: relay and watchdog.
 *
 * The page side is `@simten/sandbox`'s `SandboxClient`; message types are in
 * `@simten/sandbox/protocol`. Runs in a hidden cross-origin iframe
 * (sandbox.simtenusercontent.dev), so user code can't reach the page's
 * cookies, storage or DOM. See `apps/web/content/docs/security.mdx`.
 *
 * All user code, every simulator and all simulation state live in the worker
 * (`worker.ts`). This thread runs no user code: it forwards page requests to
 * the worker and responses back to the page, so it can't hang.
 *
 * The relay (`createRelay` in `@simten/sandbox/host`) restarts the worker
 * after 5s of silence while it owes an answer or auto-run frames, and replays
 * every compile and session (and slot, for the slot messages) into the new one
 * at cycle 0. The stuck request fails as timed out, the others as restarted,
 * and the page gets a `restarted` message naming the sessions that came back
 * and those that didn't. A sliced request sends `progressed` heartbeats, so a
 * long `tick` that keeps working isn't mistaken for a hang; the relay keeps
 * those to itself.
 */

import { createRelay } from '@simten/sandbox/host';
import type {
  SandboxMessage,
  SandboxResponse,
  WorkerRequest,
  WorkerResponse,
} from '@simten/sandbox/protocol';
import { createParentChannel, reportedParentOrigin } from './parent-channel';

/** Bumped per worker; the worker uses it to keep snapshot ids unique across restarts. */
let generation = 0;

// Only the embedding page may send requests, and responses go only to its
// origin. Until that origin is known only the benign `ready` signal goes out,
// with a wildcard.
const parentChannel = createParentChannel(
  parent === self ? null : parent,
  reportedParentOrigin(location),
);

// SandboxResponse is a slot response. Kept: published @simten/embed 0.5.x /
// @simten/ui 0.15.x send these; removed at the release with the
// sandbox.simten.dev route (decision 0008, #424).
function respond(message: SandboxMessage | SandboxResponse) {
  const origin = parentChannel.origin();
  if (!origin) return;
  parent.postMessage(message, origin);
}

const relay = createRelay({
  respond,
  startWorker(receive) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: String(generation++),
    });
    worker.onmessage = (e: MessageEvent) => receive(e.data as WorkerResponse);
    worker.onerror = (e) => console.error('[sandbox worker error]', e);
    return {
      post: (request) => worker.postMessage(request),
      terminate: () => worker.terminate(),
    };
  },
});

self.addEventListener('message', (event: MessageEvent) => {
  const req = event.data as WorkerRequest;
  if (!req?.id || !req?.type) return;
  if (!parentChannel.accepts(event)) return;
  relay.receive(req);
});

// Not every browser tells us the parent's origin before it messages us, so
// this one signal uses '*'. It carries nothing but the ready bit.
parent.postMessage({ type: 'ready' }, '*');
