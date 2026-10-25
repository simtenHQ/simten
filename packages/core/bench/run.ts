/**
 * Simulator benchmark. Times compile and ticks for each workload and takes a
 * fingerprint of the full simulator state after a fixed number of ticks.
 *
 *   pnpm bench            compare against baseline.json (tick rates vary ~±2% run to run)
 *   pnpm bench --update   overwrite baseline.json with this run
 *   pnpm bench --check    fingerprints only, exit 1 on any change (CI)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { type Loaded, load, WORKLOADS, type Workload } from './workloads.js';

// The Snake example warns about widened buses on every compile; that's not what's measured.
console.warn = () => {};

const BASELINE = join(import.meta.dirname, 'baseline.json');
const RUNS = 7;

interface Result {
  fingerprint: string;
  evalsPerTick: number;
  compileMs: number;
  ticksPerSec: number;
}

interface Baseline {
  machine: string;
  node: string;
  results: Record<string, Result>;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function canonical(value: unknown): unknown {
  if (value instanceof Map) {
    return [...value.entries()]
      .sort(([a], [b]) => (String(a) < String(b) ? -1 : 1))
      .map(([k, v]) => [k, canonical(v)]);
  }
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .map((k) => [k, canonical((value as Record<string, unknown>)[k])]);
  }
  return value;
}

function run(workload: Workload): Loaded {
  const loaded = load(workload);
  for (let i = 0; i < workload.ticks; i++) loaded.step();
  return loaded;
}

function fingerprint(loaded: Loaded): string {
  const json = JSON.stringify(canonical(loaded.engine.snapshot()));
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

function measure(workload: Workload): Result {
  const compileTimes: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    load(workload);
    compileTimes.push(performance.now() - t);
  }

  run(workload); // warm-up
  const rates: number[] = [];
  let last: Loaded | undefined;
  for (let i = 0; i < RUNS; i++) {
    const loaded = load(workload);
    const t = performance.now();
    for (let j = 0; j < workload.ticks; j++) loaded.step();
    rates.push(workload.ticks / ((performance.now() - t) / 1000));
    last = loaded;
  }
  if (!last) throw new Error('no runs');

  return {
    fingerprint: fingerprint(last),
    evalsPerTick: Math.round(last.engine.getMetrics().avgEvalsPerTick * 10) / 10,
    compileMs: Math.round(median(compileTimes) * 10) / 10,
    ticksPerSec: Math.round(median(rates)),
  };
}

function readBaseline(): Baseline | undefined {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  } catch {
    return undefined;
  }
}

const pct = (now: number, then: number) => {
  const d = ((now - then) / then) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
};

const args = new Set(process.argv.slice(2));
const baseline = readBaseline();

if (args.has('--check')) {
  if (!baseline) throw new Error('no baseline.json; run with --update first');
  let changed = 0;
  for (const w of WORKLOADS) {
    const got = fingerprint(run(w));
    const want = baseline.results[w.id]?.fingerprint;
    const ok = got === want;
    if (!ok) changed++;
    console.log(`${ok ? 'ok     ' : 'CHANGED'} ${w.id}  ${got}${ok ? '' : ` (baseline ${want})`}`);
  }
  if (changed) {
    console.log(
      `\n${changed} workload(s) changed. If intended, run \`pnpm bench --update\` and say why in the PR.`,
    );
    process.exit(1);
  }
} else {
  const results: Record<string, Result> = {};
  const rows: string[][] = [
    ['workload', 'ticks/s', 'vs base', 'compile ms', 'evals/tick', 'state'],
  ];
  for (const w of WORKLOADS) {
    const r = measure(w);
    results[w.id] = r;
    const b = baseline?.results[w.id];
    rows.push([
      w.id,
      String(r.ticksPerSec),
      b ? pct(r.ticksPerSec, b.ticksPerSec) : '',
      String(r.compileMs),
      String(r.evalsPerTick),
      !b ? '' : b.fingerprint === r.fingerprint ? 'same' : 'CHANGED',
    ]);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i])).join('  '));
  if (baseline) console.log(`\nbaseline: ${baseline.machine}, node ${baseline.node}`);

  if (args.has('--update')) {
    const next: Baseline = {
      machine: cpus()[0]?.model ?? 'unknown',
      node: process.version,
      results,
    };
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    console.log('wrote baseline.json');
  }
}
