/**
 * `SandboxClient` and `SimulationClient` over a `MessageChannel`, to the relay
 * and a session host running in-process: the page, the iframe and the worker
 * of a real sandbox, minus the browser. Messages are structured-cloned at
 * each hop as postMessage would.
 */

import { bit, bus, circuit } from '@simten/core/circuit';
import { And } from '@simten/core/std';
import { afterEach, describe, expect, it } from 'vitest';
import { SandboxError } from '../errors.js';
import type { SessionRequest, WorkerRequest } from '../protocol.js';
import { createRelay } from '../relay.js';
import { portTransport, SandboxClient, type SandboxTransport } from '../sandbox-client.js';
import { SessionHost } from '../session-host.js';
import type { SimulationClient } from '../simulation-client.js';
import { ADDER, COUNTER } from './helpers.js';

interface SandboxOptions {
  /** Silence the watchdog allows. */
  timeoutMs?: number;
  /** A request the worker gets stuck on, as user code in an infinite loop would. */
  hangsOn?: (request: WorkerRequest) => boolean;
  /** Sees every request the page sends. */
  onSend?: (request: SessionRequest) => void;
}

const open: SandboxClient[] = [];

afterEach(() => {
  for (const client of open.splice(0)) client.dispose();
});

/** A sandbox: relay and worker in-process, the page on the other end of a MessageChannel. */
function startSandbox(options: SandboxOptions = {}) {
  const { port1: page, port2: iframe } = new MessageChannel();
  let workers = 0;
  /** Makes the current worker stop answering, as a hung cycle would. */
  let stickCurrent = () => {};
  const relay = createRelay({
    timeoutMs: options.timeoutMs ?? 5000,
    respond: (message) => iframe.postMessage(message),
    startWorker: (receive) => {
      workers++;
      let dead = false;
      let stuck = false;
      const alive = () => !dead && !stuck;
      stickCurrent = () => {
        stuck = true;
      };
      const host = new SessionHost({
        post: (message) => {
          const copy = structuredClone(message);
          setTimeout(() => alive() && receive(copy), 0);
        },
        clock: {
          now: () => performance.now(),
          setTimeout: (callback, ms) => setTimeout(() => alive() && callback(), ms),
          clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        },
      });
      return {
        post: (request) => {
          if (!alive()) return;
          if (options.hangsOn?.(request)) {
            stuck = true;
            return;
          }
          const copy = structuredClone(request) as SessionRequest;
          setTimeout(() => alive() && host.handle(copy), 0);
        },
        terminate: () => {
          dead = true;
        },
      };
    },
  });
  iframe.onmessage = (event) => relay.receive(event.data as WorkerRequest);
  iframe.postMessage({ type: 'ready' });

  const port = portTransport(page);
  const transport: SandboxTransport = {
    connect: (receive) => port.connect(receive),
    send: (request) => {
      options.onSend?.(request);
      port.send(request);
    },
    close: () => {
      port.close();
      iframe.close();
    },
  };
  const client = new SandboxClient({ transport });
  open.push(client);
  return { client, workers: () => workers, stick: () => stickCurrent() };
}

