/**
 * Sandbox iframe main thread: relay and watchdog.
 *
 * The page side is `packages/ui/src/sandbox/useSandbox.ts`; message types are
 * in `@simten/ui/sandbox/protocol`. Runs in a hidden cross-origin iframe
 * (sandbox.simtenusercontent.dev), so user code can't reach the page's cookies, storage
 * or DOM. See `apps/web/content/docs/security.mdx`.
 *
 * All user code, every simulator and all simulation state live in the worker
 * (`worker.ts`). This thread runs no user code: it forwards page requests to
 * the worker and responses back to the page, so it can't hang.
 *
 * Watchdog: when the oldest outstanding request has had the worker for 5s,
 * the worker is terminated and a new one started. Each slot is recompiled from
 * the last successful compile/compile-ir request seen for it, at cycle 0. The
 * stuck request gets a timeout error and the others get "Worker restarted".
 * Snapshots don't survive. A slot whose recompile hangs too is dropped.
 */

import type {
  SandboxRequest,
  SandboxResponse,
  SimSlot,
  WorkerRequest,
  WorkerResponse,
} from '@simten/ui/sandbox/protocol';
import { createParentChannel, reportedParentOrigin } from './parent-channel';

const TIMEOUT_MS = 5000;
const TIMED_OUT_ERROR = 'Execution timed out. The simulation was restarted from cycle 0.';
const RESTARTED_ERROR = 'Worker restarted';
const DEFAULT_SLOT = 'default';

type CompileRequest = Extract<SandboxRequest, { type: 'compile' | 'compile-ir' }>;

/** Bumped per worker; the worker uses it to keep snapshot ids unique across restarts. */
let generation = 0;
let worker = startWorker();

/** Page requests sent to the current worker, oldest first. */
const inFlight = new Map<string, SandboxRequest>();
let watchdog: ReturnType<typeof setTimeout> | undefined;

/** Last successful compile per slot, replayed into a new worker. */
const lastCompile = new Map<SimSlot, CompileRequest>();

/** Replay requests waiting on the new worker, by id. */
const replays = new Map<string, (res: WorkerResponse) => void>();
let replayCounter = 0;

/** Page requests that arrive during a restart; sent once replay is done. */
let held: SandboxRequest[] | null = null;

function startWorker(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: String(generation++),
  });
  w.onmessage = (e: MessageEvent) => onWorkerMessage(e.data as WorkerResponse);
  w.onerror = (e) => console.error('[sandbox worker error]', e);
  return w;
}

// ============================================================================
// Page ↔ worker
// ============================================================================

// Only the embedding page may send requests, and responses go only to its
// origin. Until that origin is known only the benign `ready` signal goes out,
// with a wildcard.
const parentChannel = createParentChannel(
  parent === self ? null : parent,
  reportedParentOrigin(location),
);

function respond(response: SandboxResponse) {
  const origin = parentChannel.origin();
  if (!origin) return;
  parent.postMessage(response, origin);
}

function send(req: SandboxRequest) {
  if (held) {
    held.push(req);
    return;
  }
  inFlight.set(req.id, req);
  if (inFlight.size === 1) armWatchdog();
  const msg: WorkerRequest = req;
  worker.postMessage(msg);
}

function onWorkerMessage(res: WorkerResponse) {
  const replay = replays.get(res.id);
  if (replay) {
    replays.delete(res.id);
    replay(res);
    return;
  }

  const req = inFlight.get(res.id);
  if (!req) return;
  const wasOldest = inFlight.keys().next().value === res.id;
  inFlight.delete(res.id);
  if (wasOldest) armWatchdog();

  if (
    (res.type === 'compiled' || res.type === 'compiled-ir') &&
    (req.type === 'compile' || req.type === 'compile-ir')
  ) {
    const slot = req.slot ?? DEFAULT_SLOT;
    // Re-insert so the map stays in compile order.
    lastCompile.delete(slot);
    lastCompile.set(slot, req);
  } else if (res.type === 'disposed' && req.type === 'dispose') {
    lastCompile.delete(req.slot);
  }
  respond(res);
}

// ============================================================================
// Watchdog
// ============================================================================

/** (Re)start the clock for whichever request is now oldest. */
function armWatchdog() {
  clearTimeout(watchdog);
  watchdog = inFlight.size > 0 ? setTimeout(onTimeout, TIMEOUT_MS) : undefined;
}

function onTimeout() {
  watchdog = undefined;
  const stuck = inFlight.keys().next().value;
  const failed = [...inFlight.keys()];
  inFlight.clear();
  for (const id of failed) {
    respond({ id, type: 'error', error: id === stuck ? TIMED_OUT_ERROR : RESTARTED_ERROR });
  }
  void restart();
}

async function restart() {
  held = [];
  for (;;) {
    worker.terminate();
    worker = startWorker();
    if (await replayCompiles()) break;
  }
  const waiting = held;
  held = null;
  for (const req of waiting) send(req);
}

/**
 * Recompile every slot in the new worker. Source compiles go first, since a
 * compile-ir can use the library and evals a source compile registered.
 * Returns false if one hung: that slot is dropped and the caller starts over
 * with a fresh worker, because the hung one is still busy.
 */
async function replayCompiles(): Promise<boolean> {
  const ordered = [...lastCompile.values()].sort(
    (a, b) => Number(a.type === 'compile-ir') - Number(b.type === 'compile-ir'),
  );
  for (const req of ordered) {
    const slot = req.slot ?? DEFAULT_SLOT;
    const res = await replay(req);
    if (res === 'timeout') {
      lastCompile.delete(slot);
      return false;
    }
    if (res.type === 'error') lastCompile.delete(slot);
  }
  return true;
}

function replay(req: CompileRequest): Promise<WorkerResponse | 'timeout'> {
  return new Promise((resolve) => {
    const id = `replay-${++replayCounter}`;
    const timer = setTimeout(() => {
      replays.delete(id);
      resolve('timeout');
    }, TIMEOUT_MS);
    replays.set(id, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
    const msg: WorkerRequest = { ...req, id };
    worker.postMessage(msg);
  });
}

// ============================================================================
// Inbound
// ============================================================================

self.addEventListener('message', (event: MessageEvent) => {
  const req = event.data as SandboxRequest;
  if (!req?.id || !req?.type) return;
  if (!parentChannel.accepts(event)) return;
  send(req);
});

// Not every browser tells us the parent's origin before it messages us, so
// this one signal uses '*'. It carries nothing but the ready bit.
parent.postMessage({ type: 'ready' }, '*');
