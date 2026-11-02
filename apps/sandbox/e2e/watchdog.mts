/**
 * A behavior function that never returns must not freeze the page or the
 * sandbox, and a long request that keeps working must not be taken for one.
 * Builds the sandbox, serves it on :4310 and a bare parent page on :4311,
 * then drives it in headless Chromium with the messages `@simten/sandbox`'s
 * clients send.
 *
 *   pnpm --filter @simten/sandbox-app test:e2e
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { EXAMPLES } from '@simten/core/examples';

const APP = join(import.meta.dirname, '..');
const SANDBOX = 'http://localhost:4310';
const PARENT_PORT = 4311;

// The same iframe and origin checks as `iframeTransport` in `@simten/sandbox`.
const PARENT_HTML = `<!doctype html><meta charset="utf-8"><body><script>
const SANDBOX = ${JSON.stringify(SANDBOX)};
const iframe = document.createElement('iframe');
iframe.src = SANDBOX;
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
document.body.appendChild(iframe);
let n = 0;
const pending = new Map();
// Messages the sandbox sends unasked: auto-run frames and restart notices.
window.pushed = [];
// Session states carry Maps, which don't survive the trip back to the test.
const plain = (d) => d.state ? { ...d, state: { ...d.state, ports: Object.fromEntries(d.state.ports), peripherals: undefined } } : d;
window.ready = new Promise((resolve) => {
  window.addEventListener('message', (e) => {
    if (e.origin !== SANDBOX) return;
    if (e.data.type === 'ready') return resolve();
    const data = plain(e.data);
    if (data.id === undefined) return window.pushed.push(data);
    const done = pending.get(data.id);
    if (done) { pending.delete(data.id); done(data); }
  });
});
window.send = (req) => new Promise((resolve) => {
  const id = 't' + ++n;
  pending.set(id, resolve);
  iframe.contentWindow.postMessage({ ...req, id }, SANDBOX);
});
</script>`;

const FIBONACCI = `
const Fibonacci = circuit('Fibonacci', {
  outputs: { fib: bus(8) },
  nodes: { reg_a: Register(), reg_b: Register(), adder: Adder(), one_bit: Constant({ value: 1 }), init: DFlipFlop() },
  connect: ({ outputs, nodes: { reg_a, reg_b, adder, one_bit, init } }) => [
    one_bit.out.to(init.d, reg_a.we, reg_b.we),
    init.q_bar.to(adder.carry_in),
    reg_a.q.to(adder.a),
    reg_b.q.to(adder.b, reg_a.data, outputs.fib),
    adder.sum.to(reg_b.data),
  ],
})
`;

// A user circuit that shares a stdlib name. It must not change the stdlib Adder.
const FAKE_ADDER = `
const Adder = circuit('Adder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), carry_out: bit },
  eval: () => ({ sum: 99, carry_out: 0 }),
})
`;

// The fake Adder in a design of its own: it runs as itself there.
const FAKE_ADDER_TOP = `
const MyAdder = circuit('Adder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), carry_out: bit },
  eval: () => ({ sum: 99, carry_out: 0 }),
})
const Top = circuit('FakeTop', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { sum: bus(8) },
  nodes: { u: MyAdder },
  connect: ({ inputs, outputs, nodes: { u } }) => [inputs.a.to(u.a), inputs.b.to(u.b), u.sum.to(outputs.sum)],
})
`;

// The fake Adder and the std one in one design: two circuits, one name.
const BOTH_ADDERS = `
const MyAdder = circuit('Adder', {
  inputs: { a: bus(8), b: bus(8), carry_in: bit },
  outputs: { sum: bus(8), carry_out: bit },
  eval: () => ({ sum: 99, carry_out: 0 }),
})
const Top = circuit('BothTop', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { mine: bus(8), std: bus(8) },
  nodes: { mine: MyAdder, std: Adder({ width: 8 }) },
  connect: ({ inputs, outputs, nodes: { mine, std } }) => [
    inputs.a.to(mine.a, std.a), inputs.b.to(mine.b, std.b),
    mine.sum.to(outputs.mine), std.sum.to(outputs.std),
  ],
})
`;

const STUCK = `
const Stuck = circuit('Stuck', {
  inputs: { a: bit },
  outputs: { y: bit },
  eval: () => { while (true) {} },
})
`;

type Response = {
  type: string;
  error?: string;
  code?: string;
  session?: string;
  sessions?: string[];
  dropped?: string[];
  state?: { cycle: number; isRunning: boolean; ports: Record<string, number> };
  result?: { verilog: string; unsupported?: Record<string, string[]> };
};

// Counts up once a cycle, and hangs in its eval once the count reaches 50:
// fine at cycle 0, so it reopens after a restart.
const HANGS_AT_50 = `
const HangAt = circuit('HangAt', {
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => { if (a >= 50) { while (true) {} } return { y: (a + 1) & 0xff }; },
})
const Runner = circuit('Runner', {
  outputs: { count: bus(8) },
  nodes: { reg: Register(), inc: HangAt, on: Constant({ value: 1 }) },
  connect: ({ outputs, nodes: { reg, inc, on } }) => [
    on.out.to(reg.we),
    reg.q.to(inc.a, outputs.count),
    inc.y.to(reg.data),
  ],
})
`;

// Every evaluation spins for 0.1ms, so a cycle costs a known, slow amount.
const SLOW = `
const Slow = circuit('Slow', {
  inputs: { a: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a }) => { const end = performance.now() + 0.1; while (performance.now() < end) {} return { y: (a + 1) & 0xff }; },
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

const show = (r: Response) =>
  r.error ?? `${r.type}, cycle ${r.state?.cycle} ${JSON.stringify(r.state?.ports ?? {})}`;

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures++;
}

async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${url} didn't start`);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: APP, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

if (!process.argv.includes('--no-build')) await run('pnpm', ['exec', 'vite', 'build']);

const preview: ChildProcess = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--port', '4310', '--strictPort'],
  { cwd: APP, stdio: 'ignore', detached: true },
);
const parentServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(PARENT_HTML);
}).listen(PARENT_PORT);
const browser = await chromium.launch();

try {
  await waitFor(SANDBOX);
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.goto(`http://localhost:${PARENT_PORT}`);
  await page.evaluate('window.ready');

  const send = (req: object) =>
    page.evaluate(
      (r) => (window as unknown as { send(r: object): Promise<Response> }).send(r),
      req,
    );

  const pushed = () =>
    page.evaluate(() => (window as unknown as { pushed: Response[] }).pushed.splice(0));

  check(
    'compile fibonacci',
    (await send({ type: 'compile', compile: 'fib', source: FIBONACCI })).type === 'compiled',
  );
  await send({ type: 'open', session: 'fib-1', compile: 'fib', circuit: 'Fibonacci', history: 10 });
  const before = await send({ type: 'tick', session: 'fib-1', count: 3 });
  check('ticks before the hang', before.state?.cycle === 3, show(before));

  // Compiling builds the circuit without running its eval; opening a session
  // settles it, which is where it hangs. Open it while a timer on the page
  // measures how late it fires. If the hang reached the page, this evaluate
  // would never return.
  check(
    'compile the stuck circuit',
    (await send({ type: 'compile', compile: 'stuck', source: STUCK })).type === 'compiled',
  );
  const hung = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('page froze: no answer after 20s')), 20000),
  );
  const stuck = await Promise.race([
    hung,
    page.evaluate(async () => {
      const w = window as unknown as { send(r: object): Promise<Response> };
      let worstLag = 0;
      let last = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        worstLag = Math.max(worstLag, now - last - 50);
        last = now;
      }, 50);
      const start = performance.now();
      const pending = w.send({
        type: 'open',
        session: 'stuck-1',
        compile: 'stuck',
        circuit: 'Stuck',
        history: 0,
      });
      // Queued behind the stuck request in the same worker.
      const collateral = w.send({ type: 'tick', session: 'fib-1', count: 1 });
      const [result, other] = await Promise.all([pending, collateral]);
      const elapsed = performance.now() - start;
      clearInterval(timer);
      return { result, other, elapsed, worstLag };
    }),
  ]);
  check(
    'opening it times out',
    stuck.result.type === 'failed' && stuck.result.code === 'timed-out',
    show(stuck.result),
  );
  check(
    'timeout fires near 5s',
    stuck.elapsed > 4500 && stuck.elapsed < 8000,
    `${Math.round(stuck.elapsed)}ms`,
  );
  check(
    'page timers stay on time',
    stuck.worstLag < 250,
    `worst lag ${Math.round(stuck.worstLag)}ms`,
  );
  check(
    'queued request is failed as restarted',
    stuck.other.type === 'failed' && stuck.other.code === 'restarted',
    show(stuck.other),
  );

  // Requests sent during the restart wait for the replay, so this one sees
  // fib-1 reopened at cycle 0.
  const after = await send({ type: 'tick', session: 'fib-1', count: 1 });
  check('the open session restarts at cycle 0', after.state?.cycle === 1, show(after));
  const restartedFirst = (await pushed()).find((m) => m.type === 'restarted');
  check(
    'the page hears restarted',
    restartedFirst?.sessions?.includes('fib-1') === true,
    JSON.stringify(restartedFirst),
  );
  const stuckTick = await send({ type: 'tick', session: 'stuck-1', count: 1 });
  check('the stuck session was not kept', stuckTick.type === 'failed', show(stuckTick));

  // User code can't change stdlib behavior for any session.
  await send({ type: 'open', session: 'fib-2', compile: 'fib', circuit: 'Fibonacci', history: 0 });
  await send({ type: 'tick', session: 'fib-2', count: 5 });
  check(
    'compile fake Adder',
    (await send({ type: 'compile', compile: 'fake', source: FAKE_ADDER })).type === 'compiled',
  );
  const fibAfter = await send({ type: 'tick', session: 'fib-2', count: 5 });
  check(
    'an open session keeps the std Adder',
    fibAfter.state?.ports['__top__.fib'] === 55,
    show(fibAfter),
  );
  await send({ type: 'compile', compile: 'fib-new', source: FIBONACCI });
  await send({
    type: 'open',
    session: 'fib-3',
    compile: 'fib-new',
    circuit: 'Fibonacci',
    history: 0,
  });
  const fibFresh = await send({ type: 'tick', session: 'fib-3', count: 5 });
  check(
    'a new compile gets the std Adder',
    fibFresh.state?.ports['__top__.fib'] === 5,
    show(fibFresh),
  );
  await send({ type: 'compile', compile: 'fake-top', source: FAKE_ADDER_TOP });
  await send({
    type: 'open',
    session: 'fake-1',
    compile: 'fake-top',
    circuit: 'FakeTop',
    history: 0,
  });
  const fakeSum = await send({ type: 'set', session: 'fake-1', values: { a: 2, b: 3 } });
  check(
    'a design using only its own Adder runs it',
    fakeSum.state?.ports['__top__.sum'] === 99,
    show(fakeSum),
  );
  const both = await send({ type: 'compile', compile: 'both', source: BOTH_ADDERS });
  check(
    'two Adders in one design is a compile error',
    both.type === 'failed' && /Two different circuits are named 'Adder'/.test(both.error ?? ''),
    show(both),
  );
  const fibStill = await send({ type: 'tick', session: 'fib-3', count: 5 });
  check(
    'other sessions keep the std Adder',
    fibStill.state?.ports['__top__.fib'] === 55,
    show(fibStill),
  );

  // ── Long ticks, hanging runs and hanging ticks ────────────────────────────

  await pushed();

  // A 20s tick, sliced, with heartbeats: the watchdog must leave it alone,
  // and another session must still get answers meanwhile.
  check(
    'compile slow counter',
    (await send({ type: 'compile', compile: 'slow', source: SLOW })).type === 'compiled',
  );
  await send({
    type: 'open',
    session: 'slow-1',
    compile: 'slow',
    circuit: 'SlowCounter',
    history: 10,
  });
  // The old set-input is gone: it fails, and the worker keeps answering.
  const oldSetInput = await send({ type: 'set-input', session: 'fib-1', values: { reg_a: 1 } });
  check('set-input now fails', oldSetInput.type === 'failed', show(oldSetInput));
  // The exporter is a chunk of its own, fetched on the first export: it must
  // load under the sandbox's CSP.
  const exported = await send({ type: 'export', compile: 'fib', circuit: 'Fibonacci' });
  check(
    'export loads the exporter and returns Verilog',
    exported.type === 'exported' && /module Fibonacci/.test(exported.result?.verilog ?? ''),
    exported.error ?? exported.type,
  );
  // #502: std's 6502 parts export by translating their eval's source, so the
  // production worker must keep that source readable (apps/sandbox/vite.config.ts).
  const example6502 = EXAMPLES.find((e) => e.id === '6502-computer')?.code ?? '';
  await send({ type: 'compile', compile: 'c6502', source: example6502 });
  const export6502 = await send({ type: 'export', compile: 'c6502', circuit: 'Computer6502' });
  check(
    'the 6502 example exports with nothing unsupported (#502)',
    export6502.type === 'exported' &&
      Object.keys(export6502.result?.unsupported ?? {}).length === 0 &&
      /module Computer6502/.test(export6502.result?.verilog ?? ''),
    export6502.error ?? JSON.stringify(export6502.result?.unsupported ?? {}),
  );
  await send({ type: 'release', compile: 'c6502' });
  const probeStart = Date.now();
  await send({ type: 'tick', session: 'slow-1', count: 2000 });
  const msPerCycle = (Date.now() - probeStart) / 2000;
  const count = Math.round(20_000 / msPerCycle);
  const long = await page.evaluate(
    async ({ count }) => {
      const w = window as unknown as { send(r: object): Promise<Response> };
      const start = performance.now();
      const tick = w.send({ type: 'tick', session: 'slow-1', count });
      // Another session's request while the long tick runs.
      await new Promise((r) => setTimeout(r, 2000));
      const asked = performance.now();
      const other = await w.send({ type: 'tick', session: 'fib-1', count: 1 });
      const otherMs = performance.now() - asked;
      const result = await tick;
      return { result, other, otherMs, elapsed: performance.now() - start };
    },
    { count },
  );
  check(
    'a 20s sliced tick finishes',
    long.result.type === 'updated' && long.result.state?.cycle === 2000 + count,
    `${long.result.type} ${long.result.error ?? ''} cycle ${long.result.state?.cycle}`,
  );
  check('and really ran for a long time', long.elapsed > 15_000, `${Math.round(long.elapsed)}ms`);
  check(
    'another session answers during it',
    long.other.type === 'updated' && long.otherMs < 200,
    `${long.other.type} after ${Math.round(long.otherMs)}ms`,
  );
  const quiet = await pushed();
  check(
    'the watchdog stayed quiet',
    !quiet.some((m) => m.type === 'restarted'),
    quiet.map((m) => m.type).join(', '),
  );

  // A run that hangs mid-way: nothing is in flight, the frames stop, and
  // after 5s of silence the worker is restarted and the session reopened.
  check(
    'compile a circuit that hangs at 50',
    (await send({ type: 'compile', compile: 'hang', source: HANGS_AT_50 })).type === 'compiled',
  );
  await send({ type: 'open', session: 'run-1', compile: 'hang', circuit: 'Runner', history: 10 });
  const started = await send({ type: 'run', session: 'run-1', speed: 100, frameRate: 30 });
  check('run starts', started.state?.isRunning === true, show(started));
  let restarted: Response | undefined;
  let frames: Response[] = [];
  for (let i = 0; i < 40 && !restarted; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const got = await pushed();
    frames = frames.concat(got.filter((m) => m.type === 'updated'));
    restarted = got.find((m) => m.type === 'restarted');
  }
  check(
    'the hanging run is restarted',
    restarted !== undefined &&
      ['slow-1', 'fib-1', 'run-1'].every((s) => restarted?.sessions?.includes(s)) &&
      restarted.dropped?.length === 0,
    JSON.stringify(restarted),
  );
  const reopened = frames.filter((m) => m.session === 'run-1').at(-1);
  check(
    'and its session is back at cycle 0, paused',
    reopened?.state?.cycle === 0 && reopened.state.isRunning === false,
    JSON.stringify(reopened?.state && { ...reopened.state, ports: undefined }),
  );
  const after5 = await send({ type: 'tick', session: 'run-1', count: 5 });
  check('it ticks again', after5.state?.cycle === 5, show(after5));
  const fibAgain = await send({ type: 'tick', session: 'fib-1', count: 5 });
  check(
    'other sessions were replayed too',
    fibAgain.state?.ports['__top__.fib'] === 5,
    `fib ${fibAgain.state?.ports['__top__.fib']}`,
  );

  // A tick that hangs: it fails as timed out, the request queued behind it as
  // restarted, and the page hears `restarted`.
  const hungTick = await page.evaluate(async () => {
    const w = window as unknown as { send(r: object): Promise<Response> };
    const hung = w.send({ type: 'tick', session: 'run-1', count: 100 });
    const queued = w.send({ type: 'tick', session: 'fib-1', count: 1 });
    return Promise.all([hung, queued]);
  });
  check(
    'a hanging tick times out',
    hungTick[0].type === 'failed' && hungTick[0].code === 'timed-out',
    show(hungTick[0]),
  );
  check(
    'the request behind it is failed as restarted',
    hungTick[1].type === 'failed' && hungTick[1].code === 'restarted',
    show(hungTick[1]),
  );
  let restartedAgain: Response | undefined;
  for (let i = 0; i < 40 && !restartedAgain; i++) {
    await new Promise((r) => setTimeout(r, 250));
    restartedAgain = (await pushed()).find((m) => m.type === 'restarted');
  }
  check('the page hears restarted', restartedAgain !== undefined, JSON.stringify(restartedAgain));

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  parentServer.close();
  if (preview.pid) process.kill(-preview.pid);
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