async function openCounter(client: SandboxClient, history = 200): Promise<SimulationClient> {
  const compiled = await client.compile(COUNTER);
  const sim = await client.open({ compiled, circuit: 'Counter' }, { history });
  await sim.set({ en: 1 });
  return sim;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SimulationClient', () => {
  it('mirrors Simulation: set, tick, get, history', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    expect(sim.isSequential).toBe(true);
    expect(sim.circuit.name).toBe('Counter');
    await sim.tick();
    await sim.tick(4);
    expect(sim.cycle).toBe(5);
    expect(sim.get('count')).toBe(5);
    expect(sim.history).toEqual({ length: 3, index: 2 });
    expect(await sim.stepBack()).toBe(true);
    expect(sim.get('count')).toBe(1);
    expect(await sim.stepForward()).toBe(true);
    expect(await sim.seek(0)).toBe(true);
    expect(sim.cycle).toBe(0);
    await sim.reset();
    expect(sim.history).toEqual({ length: 1, index: 0 });
    expect(() => sim.get('nope')).toThrow("get('nope'): Counter has no output named 'nope'");
  });

  it('keeps one state object between updates and tells subscribers about each', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    const first = sim.getState();
    expect(sim.getState()).toBe(first);
    let calls = 0;
    const unsubscribe = sim.subscribe(() => calls++);
    await sim.tick();
    expect(calls).toBe(1);
    expect(sim.getState()).not.toBe(first);
    unsubscribe();
    await sim.tick();
    expect(calls).toBe(1);
  });

  it('stepBack resolves false with history 0', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client, 0);
    await sim.tick(3);
    expect(await sim.stepBack()).toBe(false);
    expect(sim.cycle).toBe(3);
  });

  it('applies requests to one session in order without awaiting each', async () => {
    const { client } = startSandbox();
    const compiled = await client.compile(COUNTER);
    const sim = await client.open({ compiled, circuit: 'Counter' }, { harness: true });
    void sim.setInput('en', 1);
    void sim.tick(3);
    void sim.setInput('en', 0);
    await sim.tick(3);
    expect(sim.getState().ports.get('count.in')).toBe(3);
  });

  it('rejects setInput on a register with a SandboxError', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    const error = await sim.setInput('reg', 1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SandboxError);
    expect((error as SandboxError).code).toBe('failed');
    expect((error as SandboxError).message).toMatch(/'reg' is a Register, not an input/);
  });

  it('streams auto-run frames to subscribers and stops on pause', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    let frames = 0;
    sim.subscribe(() => frames++);
    await sim.run(600);
    expect(sim.getState().isRunning).toBe(true);
    await delay(300);
    await sim.pause();
    expect(sim.getState().isRunning).toBe(false);
    expect(frames).toBeGreaterThan(4);
    expect(sim.cycle).toBeGreaterThan(60);
    const stopped = sim.cycle;
    await delay(100);
    expect(sim.cycle).toBe(stopped);
  });

  it('samples a port after every tick', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    expect(await sim.sample('__top__.count', 4)).toEqual([1, 2, 3, 4]);
    expect(sim.cycle).toBe(4);
  });

  it('rejects calls after close', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    await sim.close();
    expect(sim.getState().status).toBe('closed');
    const error = await sim.tick().catch((e: unknown) => e);
    expect((error as SandboxError).code).toBe('closed');
  });
});

describe('SandboxClient', () => {
  it('opens a circuit built on the page through compile-ir', async () => {
    const { client } = startSandbox();
    const Double = circuit('Double', {
      inputs: { a: bus(8) },
      outputs: { y: bus(8) },
      eval: ({ a }) => ({ y: (a * 2) & 0xff }),
    });
    const Top = circuit('PageTop', {
      inputs: { a: bus(8), x: bit, z: bit },
      outputs: { y: bus(8), both: bit },
      nodes: { d: Double, and: And },
      connect: ({ inputs, outputs, nodes: { d, and } }) => [
        inputs.a.to(d.a),
        d.y.to(outputs.y),
        inputs.x.to(and.a),
        inputs.z.to(and.b),
        and.out.to(outputs.both),
      ],
    });
    const sim = await client.open({ circuit: Top }, { history: 0 });
    await sim.set({ a: 21, x: 1, z: 1 });
    expect(sim.get('y')).toBe(42);
    expect(sim.get('both')).toBe(1);
  });

  it('exports with the compile’s behavior', async () => {
    const { client } = startSandbox();
    const compiled = await client.compile(ADDER);
    expect(compiled.circuits.map((c) => c.name)).toEqual(['Add']);
    expect(compiled.definitions.resolveCircuit('Add')?.name).toBe('Add');
    const result = await client.export(compiled, 'Add');
    expect(result.verilog).toMatch(/module Add/);
  });

  it('rejects a compile error with a SandboxError', async () => {
    const { client } = startSandbox();
    const error = await client.compile('const = ;').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SandboxError);
    expect((error as SandboxError).code).toBe('failed');
  });

  it('becomes unavailable when the sandbox never says ready', async () => {
    const { port1 } = new MessageChannel();
    const client = new SandboxClient({ transport: portTransport(port1), readyTimeoutMs: 50 });
    open.push(client);
    const pending = client.compile(ADDER).catch((e: unknown) => e);
    await delay(80);
    expect(client.status).toBe('unavailable');
    expect(((await pending) as SandboxError).code).toBe('unavailable');
    expect(((await client.compile(ADDER).catch((e: unknown) => e)) as SandboxError).code).toBe(
      'unavailable',
    );
  });

  it('rejects everything pending when disposed', async () => {
    const { client } = startSandbox();
    const sim = await openCounter(client);
    const pending = sim.tick(1_000_000).catch((e: unknown) => e);
    client.dispose();
    expect(((await pending) as SandboxError).code).toBe('closed');
    expect(sim.getState().status).toBe('closed');
  });
});

