/**
 * Sandbox iframe main thread — IFRAME side of the bridge.
 *
 * The host-side counterpart lives at `packages/ui/src/sandbox/useSandbox.ts`.
 * This file runs *inside* the cross-origin iframe; it receives postMessage
 * commands from the host and drives `@simten/core/simulator` (which runs in
 * the worker for compile/simulate, on iframe-main for tick/reset/set-node).
 * See `apps/web/content/docs/architecture.mdx` → "Runtime topology".
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
 *   ⚠ Known gap (tracked separately): when a circuit uses `eval:` / `onTick:`
 *   lambdas, registerCircuitEval() reconstructs them via new Function() and
 *   the simulator invokes them during tick — on THIS thread, not the worker.
 *   A user lambda containing `while(1){}` will hang iframe-main and escape
 *   the 5s WORKER_TIMEOUT_MS / terminate() recovery. The fix requires either
 *   moving sim+tick into the worker (blocked on canvas-state recovery, #51)
 *   or routing each eval invocation through the worker per-tick. Until then,
 *   the threat model for eval/onTick lambdas is "trusted code" — not the same
 *   guarantee as the rest of the sandbox.
 *
 * Security guarantees:
 *   IN:  arbitrary untrusted TypeScript string
 *   OUT: plain JSON only — no functions, no Maps, no class instances
 *
 * Why the persistent sim lives HERE and not in the worker:
 *   The worker is killable (terminate() is the only recovery from a runaway
 *   `while(true){}` in user code). If the canvas sim shared that thread,
 *   every bad loop would wipe switch positions, cycle count, and snapshots.
 *   Keeping it on iframe-main — which never runs user code and so can't
 *   hang — makes runaway recovery free: a bad loop costs 5 seconds and an
 *   error toast, not the session. This is structural crash isolation, not
 *   a security distinction (both threads share the same origin + CSP).
 *
 * ⚠ Do NOT move the persistent sim into the worker without first solving
 *   canvas-state recovery (snapshot-before-execute / restore-on-terminate).
 *   See issue #51.
 *
 * Snapshots live inside the slot (don't cross postMessage) to avoid
 * serialization cost per tick — see SlotState.snapshots.
 */

import type { BitValue, BusValue, Circuit, SimulatorSnapshot } from '@simten/core';
import { createSimulator, elaborate } from '@simten/core';
import { registerCircuitEval } from '@simten/core/circuit';
import { captureEnvironmentalState, type EnvironmentalStateValue } from '@simten/core/simulator';

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
  | {
      id: string;
      type: 'compile-ir';
      circuit: Circuit;
      libraryCircuits: Circuit[];
      slot: string;
      evalSources?: Record<string, EvalSource>;
      snapshot?: boolean;
    }
  | {
      id: string;
      type: 'tick';
      inputs?: Record<string, number | boolean>;
      slot?: string;
      snapshot?: boolean;
    }
  | {
      id: string;
      type: 'tick-n';
      n: number;
      inputs?: Record<string, number | boolean>;
      slot?: string;
      snapshot?: boolean;
    }
  | {
      id: string;
      type: 'scan-port';
      addrNodeId: string;
      valuePortKey: string;
      count: number;
      slot?: string;
    }
  | {
      id: string;
      type: 'simulate';
      source?: string;
      ticks: number;
      inputs?: Record<string, number | boolean>;
      memoryData?: Record<string, Record<string, number>>;
      slot?: string;
    }
  | { id: string; type: 'reset'; slot?: string }
  | {
      id: string;
      type: 'set-node';
      nodeId: string;
      value: number | boolean | Map<number, number>;
      slot?: string;
      snapshot?: boolean;
    }
  | { id: string; type: 'snapshot'; slot?: string }
  | { id: string; type: 'restore'; slot?: string; snapshotId: number }
  | { id: string; type: 'prune-snapshots'; slot?: string; keepAfterId: number }
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
/**
 * A full time-travel snapshot is (simulator engine state) + (environmental
 * state). The engine captures sequential registers + port values, but
 * combinational primitives driven by `node.arguments` (Switch, Button, Input —
 * anything with metadata.interactiveArg) are NOT part of engine state. They
 * live as arguments on the circuit's nodes, which the engine doesn't touch on
 * snapshot/restore. The host expects rewind to restore what the user saw —
 * including switch positions — so we must capture and restore both halves.
 * See packages/core/src/simulator/environmental-state.ts.
 */
