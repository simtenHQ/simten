/**
 * MCP Sandbox Child Process
 *
 * Runs as a fork()ed child with an empty environment (no API keys, no HOME,
 * no PATH). All circuit code execution happens here, isolated from the MCP
 * parent process.
 *
 * Security guarantees:
 *   env: {}       — process.env has no API keys, tokens, or credentials
 *   net overrides — fetch / http.request / https.request throw immediately,
 *                   blocking common HTTP exfiltration and cryptomining patterns
 *   30s timeout   — parent kills this process if it hangs (see mcp-sandbox.ts)
 *
 * Note: filesystem reads are NOT restricted (--permission requires listing every
 * module path including pnpm symlink targets, which is fragile). This will be
 * addressed before shared circuit files are added. For now, the empty env means
 * there are no credentials to read, and network overrides block exfiltration.
 */

import { simulateCircuit } from '@simten/core/api';
import { checkCircuit } from '@simten/core/api';
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

type IncomingMsg = SimulateMsg | CheckMsg;

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
});

// Signal ready to parent
process.send!({ type: 'ready' });