describe('several sessions in one sandbox', () => {
  it('interleaved set and tick on two sessions each end in their own state', async () => {
    const { client } = startSandbox();
    const compiled = await client.compile(COUNTER);
    const a = await client.open({ compiled, circuit: 'Counter' });
    const b = await client.open({ compiled, circuit: 'Counter' });
    const calls: Promise<void>[] = [];
    calls.push(a.set({ en: 1 }), b.set({ en: 0 }));
    for (let i = 0; i < 5; i++) calls.push(a.tick(2), b.tick(1));
    calls.push(b.set({ en: 1 }), b.tick(3), a.set({ en: 0 }), a.tick(7));
    await Promise.all(calls);
    expect(a.cycle).toBe(17);
    expect(a.get('count')).toBe(10);
    expect(b.cycle).toBe(8);
    expect(b.get('count')).toBe(3);
  });

  it('a long tick on one session delays another session by no more than a frame or two', async () => {
    const { client } = startSandbox();
    const compiled = await client.compile(COUNTER);
    const busy = await client.open({ compiled, circuit: 'Counter' }, { history: 0 });
    const other = await client.open({ compiled, circuit: 'Counter' }, { history: 0 });
    await busy.set({ en: 1 });
    let busyDone = false;
    const long = busy.tick(400_000).then(() => {
      busyDone = true;
    });
    await delay(50);
    const latencies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await other.tick();
      latencies.push(performance.now() - start);
    }
    expect(busyDone).toBe(false);
    // A frame is 33ms; the busy session's slices take about 80% of one.
    expect(Math.max(...latencies)).toBeLessThan(70);
    await long;
    expect(busy.cycle).toBe(400_000);
    expect(other.cycle).toBe(5);
  });

  it('ids are unique across sessions and across several clients on one page', async () => {
    const requests: SessionRequest[] = [];
    const clients = [1, 2, 3].map(() => startSandbox({ onSend: (r) => requests.push(r) }).client);
    for (const client of clients) {
      const compiled = await client.compile(COUNTER);
      await client.open({ compiled, circuit: 'Counter' });
      await client.open({ compiled, circuit: 'Counter' });
    }
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(requests.map((r) => r.id))).toBe(true);
    const compiles = requests.filter((r) => r.type === 'compile').map((r) => r.compile);
    const sessions = requests.filter((r) => r.type === 'open').map((r) => r.session);
    expect(compiles).toHaveLength(3);
    expect(sessions).toHaveLength(6);
    expect(unique(compiles)).toBe(true);
    expect(unique(sessions)).toBe(true);
  });
});

describe('a watchdog restart', () => {
  it('replays every compile and session and rejects every pending request', async () => {
    const hangs = (r: WorkerRequest) => r.type === 'tick' && 'count' in r && r.count === 999;
    const { client, workers } = startSandbox({ timeoutMs: 200, hangsOn: hangs });
    const counter = await client.compile(COUNTER);
    const adder = await client.compile(ADDER);
    const a = await client.open({ compiled: counter, circuit: 'Counter' });
    const b = await client.open({ compiled: adder, circuit: 'Add' });
    await a.set({ en: 1 });
    await a.tick(5);
    await b.set({ a: 1, b: 2 });

    const hung = a.tick(999).catch((e: unknown) => e);
    const queued = b.set({ a: 3 }).catch((e: unknown) => e);
    expect(((await hung) as SandboxError).code).toBe('timed-out');
    expect(((await queued) as SandboxError).code).toBe('restarted');

    await delay(50);
    expect(workers()).toBe(2);
    for (const sim of [a, b]) {
      expect(sim.getState().status).toBe('restarted');
      expect(sim.getState().notice).toMatch(/restarted from cycle 0/);
      expect(sim.cycle).toBe(0);
    }
    expect(b.get('sum')).toBe(0);

    // Sessions and compiles work again under their old ids.
    await a.set({ en: 1 });
    await a.tick(2);
    expect(a.get('count')).toBe(2);
    expect(a.getState()).toMatchObject({ status: 'open', notice: null });
    const again = await client.open({ compiled: adder, circuit: 'Add' });
    await again.set({ a: 4, b: 4 });
    expect(again.get('sum')).toBe(8);
  });

  it('restarts a worker that goes silent while auto-running', async () => {
    const { client, workers, stick } = startSandbox({ timeoutMs: 200 });
    const sim = await openCounter(client);
    await sim.run(300);
    await delay(100);
    expect(sim.cycle).toBeGreaterThan(0);
    // Nothing is in flight: the running session owes frames and stops sending them.
    stick();
    await delay(400);
    expect(workers()).toBe(2);
    expect(sim.getState()).toMatchObject({ status: 'restarted', isRunning: false, cycle: 0 });
  });
});
