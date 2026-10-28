/**
 * Browser benchmark: production builds of the web app, the game and the
 * sandbox, served locally and timed in headless Chromium.
 *
 *   pnpm bench:browser                 build, then compare against browser-baseline.json
 *   pnpm bench:browser --no-build      reuse the last build
 *   pnpm bench:browser --update        overwrite the baseline with this run
 *   pnpm bench:browser --sandbox-only  only the entries that drive the sandbox directly
 *
 * The web and game builds point at the local sandbox (VITE_SANDBOX_ORIGIN), so
 * a sandbox change is measured before it's deployed. Ports 4300-4303 stay clear
 * of the dev servers. Needs the root .env, like the web build, except with
 * --sandbox-only.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from '@playwright/test';
// The root package doesn't depend on core; the catalog is data only, so import it by path.
import { EXAMPLES } from '../packages/core/src/examples/catalog.ts';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(import.meta.dirname, 'browser-baseline.json');
const RUNS = 5;
const SANDBOX = 'http://localhost:4300';
const WEB = 'http://localhost:4301';
const GAME = 'http://localhost:4302';
/** A bare page that talks to the sandbox directly, as `@simten/sandbox` does. */
const PARENT = 'http://localhost:4303';

const args = new Set(process.argv.slice(2));
const sandboxOnly = args.has('--sandbox-only');
// The web preview needs the same Cloudflare credentials as the web build.
const dotenv = sandboxOnly
  ? {}
  : Object.fromEntries(
      readFileSync(join(ROOT, '.env'), 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/))
        .filter((m) => m !== null)
        .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
    );
const env = { ...dotenv, ...process.env, VITE_SANDBOX_ORIGIN: SANDBOX };
const APPS = sandboxOnly ? ['sandbox'] : ['sandbox', 'game', 'web'];

function build() {
  for (const app of APPS) {
    console.log(`building ${app}…`);
    execSync('pnpm build', { cwd: join(ROOT, 'apps', app), env, stdio: 'ignore' });
  }
}

function serve(app: string, port: number): ChildProcess {
  return spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: join(ROOT, 'apps', app),
    env,
    stdio: 'ignore',
    detached: true,
  });
}

async function waitFor(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} didn't start`);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Opens `url` in a fresh context (cold cache) and runs `fn` on the page. */
async function fresh<T>(browser: Browser, url: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(url);
    return await fn(page);
  } finally {
    await context.close();
  }
}

// The cycle number in the editor's clock controls.
const CYCLE = `Array.from(document.querySelectorAll('span.font-mono')).find((s) => s.parentElement?.textContent?.startsWith('Cycle'))`;

/**
 * Runs `fn` in the page until it returns something truthy, and returns that.
 * Polls from Node with a function rather than `waitForFunction('<string>')`,
 * which compiles the string in the page and so is blocked by the site's CSP
 * (no 'unsafe-eval'). Playwright sends a function over the DevTools protocol.
 */
