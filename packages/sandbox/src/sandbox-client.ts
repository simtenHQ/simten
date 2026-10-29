/**
 * `SandboxClient`: one sandbox, from the page. It creates the hidden
 * cross-origin iframe, waits for its `ready` handshake, numbers requests and
 * matches responses, and hands out `SimulationClient`s for sessions. It also
 * compiles and exports for callers that don't simulate (the game's grader, the
 * editor's Export button).
 *
 * One sandbox per embed or component: every `SandboxClient` has its own
 * iframe. A sandbox can still host several sessions, so compile, session and
 * request ids are unique per page, across every client on it.
 *
 * Security (details in apps/web/content/docs/security.mdx): the iframe is a
 * separate origin, so user code can't reach the page's cookies, storage or
 * DOM; only structured-clone data crosses postMessage; all user code runs in
 * the sandbox's worker under a 5s watchdog.
 */

import type { Circuit } from '@simten/core';
import {
  type CircuitDefinitions,
  type CircuitIR,
  internalsOf,
  type MemoryContents,
} from '@simten/core/internal';
import type { ExportResult, VerilogExportOptions } from '@simten/core/verilog';
import { SandboxError } from './errors.js';
import type {
  BehaviorSource,
  CompileId,
  SandboxMessage,
  SessionId,
  SessionRequest,
  SessionResponse,
} from './protocol.js';
import {
  type SessionEvent,
  type SessionRequestBody,
  SimulationClient,
} from './simulation-client.js';

export type SandboxStatus = 'loading' | 'ready' | 'unavailable';

/** A compile in one sandbox. Pass it to `open` or `export`; `release` it when done. */
export interface Compiled {
  id: CompileId;
  /** Circuits the source builds, in order. */
  circuits: CircuitIR[];
  /** Circuits the source exports. */
  exported: CircuitIR[];
  /** Everything they depend on. */
  libraryCircuits: CircuitIR[];
  definitions: CircuitDefinitions;
}

/** A circuit is chosen by the name given to `circuit(...)`. */
export type SessionSource =
  | { compiled: Compiled; circuit: string }
  /** A circuit built on the page (blog, docs, `useSimulation(circuit)`), sent as IR plus behavior as text. */
  | { circuit: Circuit };

export interface OpenOptions {
  /** Where the inputs sit when the session opens, by the keys `set` takes. */
  initialInputs?: Record<string, number>;
  /** Cycles of history. Default 200. */
  history?: number;
  /**
   * Memory contents to load before cycle 0, by node path. They survive
   * `reset`, as flash does. Loading a different program means opening a new
   * session with different contents.
   */
  memory?: Record<string, MemoryContents>;
}

/** How a `SandboxClient` talks to its sandbox. The default is a hidden iframe. */
export interface SandboxTransport {
  /** Start listening; `receive` gets every message from the sandbox. */
  connect(receive: (message: SandboxMessage) => void): void;
  send(request: SessionRequest): void;
  close(): void;
}

export interface SandboxClientOptions {
  /** The sandbox's origin. Defaults to the deployed sandbox, or localhost:3002 in development. */
  origin?: string;
  /** Give up on the iframe's `ready` handshake after this long. Default 10s. */
  readyTimeoutMs?: number;
  /** Talk over something other than an iframe (tests, other hosts). */
  transport?: SandboxTransport;
}

/** Default history for a session: today's embed cap. */
const DEFAULT_HISTORY = 200;
const READY_TIMEOUT_MS = 10_000;
const UNAVAILABLE_ERROR =
  'Sandbox failed to load. It may be blocked by a browser extension, or unreachable.';

// The sandbox origin: VITE_SANDBOX_ORIGIN if set, the local dev sandbox in a
// Vite dev build, and the deployed sandbox otherwise (including bundlers that
// have no `import.meta.env`).
const env = (import.meta as { env?: { VITE_SANDBOX_ORIGIN?: string; PROD?: boolean } }).env;
const DEFAULT_ORIGIN: string =
  env?.VITE_SANDBOX_ORIGIN ||
  (env && !env.PROD ? 'http://localhost:3002' : 'https://sandbox.simtenusercontent.dev');

// Ids are unique per page: a module-wide counter, behind a random prefix in
// case two copies of this module end up on one page.
const PAGE = Math.random().toString(36).slice(2, 8);
let counter = 0;
const nextId = (kind: 'r' | 'c' | 's') => `${PAGE}-${kind}${++counter}`;

/** A request without its id; `request` assigns one. */
type RequestBody = SessionRequest extends infer R
  ? R extends SessionRequest
    ? Omit<R, 'id'>
    : never
  : never;

