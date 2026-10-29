/**
 * The sandbox iframe's main thread: forwards page requests to the worker and
 * everything the worker sends back to the page, and restarts the worker when
 * it stops answering. `apps/sandbox/src/main.ts` runs it with a real Worker;
 * tests run it over an in-process host.
 *
 * Watchdog. While the worker owes something (a response to an in-flight
 * request, or frames for a running session) it must send some message at
 * least every `timeoutMs`: a response, an `updated` frame, or a `progressed`
 * heartbeat from a sliced request. Silence that long means a single cycle, or
 * a compile, is stuck in user code. The worker is terminated and a new one
 * started; the oldest in-flight request fails `timed-out`, the rest
 * `restarted`.
 *
 * Replay. The relay remembers every live compile by id and every open
 * session's `open` request, and the last successful compile per slot for the
 * slot messages. After a restart it replays them into the new worker, compiles
 * first, sessions at cycle 0 with history cleared and auto-run off. One that
 * hangs again is dropped and replay starts over on a fresh worker. Then each
 * reopened session gets a pushed `updated` frame and the page gets one
 * `restarted` message naming the reopened and dropped sessions.
 *
 * Slot replay (`slotCompiles`, `rememberSlot`, `replaySlotCompiles` and the
 * slot `error` reply on a restart) is for the slot messages. Kept: published
 * @simten/embed 0.5.x / @simten/ui 0.15.x send these; removed at the release
 * with the sandbox.simten.dev route (decision 0008, #424).
 */

import type {
  SandboxMessage,
  SandboxRequest,
  SandboxResponse,
  SessionId,
  SessionRequest,
  SessionUpdate,
  SimSlot,
  WorkerRequest,
  WorkerResponse,
} from './protocol.js';
import { isSessionRequest } from './protocol.js';

/** What the relay needs from a worker. */
export interface RelayWorker {
  post(request: WorkerRequest): void;
  terminate(): void;
}

export interface RelayOptions {
  /** Start a worker. Everything it sends goes to `receive`. */
  startWorker(receive: (message: WorkerResponse) => void): RelayWorker;
  /** Send to the page. */
  respond(message: SandboxMessage | SandboxResponse): void;
  /** Silence allowed while the worker owes something. Default 5000. */
  timeoutMs?: number;
}

export interface Relay {
  /** Take a request from the page. */
  receive(request: WorkerRequest): void;
}

const TIMED_OUT_ERROR = 'Execution timed out. The simulation was restarted from cycle 0.';
const RESTARTED_ERROR = 'Worker restarted';
const RESTARTED_MESSAGE =
  'The simulation stopped responding for 5 seconds and was restarted from cycle 0.';
const DEFAULT_SLOT = 'default';

type SlotCompile = Extract<SandboxRequest, { type: 'compile' | 'compile-ir' }>;
type SessionCompile = Extract<SessionRequest, { type: 'compile' | 'compile-ir' }>;
type SessionOpen = Extract<SessionRequest, { type: 'open' }>;

/** The session a message's state belongs to, if it carries one. */
function sessionOf(request: WorkerRequest | undefined): SessionId | undefined {
  return request && 'session' in request ? request.session : undefined;
}

function stateOf(message: WorkerResponse): SessionUpdate | undefined {
  return 'state' in message ? message.state : undefined;
}