async function poll<T>(page: Page, fn: () => T, timeout = 30_000): Promise<T> {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await page.evaluate(fn);
    if (value) return value;
    if (Date.now() > end) throw new Error(`still waiting after ${timeout} ms`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function readyEditor(page: Page): Promise<number> {
  // The function runs in the page, so it finds the cycle counter itself
  // rather than using CYCLE.
  return poll(page, () => {
    const cycle = Array.from(document.querySelectorAll('span.font-mono')).find((s) =>
      s.parentElement?.textContent?.startsWith('Cycle'),
    );
    return document.querySelector('.react-flow__node') && cycle ? performance.now() : 0;
  });
}

async function stepMs(page: Page): Promise<number> {
  await readyEditor(page);
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    times.push(
      await page.evaluate(`(async () => {
        const el = ${CYCLE};
        const before = el.textContent;
        const t = performance.now();
        document.querySelector('button[aria-label="Tick"]').click();
        await new Promise((resolve) => {
          const mo = new MutationObserver(() => {
            if (el.textContent !== before) { mo.disconnect(); resolve(); }
          });
          mo.observe(el, { characterData: true, childList: true, subtree: true });
        });
        await new Promise((r) => requestAnimationFrame(r));
        return performance.now() - t;
      })()`),
    );
  }
  return median(times);
}

/** Auto-run at full speed: ticks per second, and the page's frame rate meanwhile. */
async function autoRun(page: Page): Promise<{ ticks: number; fps: number }> {
  await readyEditor(page);
  const speed = page.locator('input[aria-label="Simulation speed"]');
  await speed.focus();
  await speed.press('End');
  await page.locator('button[aria-label="Run"]').click();
  await page.waitForTimeout(1000);
  return page.evaluate(`(async () => {
    const cycle = () => Number(${CYCLE}.textContent);
    const c0 = cycle();
    const t0 = performance.now();
    let frames = 0;
    await new Promise((resolve) => {
      const frame = () => {
        frames++;
        if (performance.now() - t0 < 3000) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const secs = (performance.now() - t0) / 1000;
    return { ticks: Math.round((cycle() - c0) / secs), fps: Math.round(frames / secs) };
  })()`);
}

async function levelLoadMs(page: Page): Promise<number> {
  return poll(page, () =>
    ['editor', 'canvas'].every((t) =>
      document.querySelector(`[data-tour="${t}"]`)?.classList.contains('opacity-100'),
    )
      ? performance.now()
      : 0,
  );
}

const EDITOR_6502 = `${WEB}/circuit?example=6502-computer`;
const EDITOR_RV32I = `${WEB}/circuit?example=rv32i-computer`;

// The sandbox transport with nothing on top: requests by id, and every
// message the sandbox pushes unasked kept in `window.pushed`.
const PARENT_HTML = `<!doctype html><meta charset="utf-8"><body><script>
const SANDBOX = ${JSON.stringify(SANDBOX)};
const iframe = document.createElement('iframe');
iframe.src = SANDBOX;
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
document.body.appendChild(iframe);
let n = 0;
const pending = new Map();
window.pushed = [];
window.ready = new Promise((resolve) => {
  window.addEventListener('message', (e) => {
    if (e.origin !== SANDBOX) return;
    if (e.data.type === 'ready') return resolve();
    if (e.data.id === undefined) return window.pushed.push(e.data);
    const done = pending.get(e.data.id);
    if (done) { pending.delete(e.data.id); done(e.data); }
  });
});
window.send = (req) => new Promise((resolve) => {
  const id = 'b' + ++n;
  pending.set(id, resolve);
  iframe.contentWindow.postMessage({ ...req, id }, SANDBOX);
});
</script>`;

const RV32I_SOURCE = EXAMPLES.find((e) => e.id === 'rv32i-computer')?.code ?? '';

/**
 * The RV32I example at the engine's limit, two ways:
 *
 * - the worker's auto-run loop (session messages): asks for far more cycles
 *   a second than the engine can run, so each frame runs as many as fit in
 *   80% of it, and counts what the pushed frames report;
 * - the page-driven loop the editor uses today (slot messages): `tick-n`
 *   back to back, each sized to take about as long as a frame.
 *
 * Also logs the size of one auto-run frame, to see whether sending only the
 * ports that changed would be worth it.
 */
async function rv32iMax(page: Page): Promise<Record<string, number>> {
  await page.evaluate('window.ready');
  const result = (await page.evaluate(`(async () => {
    const source = ${JSON.stringify(RV32I_SOURCE)};
    const compiled = await window.send({ type: 'compile', compile: 'rv', source });
    if (compiled.type !== 'compiled') throw new Error(compiled.error);
    await window.send({ type: 'open', session: 'rv', compile: 'rv', circuit: 'RV32I_Computer', history: 200 });
    await window.send({ type: 'run', session: 'rv', speed: 1e9, frameRate: 30 });
    await new Promise((r) => setTimeout(r, 1000));
    window.pushed.length = 0;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 3000));
    const secs = (performance.now() - t0) / 1000;
    const frames = window.pushed.filter((m) => m.type === 'updated' && m.session === 'rv');
    await window.send({ type: 'pause', session: 'rv' });
    const first = frames[0].state;
    const last = frames[frames.length - 1].state;
    const one = JSON.stringify([...last.ports, ...(last.peripherals ?? new Map())]);

    // The old way: one round trip per batch.
    await window.send({ type: 'compile', source, slot: 'rv' });
    let n = 100;
    let cycles = 0;
    const t1 = performance.now();
    while (performance.now() - t1 < 3000) {
      const start = performance.now();
      await window.send({ type: 'tick-n', n, slot: 'rv' });
      const ms = performance.now() - start;
      cycles += n;
      n = Math.max(1, Math.round((n * 26) / Math.max(1, ms)));
    }
    const slotSecs = (performance.now() - t1) / 1000;
    return {
      ticks: Math.round((last.cycle - first.cycle) / secs),
      fps: Math.round(frames.length / secs),
      pageDriven: Math.round(cycles / slotSecs),
      ports: last.ports.size,
      kb: Math.round(one.length / 102.4) / 10,
    };
  })()`)) as { ticks: number; fps: number; pageDriven: number; ports: number; kb: number };
  console.log(`  one rv32i frame: ${result.ports} ports, about ${result.kb} KB as JSON`);
  return {
    'auto-run (rv32i), max ticks/s': result.ticks,
    'auto-run (rv32i), max frames/s': result.fps,
    'page-driven (rv32i), max ticks/s': result.pageDriven,
  };
}

// Each scenario loads a page and returns one or more named measurements.
// Auto-run is capped by the speed slider (10k ticks/s), so its frame rate is
// the more sensitive number.
const SCENARIOS: { url: string; run: (p: Page) => Promise<Record<string, number>> }[] = [
  { url: PARENT, run: rv32iMax },
  { url: `${GAME}/nand`, run: async (p) => ({ 'level load (nand), ms': await levelLoadMs(p) }) },
  { url: EDITOR_6502, run: async (p) => ({ 'editor load (6502), ms': await readyEditor(p) }) },
  { url: EDITOR_6502, run: async (p) => ({ 'step (6502), ms': await stepMs(p) }) },
  {
    url: EDITOR_6502,
    run: async (p) => {
      const r = await autoRun(p);
      return { 'auto-run (6502), ticks/s': r.ticks, 'auto-run (6502), fps': r.fps };
    },
  },
  {
    url: EDITOR_RV32I,
    run: async (p) => {
      const r = await autoRun(p);
      return { 'auto-run (rv32i), ticks/s': r.ticks, 'auto-run (rv32i), fps': r.fps };
    },
  },
];

interface Baseline {
  machine: string;
  results: Record<string, number>;
}

function readBaseline(): Baseline | undefined {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  } catch {
    return undefined;
  }
}

