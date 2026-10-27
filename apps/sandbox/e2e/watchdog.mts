/**
 * A behavior function that never returns must not freeze the page or the
 * sandbox. Builds the sandbox, serves it on :4310 and a bare parent page on
 * :4311, then drives it in headless Chromium.
 *
 *   pnpm --filter @simten/sandbox-app test:e2e
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP = join(import.meta.dirname, '..');
const SANDBOX = 'http://localhost:4310';
const PARENT_PORT = 4311;

// Same transport as useSandbox, minus React.
const PARENT_HTML = `<!doctype html><meta charset="utf-8"><body><script>
const SANDBOX = ${JSON.stringify(SANDBOX)};
const iframe = document.createElement('iframe');
iframe.src = SANDBOX;
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
document.body.appendChild(iframe);
let n = 0;
const pending = new Map();
window.ready = new Promise((resolve) => {
  window.addEventListener('message', (e) => {
    if (e.origin !== SANDBOX) return;
    if (e.data.type === 'ready') return resolve();
    const done = pending.get(e.data.id);
    if (done) { pending.delete(e.data.id); done(e.data); }
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
  cycle?: number;
  snapshotId?: number;
  portValues?: Record<string, number>;
  signals?: Record<string, unknown>;
};

const show = (r: Response) =>
  r.error ?? `${r.type}, cycle ${r.cycle}${r.portValues ? ` ${JSON.stringify(r.portValues)}` : ''}`;

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

  // A working slot, ticked a few times and snapshotted.
  check(
    'compile fibonacci',
    (await send({ type: 'compile', source: FIBONACCI, slot: 'fib' })).type === 'compiled',
  );
  await send({ type: 'tick', slot: 'fib' });
  await send({ type: 'tick', slot: 'fib' });
  const snap = await send({ type: 'tick', slot: 'fib', snapshot: true });
  check('ticks before the hang', snap.cycle === 3, `cycle ${snap.cycle}`);

  // Compile the stuck circuit while a timer on the page measures how late it
  // fires. If the hang reached the page, this evaluate would never return.
  const hung = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('page froze: no answer after 20s')), 20000),
  );
  const stuck = await Promise.race([
    hung,
    page.evaluate(async (source) => {
      const w = window as unknown as { send(r: object): Promise<Response> };
      let worstLag = 0;
      let last = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        worstLag = Math.max(worstLag, now - last - 50);
        last = now;
      }, 50);
      const start = performance.now();
      const pending = w.send({ type: 'compile', source, slot: 'stuck' });
      // Queued behind the stuck request in the same worker.
      const collateral = w.send({ type: 'tick', slot: 'fib' });
      const [result, other] = await Promise.all([pending, collateral]);
      const elapsed = performance.now() - start;
      clearInterval(timer);
      return { result, other, elapsed, worstLag };
    }, STUCK),
  ]);
  check(
    'stuck compile times out',
    stuck.result.type === 'error' && /timed out/.test(stuck.result.error ?? ''),
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
  check('queued request is failed', stuck.other.error === 'Worker restarted', show(stuck.other));

  // The working slot was recompiled at cycle 0; its old snapshot is gone.
  const after = await send({ type: 'tick', slot: 'fib' });
  check(
    'existing slot restarts at cycle 0',
    after.type === 'ticked' && after.cycle === 1,
    show(after),
  );
  const restore = await send({ type: 'restore', slot: 'fib', snapshotId: snap.snapshotId });
  check('old snapshot ids are invalid', restore.type === 'error', show(restore));
  check('stuck slot was not kept', (await send({ type: 'tick', slot: 'stuck' })).type === 'error');

  // A fresh circuit compiles and ticks normally.
  check(
    'compile after restart',
    (await send({ type: 'compile', source: FIBONACCI, slot: 'again' })).type === 'compiled',
  );
  const ticked = await send({ type: 'tick-n', n: 5, slot: 'again' });
  check('tick after restart', ticked.type === 'ticked-n' && ticked.cycle === 5, show(ticked));

  // User code can't change stdlib behavior for any slot.
  check(
    'compile fake Adder',
    (await send({ type: 'compile', source: FAKE_ADDER, slot: 'fake' })).type === 'compiled',
  );
  const fibAfter = await send({ type: 'tick-n', n: 5, slot: 'again' });
  check(
    'running slot keeps the std Adder',
    fibAfter.portValues?.['__top__.fib'] === 55,
    show(fibAfter),
  );
  await send({ type: 'compile', source: FIBONACCI, slot: 'again' });
  const fibFresh = await send({ type: 'tick-n', n: 5, slot: 'again' });
  check('new slot gets the std Adder', fibFresh.portValues?.['__top__.fib'] === 5, show(fibFresh));
  await send({ type: 'compile', source: FAKE_ADDER_TOP, slot: 'fake' });
  const fakeSum = await send({ type: 'tick', slot: 'fake', inputs: { a: 2, b: 3 } });
  check(
    'a design using only its own Adder runs it',
    fakeSum.portValues?.['__top__.sum'] === 99,
    show(fakeSum),
  );
  const both = await send({ type: 'compile', source: BOTH_ADDERS, slot: 'both' });
  check(
    'two Adders in one design is a compile error',
    both.type === 'error' && /Two different circuits are named 'Adder'/.test(both.error ?? ''),
    show(both),
  );
  const fibStill = await send({ type: 'tick-n', n: 5, slot: 'again' });
  check(
    'other slots keep the std Adder',
    fibStill.portValues?.['__top__.fib'] === 55,
    show(fibStill),
  );

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
