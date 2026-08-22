#!/usr/bin/env tsx
/**
 * Drift lint: the synth request-size limit is defined twice, in two languages,
 * and the two copies must agree.
 *
 * `apps/synth/src/index.ts` is a Hono gateway sitting in front of the Go
 * container in `apps/synth/container_src/main.go`. Both check the request body
 * size, so **the smaller of the two binds** — and a generous container limit is
 * invisible if the gateway's is lower.
 *
 * That is not hypothetical. The gateway sat at a hardcoded 120 KB, sized for
 * single-file pastes, while the container was raised for multi-file imports.
 * The servant SoC (18 Verilog files, ~136 KB of JSON once escaped) passed every
 * check downstream and 413'd at the gateway. It was invisible in local dev,
 * which POSTs to the container directly and never touches the gateway at all,
 * so it would only ever have surfaced in production.
 *
 * Run via `pnpm test` and CI, next to check-exports.ts.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const GO_FILE = 'apps/synth/container_src/main.go';
const TS_FILE = 'apps/synth/src/index.ts';
const GO_CONST = 'maxRequestBody';
const TS_CONST = 'MAX_REQUEST_BYTES';

/**
 * Evaluate a constant expression after substituting known identifiers.
 * Deliberately narrow: only digits, `*`, `+` and parens survive the guard, so
 * this cannot execute anything from the source files beyond arithmetic.
 */
function evalArith(expr: string, consts: Record<string, number>): number {
  const substituted = expr.replace(/[A-Za-z_]\w*/g, (id) => {
    const v = consts[id];
    if (v === undefined) throw new Error(`unknown identifier "${id}" in: ${expr}`);
    return String(v);
  });
  if (!/^[\d\s*+()]+$/.test(substituted)) {
    throw new Error(`refusing to evaluate non-arithmetic expression: ${substituted}`);
  }
  return Number(new Function(`"use strict"; return (${substituted});`)());
}

/** Collect `const NAME = <expr>` declarations, resolving references as we go. */
function collectConsts(source: string, pattern: RegExp): Record<string, number> {
  const consts: Record<string, number> = {};
  for (const m of source.matchAll(pattern)) {
    const [, name, rawExpr] = m;
    const expr = rawExpr.split('//')[0].trim();
    try {
      consts[name] = evalArith(expr, consts);
    } catch {
      // Non-numeric consts (strings, durations) are expected — skip them.
    }
  }
  return consts;
}

const goSource = readFileSync(join(repoRoot, GO_FILE), 'utf8');
const tsSource = readFileSync(join(repoRoot, TS_FILE), 'utf8');

const goConsts = collectConsts(goSource, /^const\s+(\w+)\s*=\s*(.+)$/gm);
const tsConsts = collectConsts(tsSource, /^const\s+(\w+)\s*=\s*([^;]+);/gm);

const failures: string[] = [];
const goValue = goConsts[GO_CONST];
const tsValue = tsConsts[TS_CONST];

if (goValue === undefined) {
  failures.push(`${GO_FILE}: could not find a numeric \`const ${GO_CONST}\``);
}
if (tsValue === undefined) {
  failures.push(`${TS_FILE}: could not find a numeric \`const ${TS_CONST}\``);
}
if (goValue !== undefined && tsValue !== undefined && goValue !== tsValue) {
  failures.push(
    `synth request-size limits disagree — the smaller one silently binds:\n` +
      `    ${TS_FILE}  ${TS_CONST} = ${tsValue}\n` +
      `    ${GO_FILE}  ${GO_CONST} = ${goValue}\n` +
      `  The gateway fronts the container, so a request over ${Math.min(tsValue, goValue)} ` +
      `bytes is rejected regardless of the other limit.`,
  );
}

if (failures.length > 0) {
  console.error('check-synth-limits failed:\n');
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check-synth-limits: gateway and container agree at ${goValue} bytes`);