interface Pending {
  resolve(response: SessionResponse): void;
  reject(error: SandboxError): void;
}

/** A hidden iframe on `origin`, answering only to messages from itself. */
export function iframeTransport(origin: string): SandboxTransport {
  let iframe: HTMLIFrameElement | null = null;
  let listener: ((event: MessageEvent) => void) | null = null;
  return {
    connect(receive) {
      iframe = document.createElement('iframe');
      iframe.src = origin;
      // allow-same-origin keeps the iframe's own origin, so it can load its
      // scripts. The page is a different origin, so isolation still holds.
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'display:none;width:0;height:0;position:absolute;';
      const frame = iframe;
      listener = (event: MessageEvent) => {
        // Every sandbox on the page shares this window's messages: answer
        // only to our own iframe.
        if (event.origin !== origin || event.source !== frame.contentWindow) return;
        receive(event.data as SandboxMessage);
      };
      window.addEventListener('message', listener);
      document.body.appendChild(iframe);
    },
    send(request) {
      iframe?.contentWindow?.postMessage(request, origin);
    },
    close() {
      if (listener) window.removeEventListener('message', listener);
      iframe?.remove();
      iframe = null;
    },
  };
}

/** A `MessagePort` whose other end is a sandbox (a worker, or an in-process host in tests). */
export function portTransport(port: MessagePort): SandboxTransport {
  return {
    connect(receive) {
      port.onmessage = (event: MessageEvent) => receive(event.data as SandboxMessage);
    },
    send(request) {
      port.postMessage(request);
    },
    close() {
      port.onmessage = null;
      port.close();
    },
  };
}

/** Each primitive's behavior as text, for the sandbox to rebuild. */
function behaviorSources(circuit: Circuit): Record<string, BehaviorSource> {
  const sources: Record<string, BehaviorSource> = {};
  for (const c of [circuit, ...internalsOf(circuit).dependencies.values()]) {
    const { behavior } = internalsOf(c);
    if (!behavior || sources[c.name]) continue;
    sources[c.name] = {
      evalSource: behavior.evalFn.toString(),
      onTickSource: behavior.onTickFn?.toString(),
      inputNames: behavior.inputNames,
      outputNames: behavior.outputNames,
      stateKeys: behavior.stateKeys,
    };
  }
  return sources;
}

function definitionsOf(circuits: Iterable<CircuitIR>): CircuitDefinitions {
  const byName = new Map<string, CircuitIR>();
  for (const c of circuits) byName.set(c.name, c);
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
  };
}

