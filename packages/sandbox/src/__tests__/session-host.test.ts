import { EXAMPLES } from '@simten/core/examples';
import { executeCircuitCode } from '@simten/core/internal';
import { exportVerilog } from '@simten/core/verilog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostClock } from '../session-host.js';
import { ADDER, COUNTER, D_LATCH, expectType, startHost } from './helpers.js';

async function openCounter(history = 10, options: { harness?: boolean } = {}) {
  const host = startHost();
  expectType(await host.call({ type: 'compile', compile: 'c1', source: COUNTER }), 'compiled');
  const opened = expectType(
    await host.call({
      type: 'open',
      session: 's1',
      compile: 'c1',
      circuit: 'Counter',
      history,
      ...options,
    }),
    'opened',
  );
  return { ...host, opened };
}

describe('compile and open', () => {
  it('compiles source and opens a circuit by name', async () => {
    const { call } = startHost();
    const compiled = expectType(
      await call({ type: 'compile', compile: 'c1', source: ADDER + COUNTER }),
      'compiled',
    );
    expect(compiled.circuits.map((c) => c.name)).toEqual(['Add', 'Counter']);
    const opened = expectType(
      await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Add', history: 0 }),
      'opened',
    );
    expect(opened.isSequential).toBe(false);
    expect(opened.circuit.name).toBe('Add');
    expect(opened.state.cycle).toBe(0);
  });

  it('reports a compile error as failed', async () => {
    const { call } = startHost();
    const res = expectType(
      await call({ type: 'compile', compile: 'c1', source: 'const x = ;' }),
      'failed',
    );
    expect(res.code).toBe('failed');
  });

  it('names the circuits there are when opening one that is not there', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ADDER });
    const res = expectType(
      await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Nope', history: 0 }),
      'failed',
    );
    expect(res.error).toBe("No circuit named 'Nope' in this compile. Its circuits: Add");
  });

  it('opens the circuit harnessed', async () => {
    const { opened } = await openCounter(10, { harness: true });
    expect(opened.circuit.name).toBe('CounterDemo');
    expect(opened.circuit.nodes.map((n) => n.componentRef).sort()).toEqual([
      'Counter',
      'HexDisplay',
      'Switch',
    ]);
  });

  it('keeps sessions after their compile is released', async () => {
    const { call } = await openCounter();
    expectType(await call({ type: 'release', compile: 'c1' }), 'released');
    expectType(await call({ type: 'set', session: 's1', values: { en: 1 } }), 'updated');
    const ticked = expectType(await call({ type: 'tick', session: 's1', count: 3 }), 'updated');
    expect(ticked.state.ports.get('__top__.count')).toBe(3);
    const reopen = expectType(
      await call({ type: 'open', session: 's2', compile: 'c1', circuit: 'Counter', history: 0 }),
      'failed',
    );
    expect(reopen.error).toBe("No compile 'c1' in this sandbox.");
  });
});

describe('set and tick', () => {
  it('drives inputs by name and ticks', async () => {
    const { call } = await openCounter();
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    const res = expectType(await call({ type: 'tick', session: 's1', count: 5 }), 'updated');
    expect(res.state.cycle).toBe(5);
    expect(res.state.ports.get('__top__.count')).toBe(5);
  });

  it('settles a combinational circuit after set', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ADDER });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Add', history: 0 });
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { a: 2, b: 3 } }),
      'updated',
    );
    expect(res.state.ports.get('__top__.sum')).toBe(5);
  });

  it('rejects a node that is not an input', async () => {
    const { call } = await openCounter();
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { reg: 1 } }),
      'failed',
    );
    expect(res.error).toMatch(/'reg' is a Register, not an input/);
  });

  it('answers requests for a closed session with failed', async () => {
    const { call } = await openCounter();
    expectType(await call({ type: 'close', session: 's1' }), 'closed');
    const res = expectType(await call({ type: 'tick', session: 's1', count: 1 }), 'failed');
    expect(res.error).toBe("No session 's1' in this sandbox.");
  });
});

