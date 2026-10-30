/**
 * Site checks: production builds of the sandbox, the web app and the game,
 * served locally and driven in headless Chromium. Each check asserts on what
 * a visitor sees (cycle counts, printed text, wires changing colour, audio
 * produced), not on sandbox message names, so the checks outlive protocol
 * changes.
 *
 *   pnpm check:site             build, serve, check, stop the servers
 *   pnpm check:site --no-build  reuse the last build
 *
 * Same builds and ports as `pnpm bench:browser` (sandbox 4300, web 4301,
 * game 4302), so `--no-build` works after either. Exits 1 if any check fails.
 * Needs the root .env, like the web build.
 */

import type { ChildProcess } from 'node:child_process';
import { type Browser, chromium, type Page } from '@playwright/test';
import { buildApps, serveApp, siteEnv, stopAll, waitForUrl } from '../scripts/local-site.mts';

const SANDBOX = 'http://localhost:4300';
const WEB = 'http://localhost:4301';
const GAME = 'http://localhost:4302';

const args = new Set(process.argv.slice(2));
const env = siteEnv(SANDBOX);

/** What a check returns: a line of readings for the log. Throwing fails it. */
type Check = (page: Page) => Promise<string>;

class CheckFailed extends Error {}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new CheckFailed(message);
}

/**
 * Runs `fn` in the page until it returns something truthy, and returns that.
 * Polls with a function rather than `waitForFunction('<string>')`, which
 * compiles the string in the page and so is blocked by the site's CSP.
 */