interface FullSnapshot {
  sim: SimulatorSnapshot;
  env: Map<string, EnvironmentalStateValue>;
}

interface SlotState {
  simulator: ReturnType<typeof createSimulator> | null;
  library: {
    resolveCircuit(name: string): Circuit | undefined;
    addCircuit?(c: Circuit): void;
  } | null;
  source: string;
  /**
   * The elaborated flat circuit. Kept so we can capture/restore environmental
   * state (node.arguments for Switch/Button/Input) on snapshot/restore —
   * environmental-state.ts walks these nodes to find interactive args.
   */
  flatCircuit: {
    nodes: Array<{ id: string; primitiveType: string; arguments: Record<string, unknown> }>;
  } | null;
  /**
   * Set of nodeIds whose simulation state is exposed across the sandbox
   * boundary every tick. A node qualifies if it has at least one direct
   * connection to a node whose component is tagged `meta.synthesizable: false`
   * (i.e. a peripheral). This models memory-mapped I/O: a RAM wired to a
   * Screen shares its bus with the display controller, so its contents are
   * observable. Registers/FSMs with no peripheral connection stay internal.
   * Computed once at compile time; iterated each tick.
   */
  peripheralBusNodes: Set<string>;
  /**
   * Saved simulator snapshots for time-travel. Keyed by an auto-incrementing
   * ID handed back to the host; the host stores only the IDs and passes them
   * back to restore. Kept inside the sandbox so snapshots never need to cross
   * the postMessage boundary (saves ~all serialization cost per tick).
   * Pruned by the host via 'prune-snapshots' when its cap is reached.
   */
  snapshots: Map<number, FullSnapshot>;
  nextSnapshotId: number;
}

const slots = new Map<string, SlotState>();
const DEFAULT_SLOT = 'default';

function getSlot(id: string): SlotState {
  let s = slots.get(id);
  if (!s) {
    s = {
      simulator: null,
      library: null,
      source: '',
      flatCircuit: null,
      peripheralBusNodes: new Set(),
      snapshots: new Map(),
      nextSnapshotId: 1,
    };
    slots.set(id, s);
  }
  return s;
}

/**
 * Take a full snapshot of the slot: simulator engine state (sequential regs +
 * port values) plus environmental state (Switch/Button/Input `node.arguments`
 * for any primitive tagged `metadata.interactiveArg`). Returns the generated
 * ID. No-op + undefined for circuits with no snapshotable state (purely
 * combinational with no interactive nodes — sim.snapshot() throws and env
 * capture is harmlessly empty).
 */
function takeSnapshot(slot: SlotState): number | undefined {
  if (!slot.simulator) return undefined;
  try {
    const sim = slot.simulator.snapshot();
    // Walk the FlatCircuit for interactive args. We can't use core's
    // captureEnvironmentalState directly: it reads `node.componentRef` on a
    // pre-elaboration Circuit, but post-elaboration FlatNode has `primitiveType`.
    const env = new Map<string, EnvironmentalStateValue>();
    if (slot.flatCircuit && slot.library) {
      for (const node of slot.flatCircuit.nodes) {
        const def = slot.library.resolveCircuit(node.primitiveType);
        const interactiveArg = (def as { metadata?: { interactiveArg?: string } } | undefined)
          ?.metadata?.interactiveArg;
        if (!interactiveArg) continue;
        env.set(node.id, node.arguments[interactiveArg] as EnvironmentalStateValue);
      }
    }
    const id = slot.nextSnapshotId++;
    slot.snapshots.set(id, { sim, env });
    return id;
  } catch {
    // Combinational-only + no interactive: nothing to snapshot.
    return undefined;
  }
}

/**
 * One-shot scan over a flat circuit's connections to find every node that's
 * on the bus of a peripheral (a component with `meta.synthesizable === false`).
 *
 * Runs once per compile — the result is cached on the slot and iterated each
 * tick when snapshotting peripheral state. O(connections); for any realistic
 * circuit this is microseconds.
 */