describe('history', () => {
  it('records one step per tick request and steps back and forward', async () => {
    const { call } = await openCounter(10);
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    await call({ type: 'tick', session: 's1', count: 1 });
    await call({ type: 'tick', session: 's1', count: 4 });
    const back = expectType(await call({ type: 'step-back', session: 's1' }), 'updated');
    expect(back.moved).toBe(true);
    expect(back.state.cycle).toBe(1);
    expect(back.state.history).toEqual({ length: 3, index: 1 });
    const forward = expectType(await call({ type: 'step-forward', session: 's1' }), 'updated');
    expect(forward.state.cycle).toBe(5);
    const seek = expectType(await call({ type: 'seek', session: 's1', index: 0 }), 'updated');
    expect(seek.moved).toBe(true);
    expect(seek.state.ports.get('__top__.count')).toBe(0);
  });

  it('stepBack moves nothing with history 0', async () => {
    const { call } = await openCounter(0);
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    await call({ type: 'tick', session: 's1', count: 3 });
    const back = expectType(await call({ type: 'step-back', session: 's1' }), 'updated');
    expect(back.moved).toBe(false);
    expect(back.state.cycle).toBe(3);
    expect(back.state.history).toEqual({ length: 0, index: -1 });
  });

  it('reset goes back to cycle 0 and starts history again', async () => {
    const { call } = await openCounter(10);
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    await call({ type: 'tick', session: 's1', count: 3 });
    const res = expectType(await call({ type: 'reset', session: 's1' }), 'updated');
    expect(res.state.cycle).toBe(0);
    expect(res.state.history).toEqual({ length: 1, index: 0 });
  });
});

describe('a large tick', () => {
  // Each evaluation of `Slow` costs 1ms on this clock, so the host's cost
  // estimate sees a slow circuit and slices.
  const SLOW = `
const Slow = circuit('Slow', {
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => { globalThis.slowClock.now += 1; return { y: (a + 1) & 0xff }; },
})
const SlowCounter = circuit('SlowCounter', {
  outputs: { count: bus(8) },
  nodes: { reg: Register(), inc: Slow, on: Constant({ value: 1 }) },
  connect: ({ outputs, nodes: { reg, inc, on } }) => [
    on.out.to(reg.we),
    reg.q.to(inc.a, outputs.count),
    inc.y.to(reg.data),
  ],
})
`;
  const slowClock = { now: 0 };
  /** The fake time at each yield between slices. */
  let yieldTimes: number[] = [];
  const clock: HostClock = {
    now: () => slowClock.now,
    setTimeout: (callback, ms) => {
      if (ms === 0) yieldTimes.push(slowClock.now);
      return setTimeout(callback, ms);
    },
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };

  afterEach(() => {
    delete (globalThis as { slowClock?: unknown }).slowClock;
  });

  it('runs in slices, sends heartbeats, and is one history step', async () => {
    (globalThis as { slowClock?: unknown }).slowClock = slowClock;
    const { call, messages } = startHost({ clock });
    await call({ type: 'compile', compile: 'c1', source: SLOW });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'SlowCounter', history: 10 });
    yieldTimes = [];
    const start = slowClock.now;
    const res = expectType(await call({ type: 'tick', session: 's1', count: 3000 }), 'updated');
    expect(res.state.cycle).toBe(3000);
    expect(res.state.ports.get('__top__.count')).toBe(3000 & 0xff);
    // One history entry for the whole request, after the initial one.
    expect(res.state.history).toEqual({ length: 2, index: 1 });
    // Slices of about 80% of a 33ms frame.
    // Slices sized to fit about 80% of a 33ms frame, from the first one on.
    const slices = [start, ...yieldTimes].slice(1).map((t, i) => t - [start, ...yieldTimes][i]);
    expect(slices.length).toBeGreaterThan(20);
    expect(Math.max(...slices)).toBeLessThan(40);
    // A heartbeat at most once a second of (fake) time, and at least one.
    const beats = messages.filter((m) => m.type === 'progressed').length;
    const seconds = (slowClock.now - start) / 1000;
    expect(beats).toBeGreaterThan(0);
    expect(beats).toBeLessThanOrEqual(Math.ceil(seconds));
  });
});

