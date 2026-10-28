/**
 * Child process for load-file.ts: load one circuit file as a module and check
 * or simulate it.
 *
 * Runs under `node --import tsx`, like a verify_circuit testbench, so relative
 * imports, helpers and npm packages resolve normally. Two things differ from a
 * plain tsx run, both done by the resolve hook below:
 *
 * - `@simten/core` imports from the project resolve to this server's own copy,
 *   as they always have for check_circuit and simulate_circuit. The circuits a
 *   file builds have to come from the same copy that simulates them, and the
 *   project need not have installed it.
 * - `@simten/core` and `@simten/core/circuit` get file-collector's `circuit`,
 *   which records every circuit the files build. A file need not export its
 *   circuits, the same as for source text.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { register } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type CheckResult, checkCompiled } from './check-circuit.js';
import { type Compiled, compileBuilt, compileError } from './compile-file.js';
import { built } from './file-collector.js';
import { FILE_JSON_BEGIN, FILE_JSON_END, type FileRequest } from './load-file.js';
import {
  type SimulateError,
  type SimulateResult,
  type TraceOptions,
  traceCompiled,
} from './trace-source.js';

// Plain JS, loaded as a data: URL so it needs no build step of its own. Hooks
// run on their own thread, so what they need comes in through `initialize`.
// The project's own .ts files load as ES modules even in a folder with no
// package.json, which tsx alone would load as CommonJS, out of reach of this
// hook (fully so on Node 20, where require() calls bypass it): check_circuit
// and simulate_circuit need no project setup.
const HOOKS = `
let options;
export function initialize(data) {
  options = data;
}
const isOwn = (url) => options.own.some((root) => url.startsWith(root));
const isCore = (specifier) => specifier === '@simten/core' || specifier.startsWith('@simten/core/');
export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL;
  if (!parent || isOwn(parent) || !isCore(specifier)) {
    const resolved = await nextResolve(specifier, context);
    // Where tsx can't hook require() (Node 20), it resolves a CommonJS .ts file
    // imported from ESM to its own URL with a query on it; the file is the
    // part before.
    const file = resolved.url.replace(/(?:%3F|\\?).*$/, '');
    const isProjectTs =
      file.startsWith('file:') && file.endsWith('.ts') && !file.includes('/node_modules/') && !isOwn(file);
    return isProjectTs ? { ...resolved, url: file, format: 'module' } : resolved;
  }
  const resolved = await nextResolve(specifier, { ...context, parentURL: options.anchor });
  if (specifier !== '@simten/core' && specifier !== '@simten/core/circuit') return resolved;
  const shim =
    'export * from ' + JSON.stringify(resolved.url) + ';\\n' +
    'export { circuit } from ' + JSON.stringify(options.collector) + ';\\n';
  return { url: 'data:text/javascript,' + encodeURIComponent(shim), format: 'module', shortCircuit: true };
}
`;

interface Location {
  file: string;
  line: number;
  column: number;
}

const request = JSON.parse(readFileSync(0, 'utf8')) as FileRequest;
const entryFile = realpathSync(request.file);

// This package and the core it uses import @simten/core as themselves.
const ownRoots = [
  new URL('../../', import.meta.url).href,
  new URL('./', import.meta.resolve('@simten/core/package.json')).href,
];

register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, {
  data: {
    anchor: import.meta.url,
    collector: import.meta.resolve('./file-collector.js'),
    own: ownRoots,
  },
});

const { compiled, at } = await load(entryFile);
const result: CheckResult | SimulateResult | SimulateError =
  request.mode === 'check'
    ? checkCompiled(
        compiled,
        at?.file === entryFile ? { line: at.line, column: at.column } : undefined,
      )
    : simulate(compiled, request);

process.stdout.write(
  `\n${FILE_JSON_BEGIN}\n${JSON.stringify({ result })}\n${FILE_JSON_END}\n`,
  () => process.exit(0),
);

async function load(file: string): Promise<{ compiled: Compiled; at?: Location }> {
  let entry: Record<string, unknown>;
  try {
    entry = await import(pathToFileURL(file).href);
  } catch (e) {
    return { compiled: compileError(located(e)), at: locate(e) };
  }
  // A file that builds nothing but exports a circuit (`export { Adder }`) is
  // still something to check and simulate.
  return { compiled: compileBuilt(built.length > 0 ? built : Object.values(entry)) };
}

/** Simulate, reporting a throw from the circuit's own code (an `eval`, say) like a load error. */
function simulate(compiled: Compiled, options: TraceOptions): SimulateResult | SimulateError {
  try {
    return traceCompiled(compiled, options);
  } catch (e) {
    return { error: located(e) };
  }
}

/** The error's message, after the file, line and column it came from when that is known. */
function located(e: unknown): string {
  const at = locate(e);
  return `${at ? `${shortPath(at.file)}:${at.line}:${at.column}: ` : ''}${errorMessage(e)}`;
}

/**
 * The error's message, without esbuild's own location prefix on a syntax
 * error ("Transform failed with 1 error:\n/abs/file.ts:7:2: ERROR: ..."): the
 * location is reported once, in front.
 */
function errorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message
    .replace(/^Transform failed with \d+ errors?:\n/, '')
    .replace(/^\S+:\d+:\d+: ERROR: /gm, '');
}

/** The first place in the project's own files an error came from. */
function locate(e: unknown): Location | undefined {
  if (!(e instanceof Error) || !e.stack) return undefined;
  const own = ownRoots.map((root) => fileURLToPath(root));
  // Stack frames, and esbuild's "file:line:column: ERROR:" for a syntax error.
  for (const m of e.stack.matchAll(/(?:^|[\s(])(?:file:\/\/)?(\/[^\s():]+):(\d+):(\d+)/gm)) {
    const file = m[1];
    if (file.includes('/node_modules/') || own.some((root) => file.startsWith(root))) continue;
    return { file, line: Number(m[2]), column: Number(m[3]) };
  }
  return undefined;
}

function shortPath(file: string): string {
  const rel = relative(process.cwd(), file);
  return rel.startsWith('..') ? file : rel;
}
