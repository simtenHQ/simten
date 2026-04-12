/**
 * Sandbox iframe main thread.
 *
 * Runs inside a hidden iframe with sandbox="allow-scripts allow-same-origin".
 * Origin isolation (sandbox.simten.dev vs simten.dev) prevents access to the
 * main app's cookies, localStorage, and DOM.
 *
 * compile / simulate → delegated to a Web Worker (separate thread).
 *   An infinite loop in the worker blocks only that thread. The iframe's
 *   event loop stays live so it can fire the 5s timeout and terminate() the
 *   worker, then spawn a fresh one.
 *
 * tick / reset / set-node → run directly on the main thread (no user code,
 *   just advancing the already-compiled simulator — safe and fast).
 *
 * Security guarantees:
 *   IN:  arbitrary untrusted TypeScript string
 *   OUT: plain JSON only — no functions, no Maps, no class instances
 */

import {
  createSimulator,
  elaborate,
} from '@simten/core/simulator';
import type { Circuit } from '@simten/core';
import type { BitValue, BusValue } from '@simten/core/simulator';

// ============================================================================
// Types
// ============================================================================

type SandboxRequest =
  | { id: string; type: 'compile'; source: string }
  | { id: string; type: 'tick'; inputs?: Record<string, number | boolean> }
  | { id: string; type: 'simulate'; source?: string; ticks: number; inputs?: Record<string, number | boolean>; memoryData?: Record<string, Record<string, number>> }
  | { id: string; type: 'reset' }
  | { id: string; type: 'set-node'; nodeId: string; value: number | boolean };

// ============================================================================
// Worker management
// ============================================================================

const WORKER_TIMEOUT_MS = 5000;

let worker = createWorker();
const pendingWorker = new Map<string, (result: object) => void>();

function createWorker(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent) => {
    const { id } = e.data as { id: string };
    const resolve = pendingWorker.get(id);
    if (resolve) {
      pendingWorker.delete(id);
      resolve(e.data);
    }
  };
  w.onerror = (e) => {
    console.error('[sandbox worker error]', e);
  };
  return w;
}

function delegateToWorker(msg: object & { id: string }): Promise<object> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      worker = createWorker();
      // Fail ALL requests pending against the dead worker — not just this one.
      // Distinguish the guilty request (caused the hang) from collateral ones
      // (were queued behind it and lost when the worker was terminated).
      // Callers can use this to retry collaterally-killed requests without
      // retrying the code that actually caused the infinite loop.
      const drained = new Map(pendingWorker);
      pendingWorker.clear();
      for (const [id, cb] of drained) {
        cb({
          id,
          type: 'error',
          error: id === msg.id ? 'Execution timed out' : 'Worker restarted',
        });
      }
    }, WORKER_TIMEOUT_MS);

    pendingWorker.set(msg.id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    worker.postMessage(msg);
  });
}

// ============================================================================
// Active simulation state (held between ticks)
// ============================================================================

let activeSimulator: ReturnType<typeof createSimulator> | null = null;
let activeSource: string = '';
let activeLibrary: { resolveCircuit(name: string): Circuit | undefined } | null = null;

// ============================================================================
// Helpers
// ============================================================================

function portValuesToObject(
  values: ReadonlyMap<string, BitValue | BusValue>,
): Record<string, number | boolean> {
  const obj: Record<string, number | boolean> = {};
  for (const [k, v] of values) {
    obj[k] = v as number | boolean;
  }
  return obj;
}

function applyInputs(
  simulator: ReturnType<typeof createSimulator>,
  inputs: Record<string, number | boolean>,
) {
  for (const [name, value] of Object.entries(inputs)) {
    simulator.setNode(name, value as BitValue | BusValue);
  }
}

function respond(id: string, payload: object) {
  parent.postMessage({ id, ...payload }, '*');
}

function respondError(id: string, error: string) {
  parent.postMessage({ id, type: 'error', error }, '*');
}

// ============================================================================
// Message handlers
// ============================================================================