describe('auto-run', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes about one frame per 1/30s and runs `speed` cycles per second', async () => {
    vi.useFakeTimers();
    const clock: HostClock = {
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const { call, messages } = startHost({ clock });
    await call({ type: 'compile', compile: 'c1', source: COUNTER });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Counter', history: 100 });
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    const running = call({ type: 'run', session: 's1', speed: 300, frameRate: 30 });
    await vi.advanceTimersByTimeAsync(0);
    expect(expectType(await running, 'updated').state.isRunning).toBe(true);

    const before = messages.length;
    await vi.advanceTimersByTimeAsync(1000);
    const frames = messages.slice(before).filter((m) => m.type === 'updated' && m.id === undefined);
    expect(frames.length).toBeGreaterThanOrEqual(29);
    expect(frames.length).toBeLessThanOrEqual(31);
    const last = frames[frames.length - 1];
    if (last.type !== 'updated') throw new Error('not a frame');
    expect(last.state.cycle).toBeGreaterThanOrEqual(290);
    expect(last.state.cycle).toBeLessThanOrEqual(310);
    // One history entry per frame.
    expect(last.state.history.length).toBe(frames.length + 1);

    const paused = call({ type: 'pause', session: 's1' });
    await vi.advanceTimersByTimeAsync(0);
    expect(expectType(await paused, 'updated').state.isRunning).toBe(false);
    const afterPause = messages.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(messages.length).toBe(afterPause);
  });

  it('runs speeds slower than the frame rate', async () => {
    vi.useFakeTimers();
    const clock: HostClock = {
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const { call } = startHost({ clock });
    await call({ type: 'compile', compile: 'c1', source: COUNTER });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Counter', history: 0 });
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    // Under half a cycle a frame: the debt has to build up over several frames.
    const running = call({ type: 'run', session: 's1', speed: 10, frameRate: 30 });
    await vi.advanceTimersByTimeAsync(2000);
    await running;
    const paused = call({ type: 'pause', session: 's1' });
    await vi.advanceTimersByTimeAsync(0);
    const cycle = expectType(await paused, 'updated').state.cycle;
    expect(cycle).toBeGreaterThanOrEqual(19);
    expect(cycle).toBeLessThanOrEqual(21);
  });

  it('changes speed when run is called while running', async () => {
    vi.useFakeTimers();
    const clock: HostClock = {
      now: () => Date.now(),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const { call } = startHost({ clock });
    await call({ type: 'compile', compile: 'c1', source: COUNTER });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Counter', history: 0 });
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    const first = call({ type: 'run', session: 's1', speed: 30, frameRate: 30 });
    await vi.advanceTimersByTimeAsync(1000);
    await first;
    const faster = call({ type: 'run', session: 's1', speed: 90, frameRate: 30 });
    await vi.advanceTimersByTimeAsync(0);
    const cycleAtChange = expectType(await faster, 'updated').state.cycle;
    await vi.advanceTimersByTimeAsync(1000);
    const paused = call({ type: 'pause', session: 's1' });
    await vi.advanceTimersByTimeAsync(0);
    const ran = expectType(await paused, 'updated').state.cycle - cycleAtChange;
    expect(ran).toBeGreaterThanOrEqual(87);
    expect(ran).toBeLessThanOrEqual(93);
  });
});