function computePeripheralBusNodes(
  flatCircuit: {
    nodes: { id: string; primitiveType: string }[];
    connections: { source: { nodeId: string }; target: { nodeId: string } }[];
  },
  library: { resolveCircuit(name: string): Circuit | undefined },
): Set<string> {
  const isPeripheral = (primitiveType: string): boolean => {
    const def = library.resolveCircuit(primitiveType);
    return def?.metadata?.synthesizable === false;
  };

  // Index primitive types by nodeId (O(N))
  const typeByNode = new Map<string, string>();
  for (const node of flatCircuit.nodes) typeByNode.set(node.id, node.primitiveType);

  // A node qualifies if any of its connections touches a peripheral node.
  const exposed = new Set<string>();
  for (const conn of flatCircuit.connections) {
    const srcType = typeByNode.get(conn.source.nodeId);
    const tgtType = typeByNode.get(conn.target.nodeId);
    const srcPeri = srcType && isPeripheral(srcType);
    const tgtPeri = tgtType && isPeripheral(tgtType);
    if (srcPeri) exposed.add(conn.target.nodeId);
    if (tgtPeri) exposed.add(conn.source.nodeId);
    // Also expose peripheral nodes themselves — their own state is the
    // primary thing we want to display (Console text, UART_TX buffer, etc.)
    if (srcPeri) exposed.add(conn.source.nodeId);
    if (tgtPeri) exposed.add(conn.target.nodeId);
  }
  return exposed;
}

/**
 * Snapshot the current state of every peripheral-bus node for the given slot.
 * Runs each tick; cost is O(P) where P ≈ 1-5 for a typical demo.
 */
