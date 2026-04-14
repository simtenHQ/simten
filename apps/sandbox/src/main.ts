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
} from '@simten/core';
import type { Circuit, BitValue, BusValue } from '@simten/core';
import { registerCircuitEval } from '@simten/core/circuit';

/** Serialized eval entry — source strings reconstructed via new Function() */
interface EvalSource {
  evalSource: string;
  onTickSource?: string;
  inputNames: string[];
  outputNames: string[];
  stateKeys?: string[];
}

// ============================================================================
// Types
// ============================================================================

/** Each simulation lives in a named slot. Slots are independent (own simulator, library, source). */
type SandboxRequest =
  | { id: string; type: 'compile'; source: string; slot?: string }
  | { id: string; type: 'compile-ir'; circuit: Circuit; libraryCircuits: Circuit[]; slot: string; evalSources?: Record<string, EvalSource> }
  | { id: string; type: 'tick'; inputs?: Record<string, number | boolean>; slot?: string }
  | { id: string; type: 'simulate'; source?: string; ticks: number; inputs?: Record<string, number | boolean>; memoryData?: Record<string, Record<string, number>>; slot?: string }
  | { id: string; type: 'reset'; slot?: string }
  | { id: string; type: 'set-node'; nodeId: string; value: number | boolean | Map<number, number>; slot?: string }
  | { id: string; type: 'dispose'; slot: string };

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

// Each slot has its own simulator + library + source — fully independent.
// Slot IDs are supplied by the client. Legacy clients (no slot) use 'default'.
interface SlotState {
  simulator: ReturnType<typeof createSimulator> | null;
  library: { resolveCircuit(name: string): Circuit | undefined; addCircuit?(c: Circuit): void } | null;
  source: string;
}

const slots = new Map<string, SlotState>();
const DEFAULT_SLOT = 'default';

function getSlot(id: string): SlotState {
  let s = slots.get(id);
  if (!s) {
    s = { simulator: null, library: null, source: '' };
    slots.set(id, s);
  }
  return s;
}

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

// Parent origin is pinned on the first inbound message (see dispatcher below).
// Until then, we only send the benign `ready` signal with wildcard; all
// request/response traffic goes to the captured origin.
let parentOrigin: string | null = null;

function respond(id: string, payload: object) {
  if (!parentOrigin) return;
  parent.postMessage({ id, ...payload }, parentOrigin);
}

function respondError(id: string, error: string) {
  if (!parentOrigin) return;
  parent.postMessage({ id, type: 'error', error }, parentOrigin);
}

// ============================================================================
// Message handlers
// ============================================================================

