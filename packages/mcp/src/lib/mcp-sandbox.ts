/**
 * MCP Sandbox — persistent fork()ed child process for circuit execution.
 *
 * Spawned lazily on first use, reused across calls, killed and respawned on
 * timeout or crash. The child runs with env:{} so process.env has no API keys.
 *
 * Matches the signatures of simulateCircuit / checkCircuit so callers can
 * swap them in with minimal changes.
 */

import { fork } from 'child_process';
import type { ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import type { CheckResult, SimulateResult, SimulateError } from '@simten/core/api';

// ── Config ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000;

// .cjs bundle produced by esbuild — all of @simten/core inlined, no external
// module reads required. This lets us use --permission with no --allow-fs-read.
const CHILD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'sandbox-child.cjs',
);

// ── State ──────────────────────────────────────────────────────────────────

let child: ChildProcess | null = null;
let childReady = false;

type ReadyResolver = { resolve: () => void; reject: (e: Error) => void };
let readyResolvers: Array<ReadyResolver> = [];
let idCounter = 0;

const pending = new Map<string, {
  resolve: (r: object) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

// ── Lifecycle ──────────────────────────────────────────────────────────────

function spawnChild(): void {
  if (child) {
    child.removeAllListeners();
    child.kill();
    child = null;
  }
  childReady = false;

  const proc = fork(CHILD_PATH, [], {
    env: {}, // empty — no API keys, no HOME, no PATH
    execArgv: [
      '--permission',
      `--allow-fs-read=${CHILD_PATH}`,
      // Only the bundle file itself needs to be readable — everything is inlined.
      // No --allow-child-process: blocks exec/spawn/curl/wget at the OS level.
      // No --allow-fs-write: blocks all file writes.
      // Network is not controlled by --permission; env:{} removes all credentials.
    ],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });

  proc.on('message', (msg: any) => {
    if (!msg?.type) return;

    if (msg.type === 'ready') {
      childReady = true;
      const resolvers = readyResolvers.splice(0);
      for (const r of resolvers) r.resolve();
      return;
    }

    const entry = pending.get(msg.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(msg.id);
    entry.resolve(msg);
  });

  proc.on('exit', (code) => {
    if (proc !== child) return; // stale exit from a previously-replaced child
    child = null;
    childReady = false;
    const exitError = `Sandbox process exited unexpectedly (code ${code})`;
    // Reject any callers still waiting for the child to become ready
    const resolvers = readyResolvers.splice(0);
    for (const r of resolvers) r.reject(new Error(exitError));
    // Drain pending requests — no response will arrive from a dead process
    for (const [, { resolve, timer }] of pending) {
      clearTimeout(timer);
      resolve({ type: 'error', error: exitError });
    }
    pending.clear();
  });

  proc.on('error', (err) => {
    console.error('[mcp-sandbox] child process error:', err.message);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.error('[mcp-sandbox] child stderr:', data.toString().trim());
  });

  child = proc;
}

function waitForReady(): Promise<void> {
  if (childReady) return Promise.resolve();
  return new Promise((resolve, reject) => readyResolvers.push({ resolve, reject }));
}

function nextId(): string {
  return `sb-${++idCounter}`;
}

function send(msg: object): Promise<object> {
  return new Promise((resolve) => {
    const id = nextId();
    const msgWithId = { ...msg, id };

    const timer = setTimeout(() => {
      pending.delete(id);
      // Kill the hung child and spawn a fresh one for future calls
      const dying = child;
      dying?.removeAllListeners();
      dying?.kill();
      child = null;
      childReady = false;
      readyResolvers = [];
      spawnChild();
      resolve({ type: 'error', error: 'Simulation timed out' });
    }, TIMEOUT_MS);

    pending.set(id, { resolve, timer });
    child!.send(msgWithId);
  });
}

async function ensureChild(): Promise<void> {
  if (!child) spawnChild();
  await waitForReady();
}

// ── Public API — same signatures as simulateCircuit / checkCircuit ─────────

export type SimulateParams = {
  source: string;
  ticks: number;
  circuitName?: string;
  sourceName?: string;
  inputs?: Record<string, number | boolean>;
  memoryData?: Map<string, Map<number, number>>;
};

export async function sandboxSimulate(params: SimulateParams): Promise<SimulateResult | SimulateError> {
  await ensureChild();

  // Maps are not IPC-serialisable — convert to plain objects
  let memoryData: Record<string, Record<string, number>> | undefined;
  if (params.memoryData) {
    memoryData = {};
    for (const [pattern, addrMap] of params.memoryData) {
      memoryData[pattern] = {};
      for (const [addr, val] of addrMap) {
        memoryData[pattern][String(addr)] = val;
      }
    }
  }

  const response = await send({
    type: 'simulate',
    source: params.source,
    ticks: params.ticks,
    circuitName: params.circuitName,
    sourceName: params.sourceName,
    inputs: params.inputs,
    memoryData,
  }) as { type: string; error?: string; result?: SimulateResult };

  // Unwrap: { type: 'result', result } | { type: 'error', error }
  if (response.type === 'error') return { error: response.error ?? 'Unknown sandbox error' };
  return response.result ?? { error: 'No result from sandbox' };
}

export async function sandboxCheck(params: {
  source: string;
  sourceName?: string;
}): Promise<CheckResult | { error: string }> {
  await ensureChild();

  const response = await send({
    type: 'check',
    source: params.source,
    sourceName: params.sourceName,
  }) as { type: string; error?: string; result?: CheckResult };

  if (response.type === 'error') return { error: response.error ?? 'Unknown sandbox error' };
  return response.result ?? { error: 'No result from sandbox' };
}