describe('peripherals', () => {
  it('reports peripheral-bus state with every update', async () => {
    const { call } = startHost();
    await call({
      type: 'compile',
      compile: 'c1',
      source: `
const Terminal = circuit('Terminal', {
  inputs: { ch: bus(8), we: bit },
  outputs: {},
  nodes: { con: Console },
  connect: ({ inputs, nodes: { con } }) => [inputs.ch.to(con.data), inputs.we.to(con.we)],
})`,
    });
    const opened = expectType(
      await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Terminal', history: 0 }),
      'opened',
    );
    expect(opened.state.peripherals?.get('con')).toBe('');
    await call({ type: 'set', session: 's1', values: { ch: 72, we: 1 } });
    await call({ type: 'tick', session: 's1', count: 1 });
    await call({ type: 'set', session: 's1', values: { ch: 105 } });
    const res = expectType(await call({ type: 'tick', session: 's1', count: 1 }), 'updated');
    expect(res.state.peripherals?.get('con')).toBe('Hi');
  });

  it('leaves peripherals out when the circuit has none', async () => {
    const { opened } = await openCounter();
    expect(opened.state.peripherals).toBeUndefined();
  });
});

/** The latch open with d = 1 and en = 1, so q = 1. */
async function openLatch() {
  const host = startHost();
  await host.call({ type: 'compile', compile: 'c1', source: D_LATCH });
  await host.call({ type: 'open', session: 's1', compile: 'c1', circuit: 'DLatch', history: 0 });
  const res = expectType(
    await host.call({ type: 'set-input', session: 's1', values: { d: 1, en: 1 } }),
    'updated',
  );
  expect(res.state.ports.get('q.in')).toBe(1);
  return host;
}

describe('set', () => {
  it('writes Switch paths before the circuit settles, as set-input did (#521)', async () => {
    const { call } = await openLatch();
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { d: 0, en: 0 } }),
      'updated',
    );
    expect(res.state.ports.get('q.in')).toBe(1);
  });

  it('writes nothing when one key is not an input', async () => {
    const { call } = await openLatch();
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { d: 0, n1: 1 } }),
      'failed',
    );
    expect(res.error).toMatch(/^set\('n1'\): 'n1' is a Nand, not an input/);
    const after = expectType(
      await call({ type: 'set', session: 's1', values: { en: 0 } }),
      'updated',
    );
    expect(after.state.ports.get('q.in')).toBe(1);
  });

  it('writes a port and a Switch in one request', async () => {
    const { call } = startHost();
    await call({
      type: 'compile',
      compile: 'c1',
      source: `
const Gate = circuit('Gate', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { sw: Switch, g: And },
  connect: ({ inputs, outputs, nodes: { sw, g } }) => [inputs.a.to(g.a), sw.out.to(g.b), g.out.to(outputs.y)],
})`,
    });
    await call({ type: 'open', session: 's1', compile: 'c1', circuit: 'Gate', history: 0 });
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { a: 1, sw: 1 } }),
      'updated',
    );
    expect(res.state.ports.get('__top__.y')).toBe(1);
  });

  it("writes a harnessed circuit's inputs by port name", async () => {
    const { call } = await openCounter(10, { harness: true });
    expectType(await call({ type: 'set', session: 's1', values: { en: 1 } }), 'updated');
    const res = expectType(await call({ type: 'tick', session: 's1', count: 2 }), 'updated');
    expect(res.state.ports.get('count.in')).toBe(2);
  });

  it('puts the inputs back at initialInputs on reset', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: D_LATCH });
    await call({
      type: 'open',
      session: 's1',
      compile: 'c1',
      circuit: 'DLatch',
      history: 5,
      initialInputs: { d: 1, en: 1 },
    });
    await call({ type: 'set', session: 's1', values: { d: 0 } });
    const res = expectType(await call({ type: 'reset', session: 's1' }), 'updated');
    expect(res.state.ports.get('d.out')).toBe(1);
    expect(res.state.ports.get('q.in')).toBe(1);
  });
});

