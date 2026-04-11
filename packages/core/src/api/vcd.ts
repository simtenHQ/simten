/**
 * VCD (Value Change Dump) export
 *
 * Converts simulation signal data into standard hierarchical VCD format,
 * readable by GTKWave and other EDA tools.
 *
 * Emits full module hierarchy mirroring the circuit structure, including
 * all internal node ports — equivalent to Verilog's $dumpvars(0, top).
 */

import type { FlatNode } from '../types/simulator.js';
import type { BitValue, BusValue } from '../types/circuit.js';

export interface VCDExportParams {
  /** Top-level circuit name */
  circuit: string;
  /** Flat nodes from elaborated circuit — used to build hierarchy */
  nodes: FlatNode[];
  /** Top-level input port names */
  topLevelInputs: string[];
  /** Top-level output port names */
  topLevelOutputs: string[];
  /** Per-tick full port value snapshots */
  portValuesByTick: Array<ReadonlyMap<string, BitValue | BusValue>>;
  /** Number of ticks */
  ticks: number;
}

// ============================================================================
// Hierarchy tree
// ============================================================================

interface VCDVar {
  /** VCD identifier string */
  id: string;
  /** Port name (last path segment) */
  name: string;
  /** Full portValues key: "nodeId.portName" */
  key: string;
  width: number;
  isBit: boolean;
}

interface ScopeTree {
  name: string;
  vars: VCDVar[];
  children: Map<string, ScopeTree>;
}

function makeScope(name: string): ScopeTree {
  return { name, vars: [], children: new Map() };
}

/**
 * Determine bit width for a signal from its values across all ticks.
 * If all values are 0/1/true/false → 1-bit wire.
 * Otherwise → 32-bit wire.
 */
function inferWidth(key: string, portValuesByTick: Array<ReadonlyMap<string, BitValue | BusValue>>): { isBit: boolean; width: number } {
  for (const tick of portValuesByTick) {
    const v = tick.get(key);
    if (v === undefined) continue;
    if (typeof v === 'boolean') return { isBit: true, width: 1 };
    if (v !== 0 && v !== 1) return { isBit: false, width: 32 };
  }
  return { isBit: true, width: 1 };
}

function formatValue(v: BitValue | BusValue | undefined, isBit: boolean, width: number, id: string): string {
  const num = v === undefined ? 0 : (typeof v === 'boolean' ? (v ? 1 : 0) : v);
  if (isBit) return `${num ? 1 : 0}${id}`;
  return `b${(num >>> 0).toString(2).padStart(width, '0')} ${id}`;
}

// VCD identifier generator — produces !, ", #, ... then multi-char sequences
function makeIdGenerator(): () => string {
  let n = 0;
  return () => {
    let id = '';
    let val = n++;
    do {
      id = String.fromCharCode(33 + (val % 94)) + id;
      val = Math.floor(val / 94) - 1;
    } while (val >= 0);
    return id;
  };
}

// ============================================================================
// Build scope tree from flat nodes
// ============================================================================

function buildScopeTree(
  circuit: string,
  nodes: FlatNode[],
  topLevelInputs: string[],
  topLevelOutputs: string[],
  portValuesByTick: Array<ReadonlyMap<string, BitValue | BusValue>>,
  nextId: () => string,
): ScopeTree {
  const root = makeScope(circuit);

  // Add top-level ports directly under root scope
  for (const name of topLevelInputs) {
    const key = `__top__.${name}`;
    const { isBit, width } = inferWidth(key, portValuesByTick);
    root.vars.push({ id: nextId(), name, key, width, isBit });
  }
  for (const name of topLevelOutputs) {
    if (topLevelInputs.includes(name)) continue;
    const key = `__top__.${name}`;
    const { isBit, width } = inferWidth(key, portValuesByTick);
    root.vars.push({ id: nextId(), name, key, width, isBit });
  }

  // Add each node as a nested scope
  for (const node of nodes) {
    // node.id is path-prefixed: "reg", "cpu.alu", "cpu.alu.adder1"
    const pathParts = node.id.split('.');

    // Navigate/create scope tree
    let scope = root;
    for (const part of pathParts) {
      if (!scope.children.has(part)) {
        scope.children.set(part, makeScope(part));
      }
      scope = scope.children.get(part)!;
    }

    // Add ports as vars in this scope
    const allPorts = [...node.inputs, ...node.outputs];
    for (const port of allPorts) {
      const key = `${node.id}.${port.name}`;
      const { isBit, width } = inferWidth(key, portValuesByTick);
      scope.vars.push({ id: nextId(), name: port.name, key, width, isBit });
    }
  }

  return root;
}

// ============================================================================
// Emit VCD
// ============================================================================

function emitScopeDeclarations(scope: ScopeTree, lines: string[]): void {
  lines.push(`$scope module ${scope.name} $end`);
  for (const v of scope.vars) {
    lines.push(`$var wire ${v.width} ${v.id} ${v.name} $end`);
  }
  for (const child of scope.children.values()) {
    emitScopeDeclarations(child, lines);
  }
  lines.push(`$upscope $end`);
}

function collectAllVars(scope: ScopeTree, out: VCDVar[]): void {
  for (const v of scope.vars) out.push(v);
  for (const child of scope.children.values()) collectAllVars(child, out);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Export simulation traces to hierarchical VCD format.
 *
 * Equivalent to Verilog's $dumpvars(0, top) — captures all signals at all
 * hierarchy levels. Only emits value changes (not every tick), per VCD spec.
 */
export function exportVCD({
  circuit,
  nodes,
  topLevelInputs,
  topLevelOutputs,
  portValuesByTick,
  ticks,
}: VCDExportParams): string {
  const nextId = makeIdGenerator();
  const root = buildScopeTree(circuit, nodes, topLevelInputs, topLevelOutputs, portValuesByTick, nextId);

  // Collect all vars in declaration order (for value lookup)
  const allVars: VCDVar[] = [];
  collectAllVars(root, allVars);

  const lines: string[] = [];

  // Header
  lines.push(`$date ${new Date().toUTCString()} $end`);
  lines.push(`$timescale 1ns $end`);

  // Hierarchical scope declarations
  emitScopeDeclarations(root, lines);

  lines.push(`$enddefinitions $end`);

  // Initial values at t=0
  lines.push(`#0`);
  lines.push(`$dumpvars`);
  const tick0 = portValuesByTick[0];
  for (const v of allVars) {
    const val = tick0?.get(v.key);
    lines.push(formatValue(val, v.isBit, v.width, v.id));
  }
  lines.push(`$end`);

  // Emit changes at each subsequent tick
  for (let t = 1; t < ticks; t++) {
    const curr = portValuesByTick[t];
    const prev = portValuesByTick[t - 1];
    const changes: string[] = [];

    for (const v of allVars) {
      const currVal = curr?.get(v.key);
      const prevVal = prev?.get(v.key);
      if (currVal !== prevVal) {
        changes.push(formatValue(currVal, v.isBit, v.width, v.id));
      }
    }

    if (changes.length > 0) {
      lines.push(`#${t}`);
      lines.push(...changes);
    }
  }

  lines.push(`#${ticks}`);

  return lines.join('\n');
}
