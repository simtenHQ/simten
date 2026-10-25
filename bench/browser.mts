/**
 * Browser benchmark: production builds of the web app, the game and the
 * sandbox, served locally and timed in headless Chromium.
 *
 *   pnpm bench:browser             build, then compare against browser-baseline.json
 *   pnpm bench:browser --no-build  reuse the last build
 *   pnpm bench:browser --update    overwrite the baseline with this run
 *
 * The web and game builds point at the local sandbox (VITE_SANDBOX_ORIGIN), so
 * a sandbox change is measured before it's deployed. Ports 4300-4302 stay clear
 * of the dev servers. Needs the root .env, like the web build.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(import.meta.dirname, 'browser-baseline.json');
const RUNS = 5;
const SANDBOX = 'http://localhost:4300';
const WEB = 'http://localhost:4301';
const GAME = 'http://localhost:4302';

const args = new Set(process.argv.slice(2));
// The web preview needs the same Cloudflare credentials as the web build.
const dotenv = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const env = { ...dotenv, ...process.env, VITE_SANDBOX_ORIGIN: SANDBOX };

function build() {
  for (const app of ['sandbox', 'game', 'web']) {
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

async function readyEditor(page: Page): Promise<number> {
  const handle = await page.waitForFunction(
    `document.querySelector('.react-flow__node') && ${CYCLE} ? performance.now() : 0`,
    undefined,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as number;
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
  const handle = await page.waitForFunction(
    `['editor', 'canvas'].every((t) => document.querySelector('[data-tour="' + t + '"]')?.classList.contains('opacity-100')) ? performance.now() : 0`,
    undefined,
    { timeout: 30_000 },
  );
  return (await handle.jsonValue()) as number;
}

const EDITOR_6502 = `${WEB}/circuit?example=6502-computer`;
const EDITOR_RV32I = `${WEB}/circuit?example=rv32i-computer`;

// Each scenario loads a page and returns one or more named measurements.
// Auto-run is capped by the speed slider (10k ticks/s), so its frame rate is
// the more sensitive number.
const SCENARIOS: { url: string; run: (p: Page) => Promise<Record<string, number>> }[] = [
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
const servers = [serve('sandbox', 4300), serve('web', 4301), serve('game', 4302)];
const stop = () => {
  for (const s of servers) {
    try {
      if (s.pid) process.kill(-s.pid);
    } catch {}
  }
};
process.on('exit', stop);

try {
  await Promise.all([waitFor(SANDBOX), waitFor(WEB), waitFor(GAME)]);
  const browser = await chromium.launch();
  const baseline = readBaseline();
  const results: Record<string, number> = {};
  for (const s of SCENARIOS) {
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
      `${JSON.stringify({ machine: cpus()[0]?.model ?? 'unknown', results }, null, 2)}\n`,
    );
    console.log('wrote browser-baseline.json');
  }
} finally {
  stop();
}