async function handleCompile(id: string, source: string) {
  // Worker compiles source → returns Circuit IR (plain JSON, no functions)
  const workerResult = await delegateToWorker({ id, type: 'compile', source }) as {
    type: string;
    error?: string;
    circuits?: Circuit[];
    libraryCircuits?: Circuit[];
  };

  if (workerResult.type === 'error' || workerResult.error) {
    respondError(id, workerResult.error ?? 'Unknown compile error');
    return;
  }

  const circuits = workerResult.circuits ?? [];
  const libraryCircuits = workerResult.libraryCircuits ?? [];

  if (circuits.length === 0) {
    respondError(id, 'No circuits found in source.');
    return;
  }

  try {
    // Build library from returned IR so elaborate() can resolve components
    const circuitMap = new Map<string, Circuit>();
    for (const c of [...circuits, ...libraryCircuits]) {
      circuitMap.set(c.name, c);
    }
    const library = {
      resolveCircuit: (name: string) => circuitMap.get(name),
      getAllPrimitiveNames: () =>
        [...circuitMap.values()]
          .filter(c => c.implementation?.kind === 'primitive')
          .map(c => c.name),
      getAllCircuitNames: () => [...circuitMap.keys()],
    };

    // Create simulator from IR on main thread (safe — no user code)
    const target = circuits[circuits.length - 1];
    const flatCircuit = elaborate(target, library);
    const sim = createSimulator(flatCircuit, { componentLibrary: library });

    activeSimulator = sim;
    activeSource = source;
    activeLibrary = library;

    const portValues = portValuesToObject(sim.getPortValues());

    respond(id, {
      type: 'compiled',
      circuits,
      libraryCircuits,
      portValues,
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleTick(id: string, inputs?: Record<string, number | boolean>) {
  if (!activeSimulator) {
    respondError(id, 'No circuit compiled. Call compile first.');
    return;
  }
  try {
    if (inputs) applyInputs(activeSimulator, inputs);
    const result = activeSimulator.tick();
    respond(id, {
      type: 'ticked',
      portValues: portValuesToObject(result.portValues),
      cycle: activeSimulator.getMetrics().totalTicks,
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

async function handleSimulate(
  id: string,
  ticks: number,
  source?: string,
  inputs?: Record<string, number | boolean>,
  memoryData?: Record<string, Record<string, number>>,
) {
  const sourceToUse = source ?? activeSource;
  if (!sourceToUse) {
    respondError(id, 'No circuit compiled. Provide source or call compile first.');
    return;
  }

  // Worker runs the full simulation (may run user eval: functions)
  const result = await delegateToWorker({
    id,
    type: 'simulate',
    source: sourceToUse,
    ticks,
    inputs,
    memoryData,
  });

  parent.postMessage({ ...result }, '*');
}

function handleReset(id: string) {
  if (!activeSimulator) {
    respondError(id, 'No circuit compiled.');
    return;
  }
  try {
    activeSimulator.reset();
    const portValues = portValuesToObject(activeSimulator.getPortValues());
    respond(id, { type: 'reset', portValues });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleSetNode(id: string, nodeId: string, value: number | boolean) {
  if (!activeSimulator) {
    respondError(id, 'No circuit compiled.');
    return;
  }
  try {
    activeSimulator.setNode(nodeId, value as BitValue | BusValue);
    activeSimulator.runCombinational();
    const portValues = portValuesToObject(activeSimulator.getPortValues());
    respond(id, { type: 'set-node', portValues });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

// ============================================================================
// Message dispatcher
// ============================================================================

self.addEventListener('message', (event: MessageEvent) => {
  const req = event.data as SandboxRequest;
  if (!req?.id || !req?.type) return;

  switch (req.type) {
    case 'compile':
      handleCompile(req.id, req.source);
      break;
    case 'tick':
      handleTick(req.id, req.inputs);
      break;
    case 'simulate':
      handleSimulate(req.id, req.ticks, req.source, req.inputs, req.memoryData);
      break;
    case 'reset':
      handleReset(req.id);
      break;
    case 'set-node':
      handleSetNode(req.id, req.nodeId, req.value);
      break;
  }
});

// Signal that the sandbox is ready
parent.postMessage({ type: 'ready' }, '*');
