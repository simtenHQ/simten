#!/usr/bin/env tsx
/**
 * Drift lint: the synth request contract is written down twice, in two
 * languages, and the two copies must agree.
 *
 * `apps/synth/src/index.ts` is a Hono gateway sitting in front of the Go
 * container in `apps/synth/container_src/main.go`. It checks two things this
 * lint watches:
 *
 * 1. **The body-size limit.** Both sides cap the request, so the smaller of the
 *    two binds — a generous container limit is invisible if the gateway's is
 *    lower. The gateway sat at a hardcoded 120 KB, sized for single-file
 *    pastes, while the container was raised for multi-file imports; the servant
 *    SoC (~136 KB of JSON once escaped) passed every check downstream and 413'd
 *    at the gateway.
 *
 * 2. **The field list.** The gateway re-serializes an explicit object rather
 *    than forwarding the body, so a field added to the container's SynthRequest
 *    and not to that object is silently dropped — the request succeeds and the
 *    feature just does nothing.
 *
 * Both failures share the same shape: invisible in local dev, which POSTs to
 * the container directly and never touches the gateway, and visible only in
 * production.
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

// --- The field list -------------------------------------------------------

/** Pull the `json:"…"` tags off a Go struct. */
function goStructFields(source: string, structName: string): string[] {
  const m = new RegExp(`type\\s+${structName}\\s+struct\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  if (!m) return [];
  return [...m[1].matchAll(/`json:"(\w+)"/g)].map((t) => t[1]);
}

/**
 * Pull the keys out of the `JSON.stringify({…})` the gateway forwards to a
 * container route — the object literal that follows the `fetch` for that path.
 */
function gatewayForwardedKeys(source: string, route: string): string[] {
  const at = source.indexOf(route);
  if (at === -1) return [];
  const open = source.indexOf('JSON.stringify({', at);
  if (open === -1) return [];
  const close = source.indexOf('})', open);
  if (close === -1) return [];
  const literal = source.slice(open + 'JSON.stringify({'.length, close);
  return [...literal.matchAll(/^\s*(\w+):/gm)].map((k) => k[1]);
}

const goFields = goStructFields(goSource, 'SynthRequest');
const gatewayKeys = new Set(gatewayForwardedKeys(tsSource, 'http://container/synth'));

if (goFields.length === 0) {
  failures.push(`${GO_FILE}: could not find \`type SynthRequest struct\``);
} else if (gatewayKeys.size === 0) {
  failures.push(`${TS_FILE}: could not find the JSON.stringify forwarded to /synth`);
} else {
  const dropped = goFields.filter((f) => !gatewayKeys.has(f));
  if (dropped.length > 0) {
    failures.push(
      `the gateway drops ${dropped.length} field(s) the container reads: ${dropped.join(', ')}\n` +
        `    ${GO_FILE}  SynthRequest has ${goFields.join(', ')}\n` +
        `    ${TS_FILE}  forwards ${[...gatewayKeys].join(', ')}\n` +
        `  The gateway re-serializes an explicit list, so an unforwarded field is\n` +
        `  dropped in production only — local dev POSTs to the container directly.`,
    );
  }
}

if (failures.length > 0) {
  console.error('check-synth-limits failed:\n');
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check-synth-limits: gateway and container agree at ${goValue} bytes ` +
    `and on all ${goFields.length} request fields`,
);