export function createRelay(options: RelayOptions): Relay {
  const timeoutMs = options.timeoutMs ?? 5000;
  let worker = options.startWorker(onWorkerMessage);

  /** Page requests sent to the current worker, oldest first. */
  const inFlight = new Map<string, WorkerRequest>();
  /** Sessions whose last reported state was running: they owe frames. */
  const running = new Set<SessionId>();
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const slotCompiles = new Map<SimSlot, SlotCompile>();
  const compiles = new Map<string, SessionCompile>();
  const sessions = new Map<SessionId, SessionOpen>();

  /** Replay requests waiting on the new worker, by id. */
  const replays = new Map<string, (message: WorkerResponse) => void>();
  let replayCounter = 0;
  /** Page requests that arrive during a restart; sent once replay is done. */
  let held: WorkerRequest[] | null = null;

  // ── Watchdog ──────────────────────────────────────────────────────────────

  const owesSomething = () => inFlight.size > 0 || running.size > 0;

  /** Start the silence clock again from now, if the worker owes anything. */
  function rearm() {
    clearTimeout(watchdog);
    watchdog = owesSomething() ? setTimeout(onSilence, timeoutMs) : undefined;
  }

  function onSilence() {
    watchdog = undefined;
    const stuck = inFlight.keys().next().value;
    for (const [id, request] of inFlight) {
      const code = id === stuck ? 'timed-out' : 'restarted';
      const error = id === stuck ? TIMED_OUT_ERROR : RESTARTED_ERROR;
      if (isSessionRequest(request)) options.respond({ id, type: 'failed', code, error });
      else options.respond({ id, type: 'error', error });
    }
    inFlight.clear();
    running.clear();
    void restart();
  }

  // ── Page ↔ worker ─────────────────────────────────────────────────────────

  function send(request: WorkerRequest) {
    if (held) {
      held.push(request);
      return;
    }
    inFlight.set(request.id, request);
    if (watchdog === undefined) rearm();
    worker.post(request);
  }

  function onWorkerMessage(message: WorkerResponse) {
    if (message.type === 'progressed') {
      rearm();
      return;
    }
    const id = 'id' in message ? message.id : undefined;
    const replay = id === undefined ? undefined : replays.get(id);
    if (id !== undefined && replay) {
      replays.delete(id);
      replay(message);
      return;
    }
    const request = id === undefined ? undefined : inFlight.get(id);
    if (id !== undefined) {
      // A response to nothing in flight belongs to a worker that was restarted.
      if (!request) return;
      inFlight.delete(id);
    }
    trackRunning(message, request);
    if (request) remember(request, message);
    rearm();
    options.respond(message as SandboxMessage | SandboxResponse);
  }

  function trackRunning(message: WorkerResponse, request: WorkerRequest | undefined) {
    const session = 'session' in message ? message.session : sessionOf(request);
    const state = stateOf(message);
    if (session === undefined) return;
    if (state?.isRunning) running.add(session);
    else if (state || message.type === 'closed') running.delete(session);
  }

  /** Keep what a new worker would need to get back to here. */
  function remember(request: WorkerRequest, message: WorkerResponse) {
    if (isSessionRequest(request)) rememberSession(request, message);
    else rememberSlot(request, message as SandboxResponse);
  }

  function rememberSession(request: SessionRequest, message: WorkerResponse) {
    const isCompile = request.type === 'compile' || request.type === 'compile-ir';
    if (isCompile && message.type === 'compiled') {
      compiles.set(request.compile, request);
    } else if (request.type === 'release' && message.type === 'released') {
      compiles.delete(request.compile);
    } else if (request.type === 'open' && message.type === 'opened') {
      sessions.set(request.session, request);
    } else if (request.type === 'close' && message.type === 'closed') {
      sessions.delete(request.session);
    }
  }

  function rememberSlot(request: SandboxRequest, response: SandboxResponse) {
    const compiled = response.type === 'compiled' || response.type === 'compiled-ir';
    if (compiled && (request.type === 'compile' || request.type === 'compile-ir')) {
      const slot = request.slot ?? DEFAULT_SLOT;
      // Re-insert so the map stays in compile order.
      slotCompiles.delete(slot);
      slotCompiles.set(slot, request);
    } else if (response.type === 'disposed' && request.type === 'dispose') {
      slotCompiles.delete(request.slot);
    }
  }

  // ── Restart and replay ────────────────────────────────────────────────────

  async function restart() {
    held = [];
    const dropped: SessionId[] = [];
    let reopened: Map<SessionId, SessionUpdate>;
    for (;;) {
      worker.terminate();
      worker = options.startWorker(onWorkerMessage);
      const result = await replayAll(dropped);
      if (result) {
        reopened = result;
        break;
      }
    }
    for (const [session, state] of reopened) {
      options.respond({ type: 'updated', session, state });
    }
    options.respond({
      type: 'restarted',
      sessions: [...reopened.keys()],
      dropped,
      message: RESTARTED_MESSAGE,
    });
    const waiting = held;
    held = null;
    for (const request of waiting) send(request);
  }

  /**
   * Replay every compile, then every session, into the new worker. Returns
   * the reopened sessions' states, or null if one hung: it's dropped and the
   * caller starts over with a fresh worker, because the hung one is busy.
   */
  async function replayAll(dropped: SessionId[]): Promise<Map<SessionId, SessionUpdate> | null> {
    if (!(await replaySlotCompiles()) || !(await replayCompiles())) return null;
    return replaySessions(dropped);
  }

  /** Source compiles first: a slot compile-ir can use what a source compile registered. */
  async function replaySlotCompiles(): Promise<boolean> {
    const ordered = [...slotCompiles.entries()].sort(
      ([, a], [, b]) => Number(a.type === 'compile-ir') - Number(b.type === 'compile-ir'),
    );
    for (const [slot, request] of ordered) {
      const result = await replay(request);
      if (result === 'timeout' || result.type === 'error') slotCompiles.delete(slot);
      if (result === 'timeout') return false;
    }
    return true;
  }

  async function replayCompiles(): Promise<boolean> {
    for (const [compile, request] of [...compiles]) {
      const result = await replay(request);
      if (result === 'timeout' || result.type === 'failed') compiles.delete(compile);
      if (result === 'timeout') return false;
    }
    return true;
  }

  async function replaySessions(
    dropped: SessionId[],
  ): Promise<Map<SessionId, SessionUpdate> | null> {
    const reopened = new Map<SessionId, SessionUpdate>();
    for (const [session, request] of [...sessions]) {
      const result = await replay(request);
      if (result !== 'timeout' && result.type === 'opened') {
        reopened.set(session, result.state);
        continue;
      }
      sessions.delete(session);
      dropped.push(session);
      if (result === 'timeout') return null;
    }
    return reopened;
  }

  function replay(request: WorkerRequest): Promise<WorkerResponse | 'timeout'> {
    return new Promise((resolve) => {
      const id = `replay-${++replayCounter}`;
      const timer = setTimeout(() => {
        replays.delete(id);
        resolve('timeout');
      }, timeoutMs);
      replays.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      worker.post({ ...request, id });
    });
  }

  return { receive: send };
}