async function handleCompile(id: string, source: string, slotId: string = DEFAULT_SLOT) {
  // Worker compiles source (handles imports via esm.sh) → returns Circuit IR + eval sources
  const workerResult = await delegateToWorker({ id, type: 'compile', source }) as {
    type: string;
    error?: string;
    circuits?: Circuit[];
    libraryCircuits?: Circuit[];
    evalSources?: Record<string, {
      evalSource: string;
      onTickSource?: string;
      inputNames: string[];
      outputNames: string[];
      stateKeys?: string[];
    }>;
  };

  if (workerResult.type === 'error' || workerResult.error) {
    respondError(id, workerResult.error ?? 'Unknown compile error');
    return;
  }

  const circuits = workerResult.circuits ?? [];
  const libraryCircuits = workerResult.libraryCircuits ?? [];
  const evalSources = workerResult.evalSources ?? {};

  if (circuits.length === 0) {
    respondError(id, 'No circuits found in source.');
    return;
  }

  try {
    // Register evals on iframe main thread by reconstructing them from source strings.
    // This avoids re-executing the module (which may contain npm imports that only
    // the worker can load via esm.sh) on the main thread.
    for (const [name, info] of Object.entries(evalSources)) {
      try {
        const evalFn = new Function('return (' + info.evalSource + ')')() as (inputs: Record<string, any>) => Record<string, any>;
        const onTickFn = info.onTickSource
          ? new Function('return (' + info.onTickSource + ')')() as (inputs: Record<string, any>) => Record<string, any>
          : undefined;
        registerCircuitEval(name, {
          inputNames: info.inputNames,
          outputNames: info.outputNames,
          evalFn,
          onTickFn,
          stateKeys: info.stateKeys,
        });
      } catch (e) {
        console.warn(`[sandbox] Failed to register eval for '${name}':`, e);
      }
    }

    // Build a library from the Circuit IRs the worker sent back
    const circuitMap = new Map<string, Circuit>();
    const library = {
      resolveCircuit: (name: string) => circuitMap.get(name),
      getAllPrimitiveNames: () => [...circuitMap.values()].filter(c => c.implementation?.kind === 'primitive').map(c => c.name),
      addCircuit: (c: Circuit) => { circuitMap.set(c.name, c); },
    };
    for (const c of [...circuits, ...libraryCircuits]) {
      library.addCircuit(c);
    }

    const target = circuits[circuits.length - 1];
    const flatCircuit = elaborate(target, library);
    const sim = createSimulator(flatCircuit, { componentLibrary: library });

    const slot = getSlot(slotId);
    slot.simulator = sim;
    slot.library = library;
    slot.source = source;

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

function handleTick(id: string, inputs?: Record<string, number | boolean>, slotId: string = DEFAULT_SLOT) {
  const sim = slots.get(slotId)?.simulator;
  if (!sim) {
    respondError(id, `No circuit compiled for slot '${slotId}'. Call compile first.`);
    return;
  }
  try {
    if (inputs) applyInputs(sim, inputs);
    const result = sim.tick();
    respond(id, {
      type: 'ticked',
      portValues: portValuesToObject(result.portValues),
      cycle: sim.getMetrics().totalTicks,
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
  slotId: string = DEFAULT_SLOT,
) {
  const sourceToUse = source ?? slots.get(slotId)?.source ?? '';
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

  if (parentOrigin) parent.postMessage({ ...result }, parentOrigin);
}

function handleReset(id: string, slotId: string = DEFAULT_SLOT) {
  const sim = slots.get(slotId)?.simulator;
  if (!sim) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  try {
    sim.reset();
    const portValues = portValuesToObject(sim.getPortValues());
    respond(id, { type: 'reset', portValues });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleSetNode(id: string, nodeId: string, value: number | boolean | Map<number, number>, slotId: string = DEFAULT_SLOT) {
  const sim = slots.get(slotId)?.simulator;
  if (!sim) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  try {
    // Accept Map values for ROM/RAM memory loading
    sim.setNode(nodeId, value as any);
    sim.runCombinational();
    const portValues = portValuesToObject(sim.getPortValues());
    respond(id, { type: 'set-node', portValues });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleDispose(id: string, slotId: string) {
  slots.delete(slotId);
  respond(id, { type: 'disposed' });
}

/**
 * Compile from Circuit IR (not source code).
 * Used for the auto-harnessed circuit — the harness is built client-side
 * as Circuit IR and sent here for simulation.
 * Uses the library from the last executeCircuitCode (has eval functions).
 */
function handleCompileIR(id: string, circuit: Circuit, libraryCircuits: Circuit[], slotId: string, evalSources?: Record<string, EvalSource>) {
  try {
    // If evalSources are provided, reconstruct the functions and register them.
    // This is how the embed transfers eval functions from the main frame to the sandbox.
    if (evalSources) {
      for (const [name, info] of Object.entries(evalSources)) {
        try {
          const evalFn = new Function('return (' + info.evalSource + ')')() as (inputs: Record<string, any>) => Record<string, any>;
          const onTickFn = info.onTickSource
            ? new Function('return (' + info.onTickSource + ')')() as (inputs: Record<string, any>) => Record<string, any>
            : undefined;
          registerCircuitEval(name, {
            inputNames: info.inputNames,
            outputNames: info.outputNames,
            evalFn,
            onTickFn,
            stateKeys: info.stateKeys,
          });
        } catch (e) {
          console.warn(`[sandbox] Failed to register eval for '${name}':`, e);
        }
      }
    }

    // Find or build a library. If any slot has one (from source compile), reuse it.
    // Otherwise build a fresh library just for this compile.
    let lib: { resolveCircuit(name: string): Circuit | undefined; addCircuit?(c: Circuit): void } | null = null;
    for (const s of slots.values()) {
      if (s.library) { lib = s.library; break; }
    }
    if (!lib) {
      // Build a library from the provided circuits
      const circuitMap = new Map<string, Circuit>();
      lib = {
        resolveCircuit: (name) => circuitMap.get(name),
        addCircuit: (c: Circuit) => { circuitMap.set(c.name, c); },
      };
    }

    // Add all provided circuits to the library
    for (const c of libraryCircuits) {
      if (lib.addCircuit) lib.addCircuit(c);
    }
    if (lib.addCircuit) lib.addCircuit(circuit);

    const flatCircuit = elaborate(circuit, lib);
    const sim = createSimulator(flatCircuit, { componentLibrary: lib });

    const slot = getSlot(slotId);
    slot.simulator = sim;
    slot.library = lib;

    const portValues = portValuesToObject(sim.getPortValues());
    respond(id, { type: 'compiled-ir', portValues });
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

  // Pin parent origin on first valid message. Reject any later message from
  // a different origin — prevents a malicious iframe peer from impersonating
  // the parent once a legit session is established.
  if (parentOrigin === null) {
    parentOrigin = event.origin;
  } else if (event.origin !== parentOrigin) {
    return;
  }

  switch (req.type) {
    case 'compile':
      handleCompile(req.id, req.source, req.slot);
      break;
    case 'compile-ir':
      handleCompileIR(req.id, req.circuit, req.libraryCircuits, req.slot, req.evalSources);
      break;
    case 'tick':
      handleTick(req.id, req.inputs, req.slot);
      break;
    case 'simulate':
      handleSimulate(req.id, req.ticks, req.source, req.inputs, req.memoryData, req.slot);
      break;
    case 'reset':
      handleReset(req.id, req.slot);
      break;
    case 'set-node':
      handleSetNode(req.id, req.nodeId, req.value, req.slot);
      break;
    case 'dispose':
      handleDispose(req.id, req.slot);
      break;
  }
});

// Signal that the sandbox is ready. We can't know the parent's origin yet
// (no inbound message has arrived), so this single initial signal uses '*'.
// Payload carries no sensitive data — just a ready bit. All subsequent
// traffic is pinned to the origin captured from the parent's first message.
parent.postMessage({ type: 'ready' }, '*');
