/**
 * MCP Sandbox Child Process
 *
 * Runs as a fork()ed child with an empty environment (no API keys, no HOME,
 * no PATH). All circuit code execution happens here, isolated from the MCP
 * parent process.
 *
 * Security guarantees (spawn flags live in mcp-sandbox.ts):
 *   env: {}       — process.env has no API keys, tokens, or credentials
 *   --permission  — Node permission model on; fs reads allowed ONLY for this
 *                   bundle (--allow-fs-read=<bundle>), so out-of-bundle reads are
 *                   denied (verified: process.permission.has('fs.read', other) === false).
 *                   No --allow-fs-write (writes blocked) and no --allow-child-process
 *                   (exec/spawn blocked) at the OS level.
 *   net overrides — fetch / http.request / https.request throw immediately,
 *                   blocking common HTTP exfiltration and cryptomining patterns
 *   30s timeout   — parent kills this process if it hangs (see mcp-sandbox.ts)
 *
 * (The old "fs reads are not restricted" caveat is obsolete: bundling everything
 * into a single .cjs means only one path needs --allow-fs-read, which sidesteps
 * the per-module-path / pnpm-symlink fragility that originally blocked it.)
 */

import { simulateCircuit } from '@simten/core/api';
import { checkCircuit } from '@simten/core/api';
import { verifyCircuit, type OracleDecl } from '@simten/core/api';
import http from 'http';
import https from 'https';

// ── Block network before any user code runs ────────────────────────────────

const networkDisabled = () => {
  throw new Error('Network access is disabled in the simulation sandbox');
};

// fetch is not in Node.js built-ins at the module level but override anyway
Object.defineProperty(globalThis, 'fetch', { value: networkDisabled, writable: false, configurable: false });

(http as any).request = networkDisabled;
(http as any).get = networkDisabled;
(https as any).request = networkDisabled;
(https as any).get = networkDisabled;

// ── Message types ──────────────────────────────────────────────────────────

type SimulateMsg = {
  id: string;
  type: 'simulate';
  source: string;
  ticks: number;
  circuitName?: string;
  sourceName?: string;
  inputs?: Record<string, number | boolean>;
  memoryData?: Record<string, Record<string, number>>;
};

type CheckMsg = {
  id: string;
  type: 'check';
  source: string;
  sourceName?: string;
};

type VerifyMsg = {
  id: string;
  type: 'verify';
  source: string;
  testbench: string;
  oracle: OracleDecl;
  sourceName?: string;
  circuitName?: string;
  numRuns?: number;
  timeoutMs?: number;
};

type IncomingMsg = SimulateMsg | CheckMsg | VerifyMsg;

// ── Message handler ────────────────────────────────────────────────────────

process.on('message', (msg: IncomingMsg) => {
  const { id, type } = msg;

  if (type === 'simulate') {
    try {
      let memoryData: Map<string, Map<number, number>> | undefined;
      if (msg.memoryData) {
        memoryData = new Map();
        for (const [pattern, addrMap] of Object.entries(msg.memoryData)) {
          const inner = new Map<number, number>();
          for (const [addr, val] of Object.entries(addrMap)) {
            inner.set(Number(addr), val);
          }
          memoryData.set(pattern, inner);
        }
      }

      const result = simulateCircuit({
        source: msg.source,
        ticks: msg.ticks,
        circuitName: msg.circuitName,
        sourceName: msg.sourceName,
        inputs: msg.inputs,
        memoryData,
      });

      process.send!({ id, type: 'result', result });
    } catch (e) {
      process.send!({ id, type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (type === 'check') {
    try {
      const result = checkCircuit({ source: msg.source, sourceName: msg.sourceName });
      process.send!({ id, type: 'result', result });
    } catch (e) {
      process.send!({ id, type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (type === 'verify') {
    try {
      const result = verifyCircuit({
        source: msg.source,
        testbench: msg.testbench,
        oracle: msg.oracle,
        sourceName: msg.sourceName,
        circuitName: msg.circuitName,
        numRuns: msg.numRuns,
        timeoutMs: msg.timeoutMs,
      });
      process.send!({ id, type: 'result', result });
    } catch (e) {
      process.send!({ id, type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
});

// Signal ready to parent
process.send!({ type: 'ready' });