describe('set-input (pages deployed before decision 0010)', () => {
  it('writes every path before the circuit settles', async () => {
    const { call } = await openLatch();
    // d and en fall together, so the latch holds the 1 it had.
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { d: 0, en: 0 } }),
      'updated',
    );
    expect(res.state.ports.get('q.in')).toBe(1);
  });

  it('settles after each request, so separate writes are seen in order', async () => {
    // The bug in #521: d falls while en is still 1, the latch follows it, and
    // en then holds the 0.
    const { call } = await openLatch();
    await call({ type: 'set-input', session: 's1', values: { d: 0 } });
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { en: 0 } }),
      'updated',
    );
    expect(res.state.ports.get('q.in')).toBe(0);
  });

  it('writes nothing when one path is not an input', async () => {
    const { call } = await openLatch();
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { d: 0, n1: 1 } }),
      'failed',
    );
    expect(res.error).toMatch(/^setInput\('n1'\): 'n1' is a Nand, not an input/);
    // d is still 1: en = 0 latches a 1, not a 0.
    const after = expectType(
      await call({ type: 'set-input', session: 's1', values: { en: 0 } }),
      'updated',
    );
    expect(after.state.ports.get('q.in')).toBe(1);
  });

  it('fails the single { path, value } form without writing', async () => {
    const { call } = await openLatch();
    // Pages built before #521 sent this. None are live, and the type no longer has it.
    const old = { type: 'set-input', session: 's1', path: 'en', value: 0 };
    expectType(await call(old as unknown as Parameters<typeof call>[0]), 'failed');
    // en is still 1, so d falling still reaches q.
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { d: 0 } }),
      'updated',
    );
    expect(res.state.ports.get('q.in')).toBe(0);
  });

  it('writes a Switch of a harnessed circuit', async () => {
    const { call } = await openCounter(10, { harness: true });
    expectType(await call({ type: 'set-input', session: 's1', values: { en: 1 } }), 'updated');
    const res = expectType(await call({ type: 'tick', session: 's1', count: 2 }), 'updated');
    // The harness's display for `count` reads the counter.
    expect(res.state.ports.get('count.in')).toBe(2);
  });

  it('rejects a register path', async () => {
    const { call } = await openCounter();
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { reg: 7 } }),
      'failed',
    );
    expect(res.error).toBe(
      "setInput('reg'): 'reg' is a Register, not an input. Only Switch and Input nodes can be set; a memory's contents go in the session's memory option.",
    );
  });

  it('rejects a top-level input name, which is not a node path', async () => {
    const { call } = await openCounter();
    const res = expectType(
      await call({ type: 'set-input', session: 's1', values: { en: 1 } }),
      'failed',
    );
    expect(res.error).toBe("setInput('en'): no node has that path.");
  });
});

describe('scan and sample', () => {
  it('scan drives an input through 0..count-1 and reads a port', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ADDER });
    await call({
      type: 'open',
      session: 's1',
      compile: 'c1',
      circuit: 'Add',
      history: 0,
      harness: true,
      initialInputs: { b: 10 },
    });
    const res = expectType(
      await call({ type: 'scan', session: 's1', path: 'a', port: 'dut.sum', count: 4 }),
      'scanned',
    );
    expect(res.values).toEqual([10, 11, 12, 13]);
  });

  it('scan takes a Switch path, as set does', async () => {
    const { call } = await openLatch();
    const res = expectType(
      await call({ type: 'scan', session: 's1', path: 'd', port: 'q.in', count: 2 }),
      'scanned',
    );
    expect(res.values).toEqual([0, 1]);
  });

  it('sample returns a port after every tick, as one history step', async () => {
    const { call } = await openCounter(10);
    await call({ type: 'set', session: 's1', values: { en: 1 } });
    const res = expectType(
      await call({ type: 'sample', session: 's1', port: '__top__.count', count: 5 }),
      'sampled',
    );
    expect(res.samples).toEqual([1, 2, 3, 4, 5]);
    expect(res.state.cycle).toBe(5);
    expect(res.state.history).toEqual({ length: 2, index: 1 });
  });

  it('sample rejects a port that is not there', async () => {
    const { call } = await openCounter();
    const res = expectType(
      await call({ type: 'sample', session: 's1', port: 'count', count: 5 }),
      'failed',
    );
    expect(res.error).toMatch(/^sample: no port 'count'/);
  });
});