async function poll<T, A>(
  page: Page,
  fn: (arg: A) => T,
  arg: A,
  timeout: number,
  what: string,
): Promise<T> {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await page.evaluate(fn, arg).catch(() => undefined);
    if (value) return value;
    if (Date.now() > end)
      throw new CheckFailed(`timed out after ${timeout} ms waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** The cycle number in the editor's clock controls, or NaN before they render. */
function readCycle(): number {
  const span = Array.from(document.querySelectorAll('span.font-mono')).find((s) =>
    s.parentElement?.textContent?.startsWith('Cycle'),
  );
  return span ? Number(span.textContent) : Number.NaN;
}

const cycle = (page: Page) => page.evaluate(readCycle);

/** Waits, from Node, until the editor's cycle number satisfies `ok`. */
async function untilCycle(page: Page, ok: (c: number) => boolean, what: string): Promise<number> {
  const end = Date.now() + 10_000;
  for (;;) {
    const c = await cycle(page);
    if (ok(c)) return c;
    if (Date.now() > end) throw new CheckFailed(`timed out waiting for ${what} (cycle ${c})`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Every wire's stroke colour, in document order. */
function wireColours(): string[] {
  return Array.from(document.querySelectorAll('.react-flow__edge path')).map(
    (p) => getComputedStyle(p).stroke,
  );
}

async function editorReady(page: Page, example: string): Promise<void> {
  await page.goto(`${WEB}/circuit?example=${example}`);
  await poll(
    page,
    () => {
      const span = Array.from(document.querySelectorAll('span.font-mono')).find((s) =>
        s.parentElement?.textContent?.startsWith('Cycle'),
      );
      return document.querySelector('.react-flow__node') !== null && span !== undefined;
    },
    undefined,
    60_000,
    'the editor to show a circuit and its clock',
  );
}

/** Clicks the first switch on the page and waits for any wire to change colour. */
async function flipFirstSwitch(page: Page): Promise<string> {
  const switches = page.locator('.react-flow__node [role="switch"]');
  expect((await switches.count()) > 0, 'no switch on the page');
  const before = await page.evaluate(wireColours);
  await switches.first().scrollIntoViewIfNeeded();
  await switches.first().click();
  await poll(
    page,
    (b: string[]) => {
      const now = Array.from(document.querySelectorAll('.react-flow__edge path')).map(
        (p) => getComputedStyle(p).stroke,
      );
      return now.some((c, i) => c !== b[i]);
    },
    before,
    10_000,
    'a wire to change colour after flipping a switch',
  );
  return 'flipping the first switch changed a wire';
}

async function editorTickRunBackReset(page: Page): Promise<string> {
  await editorReady(page, '6502-computer');
  const c0 = await untilCycle(page, (c) => !Number.isNaN(c), 'a cycle number');
  for (let i = 0; i < 10; i++) {
    await page.click('button[aria-label="Tick"]');
    await untilCycle(page, (c) => c >= c0 + i + 1, 'a tick');
  }
  const c1 = await cycle(page);
  expect(c1 === c0 + 10, `10 ticks went from ${c0} to ${c1}`);
  await page.click('button[aria-label="Run"]');
  await page.waitForTimeout(1500);
  await page.click('button[aria-label="Pause"]');
  await page.waitForTimeout(300);
  const c2 = await cycle(page);
  expect(c2 > c1, `running for 1.5s went from ${c1} to ${c2}`);
  for (let i = 0; i < 3; i++) {
    await page.click('button[aria-label="Step back"]');
    await page.waitForTimeout(200);
  }
  const c3 = await cycle(page);
  expect(c3 < c2, `three steps back went from ${c2} to ${c3}`);
  await page.click('button[aria-label="Reset"]');
  await untilCycle(page, (c) => c === 0, 'reset to cycle 0');
  return `tick x10: ${c0} -> ${c1}; run 1.5s: -> ${c2}; step back x3: -> ${c3}; reset: -> 0`;
}

async function examplePrints(page: Page, example: string, text: string): Promise<string> {
  await editorReady(page, example);
  const speed = page.locator('input[aria-label="Simulation speed"]');
  await speed.focus();
  await speed.press('End');
  await page.click('button[aria-label="Run"]');
  // The console and UART nodes print into a <pre> on the canvas. The source
  // in the code editor contains the same text, so the page as a whole won't do.
  await poll(
    page,
    (t: string) =>
      Array.from(document.querySelectorAll('.react-flow__node pre')).some((p) =>
        p.textContent?.includes(t),
      ),
    text,
    20_000,
    `"${text}" on the canvas`,
  );
  return `prints "${text}" by cycle ${await cycle(page)}`;
}

/** Clicks the editor's Verilog export and expects files, not "Can't export" (#502). */
async function exportsVerilog(page: Page, example: string): Promise<string> {
  await editorReady(page, example);
  const files: string[] = [];
  page.on('download', (d) => files.push(d.suggestedFilename()));
  await page.locator('button[title="Export circuit to Verilog (.v)"]').click();
  const end = Date.now() + 20_000;
  while (files.length === 0 && Date.now() < end) {
    const blocked = await page.getByText("Can't export").count();
    if (blocked > 0) {
      const why = await page.getByRole('button', { name: /Can't export/ }).getAttribute('title');
      throw new CheckFailed(`export blocked: ${why}`);
    }
    await page.waitForTimeout(200);
  }
  expect(files.length > 0, 'no file downloaded');
  // Sidecar .hex files follow the .v.
  await page.waitForTimeout(500);
  expect(
    files.some((f) => f.endsWith('.v')),
    `no .v among the downloads: ${files.join(', ')}`,
  );
  return `downloaded ${files.join(', ')}`;
}

async function blogPost(page: Page, slug: string): Promise<string> {
  await page.goto(`${WEB}/blog/${slug}`);
  // Scroll through so every lazily mounted demo and embed loads.
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top: number) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(3000);
  const nodes = await page.locator('.react-flow__node').count();
  expect(nodes > 0, 'no circuit rendered');
  const switches = await page.locator('.react-flow__node [role="switch"]').count();
  const flipped = switches > 0 ? `; ${await flipFirstSwitch(page)}` : '';
  return `${nodes} circuit nodes${flipped}`;
}

/**
 * A game demo (Snake, Breakout): its screen is an SVG of pixel rects. Run,
 * press a direction, and the screen changes.
 */
async function screenRuns(page: Page, slug: string): Promise<string> {
  await page.goto(`${WEB}/blog/${slug}`);
  // The screen is the SVG with the most rects. Its Run button is the nearest
  // one around it: the page's circuit embeds have Run buttons too.
  await poll(
    page,
    () => {
      const screen = Array.from(document.querySelectorAll('svg')).sort(
        (a, b) => b.querySelectorAll('rect').length - a.querySelectorAll('rect').length,
      )[0];
      if (!screen || screen.querySelectorAll('rect').length < 64) return false;
      screen.setAttribute('data-check-screen', '');
      let el = screen.parentElement;
      while (el) {
        const button = Array.from(el.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'Run',
        );
        if (button) {
          button.setAttribute('data-check-run', '');
          return true;
        }
        el = el.parentElement;
      }
      return false;
    },
    undefined,
    60_000,
    'the game screen and its Run button',
  );
  const pixels = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-check-screen] rect'))
        .map((r) => r.getAttribute('fill'))
        .join(),
    );
  const run = page.locator('[data-check-run]');
  await run.scrollIntoViewIfNeeded();
  const before = await pixels();
  await run.click();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(3000);
  const after = await pixels();
  expect(after !== before, 'the screen did not change after Run');
  return 'Run and ArrowDown change the screen';
}

const CHECKS: [string, Check][] = [
  ['6502 editor: tick, run, step back, reset', editorTickRunBackReset],
  [
    'hack-alu editor: a switch flips and wires follow',
    async (page) => {
      await page.goto(`${WEB}/circuit?example=hack-alu`);
      await page.waitForSelector('.react-flow__node [role="switch"]', { timeout: 60_000 });
      await page.waitForTimeout(1000);
      return flipFirstSwitch(page);
    },
  ],
  [
    '/learn/adders: embeds render and respond',
    async (page) => {
      await page.goto(`${WEB}/learn/adders`);
      await page.waitForSelector('.react-flow__node [role="switch"]', { timeout: 60_000 });
      await page.waitForTimeout(1000);
      const nodes = await page.locator('.react-flow__node').count();
      return `${nodes} canvas nodes; ${await flipFirstSwitch(page)}`;
    },
  ],
  [
    '/cpu/rv32i debugger: registers shown',
    async (page) => {
      await page.goto(`${WEB}/cpu/rv32i`);
      const regs = await poll(
        page,
        () => (document.body.innerText.match(/0x[0-9a-fA-F]{8}/g) ?? []).length,
        undefined,
        30_000,
        'register values',
      );
      return `${regs} hex values visible`;
    },
  ],
  ['snake blog: the game runs', (page) => screenRuns(page, 'snake-in-hardware')],
  [
    'synth blog: Play produces audio',
    async (page) => {
      await page.goto(`${WEB}/blog/synth-in-hardware`);
      const play = page.getByRole('button', { name: /^play$/i }).first();
      await play.waitFor({ timeout: 30_000 });
      await play.scrollIntoViewIfNeeded();
      await poll(
        page,
        () =>
          Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === 'Play',
          )?.disabled === false,
        undefined,
        30_000,
        'Play to be enabled',
      );
      await play.click();
      await page.waitForTimeout(3000);
      const audio = await page.evaluate(() => (window as unknown as AudioProbe).__audio);
      expect(audio.samples > 0, 'no audio samples were queued');
      expect(audio.nonzero, 'every audio sample was 0');
      return `${audio.buffers} buffers, ${audio.samples} samples queued in 3s`;
    },
  ],
  [
    'game /nand: editor and canvas revealed',
    async (page) => {
      await page.goto(`${GAME}/nand`);
      await poll(
        page,
        () =>
          ['editor', 'canvas'].every((t) =>
            document.querySelector(`[data-tour="${t}"]`)?.classList.contains('opacity-100'),
          ),
        undefined,
        60_000,
        'the level to reveal',
      );
      return 'revealed';
    },
  ],
  ...[
    'computing-trig-in-hardware',
    'how-network-switches-work',
    'how-tpus-work',
    'snake-in-hardware',
    'sorting-networks',
  ].map((slug): [string, Check] => [`blog ${slug}`, (page) => blogPost(page, slug)]),
  ['blog breakout-in-hardware', (page) => screenRuns(page, 'breakout-in-hardware')],
  ['blog pong-in-hardware', (page) => blogPost(page, 'pong-in-hardware')],
  ['rv32i-computer example prints HELLO', (page) => examplePrints(page, 'rv32i-computer', 'HELLO')],
  ['6502-computer example prints Hello', (page) => examplePrints(page, '6502-computer', 'Hello')],
  ['6502-computer exports to Verilog (#502)', (page) => exportsVerilog(page, '6502-computer')],
  ['rv32i-computer exports to Verilog (#502)', (page) => exportsVerilog(page, 'rv32i-computer')],
];

interface AudioProbe {
  __audio: { buffers: number; samples: number; nonzero: boolean };
}

/** Counts audio handed to Web Audio, which is what the synth demo plays. */
function probeAudio() {
  const probe = { buffers: 0, samples: 0, nonzero: false };
  (window as unknown as AudioProbe).__audio = probe;
  const copy = AudioBuffer.prototype.copyToChannel;
  AudioBuffer.prototype.copyToChannel = function (source, channel, start) {
    probe.buffers++;
    probe.samples += source.length;
    if (source.some((s) => s !== 0)) probe.nonzero = true;
    return copy.call(this, source, channel, start);
  };
}

async function runCheck(browser: Browser, name: string, check: Check): Promise<boolean> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(probeAudio);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  try {
    const readings = await check(page);
    expect(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    console.log(`PASS  ${name}\n      ${readings}`);
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message.split('\n')[0] : String(e);
    console.log(`FAIL  ${name}\n      ${message}`);
    if (errors.length > 0 && !(e instanceof CheckFailed && message.startsWith('console errors'))) {
      console.log(`      console errors: ${errors.join(' | ')}`);
    }
    return false;
  } finally {
    await context.close();
  }
}

const servers: ChildProcess[] = [];
process.on('exit', () => stopAll(servers));

if (!args.has('--no-build')) buildApps(['sandbox', 'game', 'web'], env);
let failed = 0;
try {
  // One at a time: each preview takes the first free inspector port from 9229,
  // so two starting together can both pick the same one and the second crashes.
  for (const [app, port, url] of [
    ['sandbox', 4300, SANDBOX],
    ['web', 4301, WEB],
    ['game', 4302, GAME],
  ] as const) {
    servers.push(serveApp(app, port, env));
    await waitForUrl(url);
  }
  const browser = await chromium.launch();
  for (const [name, check] of CHECKS) {
    if (!(await runCheck(browser, name, check))) failed++;
  }
  await browser.close();
} finally {
  stopAll(servers);
}
console.log(`\n${CHECKS.length - failed}/${CHECKS.length} passed`);
process.exitCode = failed > 0 ? 1 : 0;
