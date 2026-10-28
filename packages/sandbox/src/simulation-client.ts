/**
 * `SimulationClient`: the page's handle on one session in the sandbox. It has
 * the same method names as core's `Simulation`, async, and no simulation logic
 * of its own: each call is a message, and the client keeps the last state the
 * sandbox reported. History, settling, ticking and the auto-run loop all run
 * in the worker.
 *
 * Requests to one session are applied in the order they're sent, so
 * `setInput(...)` then `tick()` without awaiting the first is safe.
 */

import type { CircuitDefinitions, CircuitIR, PeripheralValue } from '@simten/core/internal';
import { SandboxError } from './errors.js';
import type { SessionId, SessionRequest, SessionResponse, SessionUpdate } from './protocol.js';

export interface SimulationClientState {
  status: 'open' | 'restarted' | 'closed';
  /** Set after a watchdog restart; cleared by the next action. */
  notice: string | null;
  cycle: number;
  ports: ReadonlyMap<string, number>;
  peripherals: ReadonlyMap<string, PeripheralValue>;
  history: { length: number; index: number };
  isRunning: boolean;
}

/** A session request without its id or session; the channel adds both. */
export type SessionRequestBody = SessionRequest extends infer R
  ? R extends { session: SessionId }
    ? Omit<R, 'id' | 'session'>
    : never
  : never;

/** What happens to a session that it didn't ask for. */
export type SessionEvent =
  | { kind: 'update'; state: SessionUpdate }
  | { kind: 'restarted'; message: string }
  | { kind: 'closed'; reason: string };

/** How a `SimulationClient` reaches its sandbox. `SandboxClient` provides it. */
interface SessionChannel {
  /** Send a request for this session; rejects with `SandboxError` on `failed`. */
  request(body: SessionRequestBody): Promise<SessionResponse>;
  /** Called for pushed frames and restarts. Returns a function that stops it. */
  listen(onEvent: (event: SessionEvent) => void): () => void;
  /** The session is gone: forget it, and free anything opened only for it. */
  forget(): void;
}

/** What `opened` told us about the session. */
interface OpenedSession {
  id: SessionId;
  circuit: CircuitIR;
  definitions: CircuitDefinitions;
  isSequential: boolean;
  state: SessionUpdate;
}

/** Auto-run frames per second; the worker pushes one `updated` per frame. */
const FRAME_RATE = 30;
const TOP = '__top__';
const NO_PERIPHERALS: ReadonlyMap<string, PeripheralValue> = new Map();

function fromUpdate(
  update: SessionUpdate,
  status: SimulationClientState['status'],
  notice: string | null,
): SimulationClientState {
  return {
    status,
    notice,
    cycle: update.cycle,
    ports: update.ports,
    peripherals: update.peripherals ?? NO_PERIPHERALS,
    history: update.history,
    isRunning: update.isRunning,
  };
}

export class SimulationClient {
  readonly id: SessionId;
  /** The simulated circuit as IR, harnessed if asked for. Fixed for the session's life. */
  readonly circuit: CircuitIR;
  readonly definitions: CircuitDefinitions;
  readonly isSequential: boolean;

  private readonly channel: SessionChannel;
  private readonly outputNames: ReadonlySet<string>;
  private readonly listeners = new Set<() => void>();
  private readonly stopListening: () => void;
  private state: SimulationClientState;

  constructor(channel: SessionChannel, opened: OpenedSession) {
    this.id = opened.id;
    this.circuit = opened.circuit;
    this.definitions = opened.definitions;
    this.isSequential = opened.isSequential;
    this.channel = channel;
    this.outputNames = new Set(opened.circuit.outputs.map((p) => p.name));
    this.state = fromUpdate(opened.state, 'open', null);
    this.stopListening = channel.listen((event) => this.onEvent(event));
  }

  /** Last state the sandbox reported. The same object until the next update. */
  getState(): SimulationClientState {
    return this.state;
  }