describe('memory', () => {
  const ROM_READER = `
const RomReader = circuit('RomReader', {
  inputs: { addr: bus(16) },
  outputs: { out: bus(8) },
  nodes: { rom: ROM() },
  connect: ({ inputs, outputs, nodes: { rom } }) => [inputs.addr.to(rom.addr), rom.data_out.to(outputs.out)],
})
`;

  it('is loaded before cycle 0 and kept by reset', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ROM_READER });
    const opened = expectType(
      await call({
        type: 'open',
        session: 's1',
        compile: 'c1',
        circuit: 'RomReader',
        history: 10,
        memory: { rom: { 0: 0x11, 1: 0x22 } },
      }),
      'opened',
    );
    expect(opened.state.cycle).toBe(0);
    expect(opened.state.ports.get('__top__.out')).toBe(0x11);
    // The first history entry has the memory in it.
    expect(opened.state.history).toEqual({ length: 1, index: 0 });

    await call({ type: 'set', session: 's1', values: { addr: 1 } });
    await call({ type: 'tick', session: 's1', count: 1 });
    const back = expectType(await call({ type: 'seek', session: 's1', index: 0 }), 'updated');
    expect(back.state.ports.get('__top__.out')).toBe(0x11);

    await call({ type: 'reset', session: 's1' });
    const res = expectType(
      await call({ type: 'set', session: 's1', values: { addr: 1 } }),
      'updated',
    );
    expect(res.state.cycle).toBe(0);
    expect(res.state.ports.get('__top__.out')).toBe(0x22);
  });

  it('rejects contents for a path that is not a node', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ROM_READER });
    const res = expectType(
      await call({
        type: 'open',
        session: 's1',
        compile: 'c1',
        circuit: 'RomReader',
        history: 0,
        memory: { nope: { 0: 1 } },
      }),
      'failed',
    );
    expect(res.error).toBe('setNode: "nope" is not a node path.');
  });
});

describe('export', () => {
  it('exports with the compile’s own behavior', async () => {
    const { call } = startHost();
    await call({ type: 'compile', compile: 'c1', source: ADDER });
    const res = expectType(
      await call({ type: 'export', compile: 'c1', circuit: 'Add' }),
      'exported',
    );
    expect(res.result.unsupported ?? {}).toEqual({});
    expect(res.result.verilog).toMatch(/module Add/);
  });

  // #502: the editor exported on the page with std's behavior only, so a
  // user primitive (the 6502 example's AddressDecode) came out unsupported in
  // the browser but not headless. In the sandbox a compile exports with its
  // own library, the same as `exportVerilog(top)` headless: here, cleanly.
  it.each([
    ['6502-computer', 'Computer6502'],
    ['rv32i-computer', 'RV32I_Computer'],
  ])('exports the %s example as headless does, with nothing unsupported', async (id, top) => {
    const example = EXAMPLES.find((e) => e.id === id);
    if (!example) throw new Error(`no example ${id}`);
    const { call } = startHost();
    expectType(await call({ type: 'compile', compile: 'c1', source: example.code }), 'compiled');
    const res = expectType(await call({ type: 'export', compile: 'c1', circuit: top }), 'exported');

    const headless = executeCircuitCode(example.code);
    const circuit = headless.circuits.find((c) => c.name === top);
    if (!circuit) throw new Error(`no circuit ${top}`);
    const expected = exportVerilog(circuit);
    expect(res.result.unsupported ?? {}).toEqual({});
    expect(expected.unsupported ?? {}).toEqual({});
    expect(res.result.verilog).toBe(expected.verilog);
  });
});