if (!args.has('--no-build')) build();
const servers = sandboxOnly
  ? [serve('sandbox', 4300)]
  : [serve('sandbox', 4300), serve('web', 4301), serve('game', 4302)];
const parentServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(PARENT_HTML);
}).listen(4303);
const stop = () => {
  parentServer.close();
  for (const s of servers) {
    try {
      if (s.pid) process.kill(-s.pid);
    } catch {}
  }
};
process.on('exit', stop);

try {
  await Promise.all(
    sandboxOnly ? [waitFor(SANDBOX)] : [waitFor(SANDBOX), waitFor(WEB), waitFor(GAME)],
  );
  const browser = await chromium.launch();
  const baseline = readBaseline();
  const results: Record<string, number> = {};
  for (const s of sandboxOnly ? SCENARIOS.filter((x) => x.url === PARENT) : SCENARIOS) {
    const runs: Record<string, number>[] = [];
    for (let i = 0; i < RUNS; i++) runs.push(await fresh(browser, s.url, s.run));
    for (const name of Object.keys(runs[0])) {
      const value = Math.round(median(runs.map((r) => r[name])) * 10) / 10;
      results[name] = value;
      const before = baseline?.results[name];
      const diff = before
        ? ` (${value >= before ? '+' : ''}${(((value - before) / before) * 100).toFixed(1)}%)`
        : '';
      console.log(`${name.padEnd(28)} ${String(value).padStart(8)}${diff}`);
    }
  }
  await browser.close();
  if (baseline) console.log(`\nbaseline: ${baseline.machine}`);
  if (args.has('--update')) {
    writeFileSync(
      BASELINE,
      // A partial run keeps the baseline's other entries.
      `${JSON.stringify({ machine: cpus()[0]?.model ?? 'unknown', results: sandboxOnly ? { ...baseline?.results, ...results } : results }, null, 2)}\n`,
    );
    console.log('wrote browser-baseline.json');
  }
} finally {
  stop();
}