function snapshotPeripheralState(slot: SlotState): Record<string, unknown> | undefined {
  if (!slot.simulator || slot.peripheralBusNodes.size === 0) return undefined;
  const seqState = slot.simulator.getState();
  if (!seqState) return undefined;
  const out: Record<string, unknown> = {};
  for (const nodeId of slot.peripheralBusNodes) {
    const v = seqState.currentState.get(nodeId);
    if (v !== undefined) out[nodeId] = v;
  }
  return out;
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
  const workerResult = (await delegateToWorker({ id, type: 'compile', source })) as {
    type: string;
    error?: string;
    circuits?: Circuit[];
    libraryCircuits?: Circuit[];
    evalSources?: Record<
      string,
      {
        evalSource: string;
        onTickSource?: string;
        inputNames: string[];
        outputNames: string[];
        stateKeys?: string[];
      }
    >;
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
        const evalFn = new Function('return (' + info.evalSource + ')')() as (
          inputs: Record<string, any>,
        ) => Record<string, any>;
        const onTickFn = info.onTickSource
          ? (new Function('return (' + info.onTickSource + ')')() as (
              inputs: Record<string, any>,
            ) => Record<string, any>)
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
      getAllPrimitiveNames: () =>
        [...circuitMap.values()]
          .filter((c) => c.implementation?.kind === 'primitive')
          .map((c) => c.name),
      addCircuit: (c: Circuit) => {
        circuitMap.set(c.name, c);
      },
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
    slot.flatCircuit = flatCircuit;
    slot.peripheralBusNodes = computePeripheralBusNodes(flatCircuit, library);
    // Recompile is a fresh timeline — prior snapshots refer to the old sim.
    slot.snapshots.clear();

    const portValues = portValuesToObject(sim.getPortValues());

    respond(id, {
      type: 'compiled',
      circuits,
      libraryCircuits,
      portValues,
      peripheralState: snapshotPeripheralState(slot),
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleTick(
  id: string,
  inputs?: Record<string, number | boolean>,
  slotId: string = DEFAULT_SLOT,
  snapshot?: boolean,
) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'. Call compile first.`);
    return;
  }
  try {
    if (inputs) applyInputs(sim, inputs);
    const result = sim.tick();
    const snapshotId = snapshot ? takeSnapshot(slot) : undefined;
    respond(id, {
      type: 'ticked',
      portValues: portValuesToObject(result.portValues),
      cycle: sim.getMetrics().totalTicks,
      peripheralState: snapshotPeripheralState(slot),
      snapshotId,
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

// Batched debug-port scan. Drives `addrNodeId` through 0..count-1, samples
// `valuePortKey` after each combinational re-eval, returns the array.
// Used by JTAG-style register scanners (RV32I debugger) — one round-trip
// per frame instead of one per register.
//
// This doesn't advance the clock — reads are purely combinational, mirroring
// how real debug hardware observes architectural state while the core is
// halted (and how it can interleave with normal execution in a properly
// dual-ported regfile).
function handleScanPort(
  id: string,
  addrNodeId: string,
  valuePortKey: string,
  count: number,
  slotId: string = DEFAULT_SLOT,
) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  try {
    const n = Math.max(0, count | 0);
    const values: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      sim.setNode(addrNodeId, i);
      sim.runCombinational();
      const v = sim.getPortValues().get(valuePortKey);
      values[i] = typeof v === 'number' ? v : v ? 1 : 0;
    }
    respond(id, { type: 'scanned-port', values });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

// Advance the simulator by N cycles in one round-trip. Returns only the final
// port values and one peripheral-state snapshot. Used by demos that need high
// tick rates (raster frames) — one postMessage instead of N.
function handleTickN(
  id: string,
  n: number,
  inputs?: Record<string, number | boolean>,
  slotId: string = DEFAULT_SLOT,
  snapshot?: boolean,
) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'. Call compile first.`);
    return;
  }
  try {
    if (inputs) applyInputs(sim, inputs);
    let last: ReturnType<typeof sim.tick> | null = null;
    const count = Math.max(0, n | 0);
    for (let i = 0; i < count; i++) last = sim.tick();
    const snapshotId = snapshot ? takeSnapshot(slot) : undefined;
    respond(id, {
      type: 'ticked-n',
      portValues: last
        ? portValuesToObject(last.portValues)
        : portValuesToObject(sim.getPortValues()),
      cycle: sim.getMetrics().totalTicks,
      peripheralState: snapshotPeripheralState(slot),
      snapshotId,
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
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  try {
    sim.reset();
    // Reset is a user-visible "start over" — drop all history so time-travel
    // begins fresh from the post-reset state.
    slot.snapshots.clear();
    const portValues = portValuesToObject(sim.getPortValues());
    respond(id, { type: 'reset', portValues, peripheralState: snapshotPeripheralState(slot) });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleSetNode(
  id: string,
  nodeId: string,
  value: number | boolean | Map<number, number>,
  slotId: string = DEFAULT_SLOT,
  snapshot?: boolean,
) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  try {
    // Accept Map values for ROM/RAM memory loading
    sim.setNode(nodeId, value as any);
    sim.runCombinational();
    const portValues = portValuesToObject(sim.getPortValues());
    const snapshotId = snapshot ? takeSnapshot(slot) : undefined;
    respond(id, {
      type: 'set-node',
      portValues,
      peripheralState: snapshotPeripheralState(slot),
      snapshotId,
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handleDispose(id: string, slotId: string) {
  slots.delete(slotId);
  respond(id, { type: 'disposed' });
}

// ============================================================================
// Time-travel snapshot / restore / prune handlers
// ============================================================================

function handleSnapshot(id: string, slotId: string = DEFAULT_SLOT) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  const snapshotId = takeSnapshot(slot);
  respond(id, { type: 'snapshot', snapshotId });
}

function handleRestore(id: string, snapshotId: number, slotId: string = DEFAULT_SLOT) {
  const slot = slots.get(slotId);
  const sim = slot?.simulator;
  if (!sim || !slot) {
    respondError(id, `No circuit compiled for slot '${slotId}'.`);
    return;
  }
  const full = slot.snapshots.get(snapshotId);
  if (!full) {
    respondError(id, `Snapshot ${snapshotId} not found for slot '${slotId}'.`);
    return;
  }
  try {
    // Restore the engine's sequential + port state first, then re-apply the
    // environmental state (Switch/Button/Input values).
    //
    // Why we can't just call `restoreEnvironmentalState` from core and be
    // done: the simulator keeps a numeric cache of node-argument values that
    // it reads at eval time. Mutating `node.arguments` directly updates the
    // circuit object but NOT the numeric cache — subsequent evals would still
    // use the stale value. The only API that invalidates both is `sim.setNode`.
    //
    // Also: `captureEnvironmentalState` produces `undefined` for primitives
    // whose interactive arg was never explicitly set (e.g. a Switch at its
    // implicit default). We can't pass `undefined` to `sim.setNode`, so we
    // fall back to 0 — the universal "off" for Switch/Button/Input.
    sim.restore(full.sim);
    if (slot.flatCircuit && slot.library) {
      for (const node of slot.flatCircuit.nodes) {
        const def = slot.library.resolveCircuit(node.primitiveType);
        const interactiveArg = (def as { metadata?: { interactiveArg?: string } } | undefined)
          ?.metadata?.interactiveArg;
        if (!interactiveArg) continue;
        const saved = full.env.get(node.id);
        const value = saved === undefined ? 0 : saved;
        sim.setNode(node.id, value as number | boolean);
      }
    }
    sim.runCombinational();
    respond(id, {
      type: 'restored',
      portValues: portValuesToObject(sim.getPortValues()),
      cycle: full.sim.cycleCount,
      peripheralState: snapshotPeripheralState(slot),
    });
  } catch (e) {
    respondError(id, e instanceof Error ? e.message : String(e));
  }
}

function handlePruneSnapshots(id: string, keepAfterId: number, slotId: string = DEFAULT_SLOT) {
  const slot = slots.get(slotId);
  if (!slot) {
    // Silently succeed — host may prune a slot that was never touched.
    respond(id, { type: 'pruned' });
    return;
  }
  // Drop every snapshot with id <= keepAfterId. Callers use this to cap
  // history at N entries on the host side; anything older than the oldest
  // ID the host is still referencing can safely go.
  for (const key of [...slot.snapshots.keys()]) {
    if (key <= keepAfterId) slot.snapshots.delete(key);
  }
  respond(id, { type: 'pruned' });
}

/**
 * Compile from Circuit IR (not source code).
 * Used for the auto-harnessed circuit — the harness is built client-side
 * as Circuit IR and sent here for simulation.
 * Uses the library from the last executeCircuitCode (has eval functions).
 */
function handleCompileIR(
  id: string,
  circuit: Circuit,
  libraryCircuits: Circuit[],
  slotId: string,
  evalSources?: Record<string, EvalSource>,
  snapshot?: boolean,
) {
  try {
    // If evalSources are provided, reconstruct the functions and register them.
    // This is how the embed transfers eval functions from the main frame to the sandbox.
    if (evalSources) {
      for (const [name, info] of Object.entries(evalSources)) {
        try {
          const evalFn = new Function('return (' + info.evalSource + ')')() as (
            inputs: Record<string, any>,
          ) => Record<string, any>;
          const onTickFn = info.onTickSource
            ? (new Function('return (' + info.onTickSource + ')')() as (
                inputs: Record<string, any>,
              ) => Record<string, any>)
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
    let lib: {
      resolveCircuit(name: string): Circuit | undefined;
      addCircuit?(c: Circuit): void;
    } | null = null;
    for (const s of slots.values()) {
      if (s.library) {
        lib = s.library;
        break;
      }
    }
    if (!lib) {
      // Build a library from the provided circuits
      const circuitMap = new Map<string, Circuit>();
      lib = {
        resolveCircuit: (name) => circuitMap.get(name),
        addCircuit: (c: Circuit) => {
          circuitMap.set(c.name, c);
        },
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
    slot.flatCircuit = flatCircuit;
    slot.peripheralBusNodes = computePeripheralBusNodes(flatCircuit, lib);
    // Recompile is a fresh timeline — any prior history is meaningless against
    // the new simulator instance.
    slot.snapshots.clear();

    const portValues = portValuesToObject(sim.getPortValues());
    const snapshotId = snapshot ? takeSnapshot(slot) : undefined;
    respond(id, {
      type: 'compiled-ir',
      portValues,
      peripheralState: snapshotPeripheralState(slot),
      snapshotId,
    });
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
      handleCompileIR(
        req.id,
        req.circuit,
        req.libraryCircuits,
        req.slot,
        req.evalSources,
        req.snapshot,
      );
      break;
    case 'tick':
      handleTick(req.id, req.inputs, req.slot, req.snapshot);
      break;
    case 'tick-n':
      handleTickN(req.id, req.n, req.inputs, req.slot, req.snapshot);
      break;
    case 'scan-port':
      handleScanPort(req.id, req.addrNodeId, req.valuePortKey, req.count, req.slot);
      break;
    case 'simulate':
      handleSimulate(req.id, req.ticks, req.source, req.inputs, req.memoryData, req.slot);
      break;
    case 'reset':
      handleReset(req.id, req.slot);
      break;
    case 'set-node':
      handleSetNode(req.id, req.nodeId, req.value, req.slot, req.snapshot);
      break;
    case 'snapshot':
      handleSnapshot(req.id, req.slot);
      break;
    case 'restore':
      handleRestore(req.id, req.snapshotId, req.slot);
      break;
    case 'prune-snapshots':
      handlePruneSnapshots(req.id, req.keepAfterId, req.slot);
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