  /** Called after every state change. Fits `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get cycle(): number {
    return this.state.cycle;
  }

  get history(): { readonly length: number; readonly index: number } {
    return this.state.history;
  }

  /** Read one top-level output from the last state, as `Simulation.get` does. Unknown names throw. */
  get(name: string): number {
    if (!this.outputNames.has(name)) {
      const names = [...this.outputNames].join(', ') || '(none)';
      throw new Error(
        `get('${name}'): ${this.circuit.name} has no output named '${name}'. Its outputs: ${names}`,
      );
    }
    return this.state.ports.get(`${TOP}.${name}`) ?? 0;
  }

  /** Drive top-level input ports. Unknown names reject. */
  async set(values: Record<string, number>): Promise<void> {
    await this.update({ type: 'set', values });
  }

  /** Write an Input, Switch or keyboard node by dotted path. Rejects for any other node. */
  async setInput(path: string, value: number): Promise<void> {
    await this.update({ type: 'set-input', path, value });
  }

  /** Advance `count` rising clock edges (default 1), recorded as one history step. */
  async tick(count = 1): Promise<void> {
    await this.update({ type: 'tick', count });
  }

  async reset(): Promise<void> {
    await this.update({ type: 'reset' });
  }

  stepBack(): Promise<boolean> {
    return this.move({ type: 'step-back' });
  }

  stepForward(): Promise<boolean> {
    return this.move({ type: 'step-forward' });
  }

  seek(index: number): Promise<boolean> {
    return this.move({ type: 'seek', index });
  }

  /** Auto-run at `speed` cycles per second. Calling it while running changes the speed. */
  async run(speed: number): Promise<void> {
    await this.update({ type: 'run', speed, frameRate: FRAME_RATE });
  }

  async pause(): Promise<void> {
    await this.update({ type: 'pause' });
  }

  /** Tick `count` times and return `port` after each tick (audio). `port` is a port-map key. */
  async sample(port: string, count: number, inputs?: Record<string, number>): Promise<number[]> {
    const response = await this.send({ type: 'sample', port, count, inputs });
    if (response.type !== 'sampled') throw unexpected(response);
    this.apply(response.state);
    return response.samples;
  }

  /** Drive input `path` through 0..count-1, settling each time, and read `port`. Doesn't tick. */
  async scan(path: string, port: string, count: number): Promise<number[]> {
    const response = await this.send({ type: 'scan', path, port, count });
    if (response.type !== 'scanned') throw unexpected(response);
    return response.values;
  }

  /** Free the session in the sandbox. */
  async close(): Promise<void> {
    if (this.state.status === 'closed') return;
    try {
      await this.channel.request({ type: 'close' });
    } finally {
      this.end(null);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async send(body: SessionRequestBody): Promise<SessionResponse> {
    if (this.state.status === 'closed') {
      throw new SandboxError('closed', 'This session is closed.');
    }
    // Any action clears a restart notice.
    if (this.state.notice !== null) this.replace({ ...this.state, status: 'open', notice: null });
    return this.channel.request(body);
  }

  private async update(body: SessionRequestBody): Promise<SessionResponse> {
    const response = await this.send(body);
    if (response.type !== 'updated') throw unexpected(response);
    this.apply(response.state);
    return response;
  }

  private async move(body: SessionRequestBody): Promise<boolean> {
    const response = await this.update(body);
    return response.type === 'updated' && response.moved === true;
  }

  private apply(update: SessionUpdate): void {
    if (this.state.status === 'closed') return;
    this.replace(fromUpdate(update, this.state.status, this.state.notice));
  }

  private replace(state: SimulationClientState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private onEvent(event: SessionEvent): void {
    switch (event.kind) {
      case 'update':
        this.apply(event.state);
        return;
      case 'restarted':
        this.replace({
          ...this.state,
          status: 'restarted',
          notice: event.message,
          isRunning: false,
        });
        return;
      case 'closed':
        this.end(event.reason);
        return;
    }
  }

  /** `reason` is shown as the notice when the sandbox ended the session, not the page. */
  private end(reason: string | null): void {
    if (this.state.status === 'closed') return;
    this.stopListening();
    this.channel.forget();
    this.replace({ ...this.state, status: 'closed', notice: reason, isRunning: false });
  }
}

function unexpected(response: SessionResponse): SandboxError {
  return new SandboxError('failed', `Unexpected response '${response.type}' from the sandbox.`);
}
