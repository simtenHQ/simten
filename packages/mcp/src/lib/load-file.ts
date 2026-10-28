/**
 * Load a circuit file the way verify_circuit loads a testbench: as a real
 * module, in a child node process with tsx, so its imports (a sub-circuit or
 * a helper in a sibling file, `@simten/core`) resolve as they would anywhere
 * else. check_circuit and simulate_circuit use this for `filePath`; source
 * text with no file still runs in-process through executeCircuitCode.
 *
 * The child is file-runner.ts. It reads a FileRequest on stdin and prints
 * the tool's result between delimiters on stdout, after anything the
 * circuit's own code printed.
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CheckResult } from './check-circuit.js';
import { extractDelimitedJson, findRepoRoot, runProcess } from './host-run.js';
import type { SimulateError, SimulateResult, TraceOptions } from './trace-source.js';

export const FILE_JSON_BEGIN = '--- BEGIN SIMTEN FILE RESULT ---';
export const FILE_JSON_END = '--- END SIMTEN FILE RESULT ---';

export type FileRequest =
  | { mode: 'check'; file: string }
  | ({ mode: 'simulate'; file: string } & TraceOptions);

interface FileResponse<T> {
  result: T;
}

/** The file's process could not be started, timed out or crashed. */
interface RunError {
  error: string;
}

/** Long enough for a large simulation; a hang in the circuit's code is still cut off. */
const TIMEOUT_MS = 120_000;

/**
 * Whether a file is loaded as a module. A file with no imports at all is a
 * snippet written against the injected standard library (the form the web
 * editor uses), which only runs as source text, so it keeps running that way.
 */
export function loadsAsModule(text: string): boolean {
  return /^[ \t]*import[\s{*'"]/m.test(text);
}

export function checkFile(file: string): Promise<CheckResult | RunError> {
  return runFile<CheckResult>({ mode: 'check', file });
}

export function simulateFile(
  file: string,
  options: TraceOptions,
): Promise<SimulateResult | SimulateError> {
  return runFile<SimulateResult | SimulateError>({ mode: 'simulate', file, ...options });
}

async function runFile<T>(request: FileRequest): Promise<T | RunError> {
  const require = createRequire(import.meta.url);
  const tsx = pathToFileURL(require.resolve('tsx')).href;
  // file-runner sits next to this file: .ts when run from source, .js when built.
  const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
  const runner = fileURLToPath(new URL(`./file-runner${ext}`, import.meta.url));

  const run = await runProcess(process.execPath, ['--import', tsx, runner], {
    cwd: findRepoRoot(),
    input: JSON.stringify(request),
    timeoutMs: TIMEOUT_MS,
  });

  if (run.spawnError)
    return { error: `Could not start node to load ${request.file}: ${run.spawnError}` };
  if (run.timedOut) {
    return {
      error: `Loading ${request.file} timed out after ${TIMEOUT_MS / 1000}s (process killed).`,
    };
  }
  const response = extractDelimitedJson<FileResponse<T>>(
    run.stdout,
    FILE_JSON_BEGIN,
    FILE_JSON_END,
  );
  if (!response) {
    return {
      error: `Loading ${request.file} crashed (exit ${run.exitCode}).\n${run.stderr.slice(-2000)}`,
    };
  }
  return response.result;
}