export class SandboxClient {
  private currentStatus: SandboxStatus = 'loading';
  private readonly statusListeners = new Set<(status: SandboxStatus) => void>();
  private readonly transport: SandboxTransport;
  private readonly pending = new Map<string, Pending>();
  /** Requests waiting for `ready`. */
  private queued: SessionRequest[] = [];
  private readonly sessionListeners = new Map<SessionId, (event: SessionEvent) => void>();
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(options: SandboxClientOptions = {}) {
    this.transport = options.transport ?? iframeTransport(options.origin ?? DEFAULT_ORIGIN);
    this.readyTimer = setTimeout(
      () => this.markUnavailable(),
      options.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
    this.transport.connect((message) => this.receive(message));
  }

  get status(): SandboxStatus {
    return this.currentStatus;
  }

  onStatusChange(listener: (status: SandboxStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async compile(source: string): Promise<Compiled> {
    return this.compiled(await this.request({ type: 'compile', compile: nextId('c'), source }));
  }

  /** Compile a circuit built on the page: its IR, its dependencies and their behavior as text. */
  async compileCircuit(circuit: Circuit): Promise<Compiled> {
    const { ir, dependencies } = internalsOf(circuit);
    const libraryCircuits = [...dependencies.values()].map((c) => internalsOf(c).ir);
    const response = await this.request({
      type: 'compile-ir',
      compile: nextId('c'),
      circuit: ir,
      libraryCircuits,
      behaviors: behaviorSources(circuit),
    });
    return this.compiled(response);
  }

  /** Free a compile. Sessions opened from it keep running. */
  release(compiled: Compiled): void {
    if (this.disposed || this.currentStatus === 'unavailable') return;
    // Nothing to wait for and nothing to do if it fails.
    this.request({ type: 'release', compile: compiled.id }).catch(() => {});
  }

  /** Opens a session. Resolves once the sandbox has built it. */
  async open(source: SessionSource, options: OpenOptions = {}): Promise<SimulationClient> {
    const owned = 'compiled' in source ? null : await this.compileCircuit(source.circuit);
    const compiled = owned ?? (source as { compiled: Compiled }).compiled;
    const name = 'compiled' in source ? source.circuit : source.circuit.name;
    const session = nextId('s');
    let response: SessionResponse;
    try {
      response = await this.request({
        type: 'open',
        session,
        compile: compiled.id,
        circuit: name,
        initialInputs: options.initialInputs,
        history: options.history ?? DEFAULT_HISTORY,
        memory: options.memory,
      });
    } catch (e) {
      if (owned) this.release(owned);
      throw e;
    }
    if (response.type !== 'opened') throw unexpected(response);
    const { circuit } = response;
    return new SimulationClient(
      {
        request: (body) => this.request(withSession(body, session)),
        listen: (onEvent) => {
          this.sessionListeners.set(session, onEvent);
          return () => {
            this.sessionListeners.delete(session);
          };
        },
        forget: () => {
          this.sessionListeners.delete(session);
          if (owned) this.release(owned);
        },
      },
      {
        id: session,
        circuit,
        definitions: definitionsOf([...compiled.libraryCircuits, ...compiled.circuits, circuit]),
        isSequential: response.isSequential,
        state: response.state,
      },
    );
  }

  /** Verilog for one circuit of a compile, with the compile's own behavior. */
  async export(
    compiled: Compiled,
    circuit: string,
    options?: VerilogExportOptions,
  ): Promise<ExportResult> {
    const response = await this.request({
      type: 'export',
      compile: compiled.id,
      circuit,
      options,
    });
    if (response.type !== 'exported') throw unexpected(response);
    return response.result;
  }

  /** Remove the iframe and fail everything pending. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.readyTimer);
    this.transport.close();
    this.failAll(new SandboxError('closed', 'The sandbox was closed.'));
    for (const listener of [...this.sessionListeners.values()]) {
      listener({ kind: 'closed', reason: 'The sandbox was closed.' });
    }
    this.sessionListeners.clear();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private setStatus(status: SandboxStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private markUnavailable(): void {
    if (this.currentStatus !== 'loading') return;
    this.setStatus('unavailable');
    this.queued = [];
    this.failAll(new SandboxError('unavailable', UNAVAILABLE_ERROR));
  }

  private failAll(error: SandboxError): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) p.reject(error);
  }

  private compiled(response: SessionResponse): Compiled {
    if (response.type !== 'compiled') throw unexpected(response);
    return {
      id: response.compile,
      circuits: response.circuits,
      exported: response.exported,
      libraryCircuits: response.libraryCircuits,
      definitions: definitionsOf([
        ...response.libraryCircuits,
        ...response.exported,
        ...response.circuits,
      ]),
    };
  }

  /**
   * Send a request and wait for its response. A `failed` response rejects
   * with a `SandboxError`.
   */
  private request(body: RequestBody): Promise<SessionResponse> {
    if (this.disposed) return Promise.reject(new SandboxError('closed', 'The sandbox was closed.'));
    if (this.currentStatus === 'unavailable') {
      return Promise.reject(new SandboxError('unavailable', UNAVAILABLE_ERROR));
    }
    const request = { ...body, id: nextId('r') } as SessionRequest;
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      if (this.currentStatus === 'ready') this.transport.send(request);
      else this.queued.push(request);
    });
  }

  private receive(message: SandboxMessage): void {
    switch (message.type) {
      case 'ready':
        this.onReady();
        return;
      case 'restarted':
        for (const session of message.sessions) {
          this.sessionListeners.get(session)?.({ kind: 'restarted', message: message.message });
        }
        for (const session of message.dropped) {
          this.sessionListeners.get(session)?.({ kind: 'closed', reason: message.message });
        }
        return;
    }
    if (!('id' in message) || message.id === undefined) {
      // A frame pushed while a session auto-runs, or after a restart.
      if (message.type === 'updated') {
        this.sessionListeners.get(message.session)?.({ kind: 'update', state: message.state });
      }
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    const response = message as SessionResponse;
    if (response.type === 'failed') pending.reject(new SandboxError(response.code, response.error));
    else pending.resolve(response);
  }

  private onReady(): void {
    if (this.currentStatus === 'ready' || this.disposed) return;
    clearTimeout(this.readyTimer);
    this.setStatus('ready');
    const queued = this.queued;
    this.queued = [];
    for (const request of queued) this.transport.send(request);
  }
}

function withSession(body: SessionRequestBody, session: SessionId): RequestBody {
  return { ...body, session } as RequestBody;
}

function unexpected(response: SessionResponse): SandboxError {
  return new SandboxError('failed', `Unexpected response '${response.type}' from the sandbox.`);
}
