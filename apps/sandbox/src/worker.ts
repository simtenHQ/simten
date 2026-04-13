/**
 * Sandbox Worker — executes untrusted user circuit code in a separate thread.
 *
 * Runs inside the sandbox iframe as a Web Worker. The worker thread is
 * independent of the iframe's event loop, so an infinite loop here
 * (while(true){}) blocks only this thread — the iframe can still fire
 * its timeout and call worker.terminate().
 *
 * Handles: compile, simulate
 * Does NOT handle: tick, reset, set-node (those are safe — no user code)
 *
 * compile path — two modes:
 *   No imports → fast path: executeCircuitCode() via new Function()
 *   Has imports → module path: load npm packages via esm.sh Blob URL, then
 *                              executeJsCode() with merged scope
 */

import { executeCircuitCode, executeJsCode, stripTypes } from '@simten/core/circuit';
import { simulateCircuit } from '@simten/core/api';
import type { Circuit } from '@simten/core';
import { hasImportStatements, extractAndRewriteImports } from './rewrite-imports.js';

type WorkerRequest =
  | { id: string; type: 'compile'; source: string }
  | { id: string; type: 'simulate'; source: string; ticks: number; inputs?: Record<string, number | boolean>; memoryData?: Record<string, Record<string, number>> };

function circuitToSerializable(c: Circuit): object {
  return JSON.parse(JSON.stringify(c));
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  if (req.type === 'compile') {
    try {
      const js = stripTypes(req.source);

      let result;
      if (!hasImportStatements(js)) {
        // Fast path: existing new Function() + scope injection, no network
        result = executeCircuitCode(req.source);
      } else {
        // Module path: load npm packages via dynamic import, merge into scope
        const { loaderModule, localNames, codeWithoutImports } = extractAndRewriteImports(js);

        let importedMod: Record<string, unknown> = {};
        if (localNames.length > 0) {
          const blob = new Blob([loaderModule], { type: 'text/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          try {
            importedMod = await import(/* @vite-ignore */ blobUrl) as Record<string, unknown>;
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }

        const extraScope = Object.fromEntries(
          localNames.map(n => [n, importedMod[n]])
        );
        result = executeJsCode(codeWithoutImports, extraScope);
      }

      if (result.error) {
        self.postMessage({ id: req.id, type: 'error', error: result.error });
        return;
      }
      if (result.circuits.length === 0) {
        self.postMessage({ id: req.id, type: 'error', error: 'No circuits found in source.' });
        return;
      }

      const libraryCircuits: Circuit[] = [];
      for (const name of result.library.getAllCircuitNames()) {
        const c = result.library.resolveCircuit(name);
        if (c) libraryCircuits.push(c);
      }

      self.postMessage({
        id: req.id,
        type: 'compiled-ir',
        circuits: result.circuits.map(circuitToSerializable),
        libraryCircuits: libraryCircuits.map(circuitToSerializable),
      });
    } catch (e) {
      self.postMessage({ id: req.id, type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  if (req.type === 'simulate') {
    try {
      let memoryData: Map<string, Map<number, number>> | undefined;
      if (req.memoryData) {
        memoryData = new Map();
        for (const [pattern, addrMap] of Object.entries(req.memoryData)) {
          const inner = new Map<number, number>();
          for (const [addr, val] of Object.entries(addrMap)) {
            inner.set(Number(addr), val);
          }
          memoryData.set(pattern, inner);
        }
      }

      const simResult = simulateCircuit({
        source: req.source,
        ticks: req.ticks,
        inputs: req.inputs,
        memoryData,
      });

      if ('error' in simResult) {
        self.postMessage({ id: req.id, type: 'error', error: simResult.error });
        return;
      }

      self.postMessage({
        id: req.id,
        type: 'simulated',
        circuitName: simResult.circuit,
        signals: simResult.signals,
        vcd: simResult.vcd,
        ticks: simResult.ticks,
        steadyStateAt: simResult.steadyStateAt,
      });
    } catch (e) {
      self.postMessage({ id: req.id, type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
}

self.onmessage = (event: MessageEvent) => {
  const req = event.data as WorkerRequest;
  handleRequest(req).catch(e => {
    self.postMessage({ id: req.id, type: 'error', error: e instanceof Error ? e.message : String(e) });
  });
};
