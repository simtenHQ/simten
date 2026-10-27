/**
 * Verilog exporter.
 *
 * Converts a Circuit IR to synthesizable structural Verilog.
 *
 * Simulator contract:
 * - Cycle-based synchronous digital logic
 * - One clock domain (no async crossings, no derived clocks)
 * - All operations unsigned (overflow wraps)
 * - Memory is write-first
 * - No combinational loops
 */

import { type BehaviorTable, type Library, libraryOf } from '../circuit/behavior.js';
import type { Circuit } from '../circuit/builder-types.js';
import { internalsOf } from '../circuit/internals.js';
import type { CircuitIR, MemoryValue, PortType } from '../ir/circuit-ir.js';
import { memoryContentsToMap } from '../ir/memory-contents.js';
import { elaborate } from '../simulator/elaboration.js';
import type {
  CircuitDefinitions,
  FlatCircuit,
  FlatConnection,
  FlatNode,
} from '../simulator/types.js';
import {
  type PrimitiveContext,
  type PrimitiveWires,
  type StateInit,
  sanitizeId,
} from './emitters/helpers.js';
import type { SynthValidation } from './eval-synth.js';
import {
  emitPrimitive,
  isSequentialPrimitive,
  isSinkPrimitive,
  usesStdMapping,
} from './primitive-map.js';
import type { ExportResult, VerilogExportOptions } from './types.js';
import { INLINE_MEMORY_THRESHOLD } from './types.js';

type ResolvedOptions = Required<VerilogExportOptions> & { behaviors: BehaviorTable };

const DEFAULT_OPTIONS: Required<VerilogExportOptions> = {
  mode: 'flat',
  topModuleName: '',
  clockName: 'clk',
  includeTimescale: true,
  target: 'simulation',
  inlineMemoryThreshold: INLINE_MEMORY_THRESHOLD,
};

const RESET_NAME = 'rst_n';

/** Std primitives whose output is as wide as their widest data input. */
const PASS_THROUGH = new Set(['Mux', 'Mux2', 'Buffer', 'Probe']);

/** Primitives registered once per width, whose port types are already exact. */
const PER_WIDTH = /^(Splitter|Combiner)_\d+w$/;

function widthOf(pt: PortType): number {
  return pt.kind === 'bus' ? pt.width : 1;
}

function portTypeToVerilog(pt: PortType): string {
  if (pt.kind === 'bit') return '';
  return `[${pt.width - 1}:0] `;
}

/**
 * Collect preloaded memory state from the component definition for a flat
 * node. Looks up `node.primitiveType` in the definitions and extracts memory
 * state blocks that have non-empty `initialValue.data` contents. Returned
 * array is handed to primitive-map via `PrimitiveContext.stateInits` so
 * each primitive can emit `initial begin …` using its own reg-name
 * convention. Circuits without memory state (or with empty init) yield
 * `undefined`, which primitives treat as a no-op.
 */
function collectStateInits(
  node: FlatNode,
  definitions: CircuitDefinitions,
): StateInit[] | undefined {
  const def = definitions.resolveCircuit(node.primitiveType);
  if (!def?.state || def.state.length === 0) return undefined;

  const inits: StateInit[] = [];
  for (const block of def.state) {
    if (block.stateType.kind !== 'memory') continue;
    const iv = block.initialValue as MemoryValue | undefined;
    if (!iv?.data) continue;
    const data = memoryContentsToMap(iv.data);
    if (data.size === 0) continue;
    const width = iv.dataWidth ?? block.stateType.dataWidth ?? 8;
    inits.push({ stateName: block.name, data, width });
  }
  return inits.length > 0 ? inits : undefined;
}

/**
 * Export a circuit's IR to Verilog (flat mode), for callers that have IR but
 * no built circuit: the editor page, and tests that build IR. The library's
 * behavior is what a primitive with no hand-written mapping is translated
 * from; one with neither is reported in `unsupported`.
 * Elaborates the circuit first, then emits a single flat module.
 */
export function exportVerilogFromIR(
  circuit: CircuitIR,
  library: Library,
  options?: VerilogExportOptions,
): ExportResult {
  return exportWithReasons(circuit, library, options).result;
}

/** The export, and why each unsupported primitive type couldn't be exported. */
function exportWithReasons(
  circuit: CircuitIR,
  { definitions, behaviors }: Library,
  options?: VerilogExportOptions,
): { result: ExportResult; reasons: Map<string, string> } {
  const opts: ResolvedOptions = { ...DEFAULT_OPTIONS, ...options, behaviors };
  const flatCircuit = elaborate(circuit, definitions, false, { expandReferences: true });
  return emitFlatModule(circuit, flatCircuit, definitions, opts);
}

/**
 * Export a circuit to Verilog (flat mode): one module with every node
 * flattened to primitives. A primitive with no hand-written mapping has its
 * own `eval` translated.
 */
export function exportVerilogFlat(top: Circuit, options?: VerilogExportOptions): ExportResult {
  return exportVerilogFromIR(internalsOf(top).ir, libraryOf(top), options);
}

/**
 * Export a circuit to Verilog (auto mode — flat by default).
 *
 * Returns `{ verilog, files }`: `verilog` is the `.v` source; `files` is a
 * map of sidecar filename → contents for any `$readmemh` hex files the
 * exporter emitted for large memories. Callers should write each file
 * next to the `.v` for the Verilog to compile.
 */
export function exportVerilog(top: Circuit, options?: VerilogExportOptions): ExportResult {
  // TODO: hierarchical mode (emit sub-modules). For now every mode is flat.
  return exportVerilogFlat(top, options);
}

/**
 * Whether `exportVerilog(top)` translates every primitive in the circuit:
 * each has a hand-written mapping or an `eval` the exporter can translate.
 * Each error names a primitive that can't be exported and, when its `eval`
 * is the reason, what in it can't be translated.
 */
export function checkSynthesizable(top: Circuit): SynthValidation {
  const { reasons } = exportWithReasons(internalsOf(top).ir, libraryOf(top));
  const errors = [...reasons].map(([name, reason]) => `${name}: ${reason}`);
  return { valid: errors.length === 0, errors };
}

// ── Flat module emission ────────────────────────────────────────────────

function emitFlatModule(
  circuit: CircuitIR,
  flat: FlatCircuit,
  definitions: CircuitDefinitions,
  opts: ResolvedOptions,
): { result: ExportResult; reasons: Map<string, string> } {
  const moduleName = opts.topModuleName || sanitizeId(circuit.name);
  /** primitiveType -> node ids the exporter had no mapping for. */
  const unsupported: Record<string, string[]> = {};
  /** primitiveType -> why (the first node's reason). */
  const reasons = new Map<string, string>();
  // Sidecar files (hex) filled in by primitive-map as it emits memory init
  // above the inline threshold. Drained into ExportResult.files at the end.
  const sidecarFiles: Record<string, string> = {};
  const inlineMemoryThreshold = opts.inlineMemoryThreshold ?? INLINE_MEMORY_THRESHOLD;
  const lines: string[] = [];

  if (opts.includeTimescale) {
    lines.push('`timescale 1ns / 1ps');
    lines.push('');
  }

  const TOP = '__top__';

  // Detect if circuit needs a clock (and matching reset).
  // Kept as separate flags so they can diverge later (e.g. clock-only debug
  // wrappers) without splitting the call site.
  // A primitive translated from its behavior can need them too; see below.
  let needsClock = flat.nodes.some((n) => isSequentialPrimitive(n.primitiveType));

  // Whether each primitive is std's own, so its hand-written mapping (and the
  // name-keyed handling below) applies. One answer per name.
  const stdByName = new Map<string, boolean>();
  const isStd = (type: string) => {
    let std = stdByName.get(type);
    if (std === undefined) {
      std = usesStdMapping(type, opts.behaviors);
      stdByName.set(type, std);
    }
    return std;
  };

  // Filter to logic nodes only (I/O becomes module ports via topLevelInputs/Outputs)
  const logicNodes = flat.nodes.filter(
    (n) => !(isSinkPrimitive(n.primitiveType) && isStd(n.primitiveType)),
  );

  // ── Build wire map (connection source → wire name) ─────────────────
  const wireMap = new Map<string, string>(); // "nodeId.portName" → wire name
  const wireDeclarations = new Map<string, string>(); // wire name → declaration

  // Map top-level ports to their port names directly
  for (const input of flat.topLevelInputs) {
    wireMap.set(`${TOP}.${input.name}`, input.name);
  }
  for (const output of flat.topLevelOutputs) {
    wireMap.set(`${TOP}.${output.name}`, output.name);
  }

  // Build a lookup for resolved port types from flat nodes.
  // For primitives with a 'width' argument (Constant, Register, etc.),
  // override the port type if the argument specifies a wider width than
  // the static port definition. The elaborator doesn't resolve parameterised
  // widths into port types, so the exporter must do it.
  // Control signals: port names that are always 1-bit regardless of a node's
  // width argument. Data ports declared as `bit` (Constant.out, Mux.in0/in1/out,
  // And/Or/Xor.a/b/out, etc.) DO widen with the node's width arg — that's the
  // whole point of parameterised widths. But these control inputs/outputs are
  // always 1-bit and must not be widened, or Verilog's context-extension turns
  // `~hazard_stall` into 32'hFFFFFFFE instead of 1'b0 and silently breaks
  // `if (wire)` pipeline stall/flush tests.
  const CONTROL_PORTS = new Set([
    'we', // Register write-enable
    'sel', // Mux select
    'carry_in', // Adder carry input
    'carry_out', // Adder carry output
    'borrow_in', // Subtractor borrow input
    'borrow_out', // Subtractor borrow output
  ]);

  const resolvedPortTypes = new Map<string, PortType>();
  for (const node of flat.nodes) {
    // A per-width Splitter or Combiner (`Combiner_4w`) has exact port types:
    // its bit ports stay one bit whatever its `width`.
    const exact = PER_WIDTH.test(node.primitiveType);
    const argWidth =
      !exact && typeof node.arguments?.width === 'number' ? node.arguments.width : undefined;

    for (const output of node.outputs) {
      let pt = output.portType;
      if (argWidth && argWidth > 1 && !CONTROL_PORTS.has(output.name)) {
        const portWidth = pt.kind === 'bus' ? pt.width : 1;
        if (portWidth < argWidth) {
          pt = { kind: 'bus', width: argWidth };
        }
      }
      resolvedPortTypes.set(`${node.id}.${output.name}`, pt);
    }
    for (const input of node.inputs) {
      let pt = input.portType;
      if (argWidth && argWidth > 1 && !CONTROL_PORTS.has(input.name)) {
        const portWidth = pt.kind === 'bus' ? pt.width : 1;
        if (portWidth < argWidth) {
          pt = { kind: 'bus', width: argWidth };
        }
      }
      resolvedPortTypes.set(`${node.id}.${input.name}`, pt);
    }
  }

  // Width propagation: for pass-through primitives (Mux, Buffer, etc.),
  // propagate input widths to outputs. Repeat until stable.
  // This handles chains like: Mux(in0=8bit, in1=8bit) → out should be 8bit.
  let widthChanged = true;
  while (widthChanged) {
    widthChanged = false;
    for (const node of flat.nodes) {
      if (PASS_THROUGH.has(node.primitiveType) && isStd(node.primitiveType)) {
        // Find max width among data inputs (exclude sel)
        let maxInputWidth = 1;
        for (const conn of flat.connections) {
          if (conn.target.nodeId !== node.id) continue;
          if (conn.target.portName === 'sel') continue; // sel is always 1-bit
          const sourceType = resolvedPortTypes.get(`${conn.source.nodeId}.${conn.source.portName}`);
          if (sourceType) {
            const w = sourceType.kind === 'bus' ? sourceType.width : 1;
            maxInputWidth = Math.max(maxInputWidth, w);
          }
        }
        // Widen output if needed
        for (const output of node.outputs) {
          const key = `${node.id}.${output.name}`;
          const current = resolvedPortTypes.get(key);
          const currentWidth = current?.kind === 'bus' ? current.width : 1;
          if (maxInputWidth > currentWidth) {
            resolvedPortTypes.set(
              key,
              maxInputWidth <= 1 ? { kind: 'bit' } : { kind: 'bus', width: maxInputWidth },
            );
            widthChanged = true;
          }
        }
      }
    }
  }

  // Width inference: for each connection, take the wider of source/target port types.
  // This handles cases where the simulator is lenient about width mismatches
  // (e.g., Constant(value=4) connecting to an 8-bit input).
  function inferWidth(conn: FlatConnection): PortType {
    const sourceType =
      resolvedPortTypes.get(`${conn.source.nodeId}.${conn.source.portName}`) ?? conn.portType;
    const targetType =
      resolvedPortTypes.get(`${conn.target.nodeId}.${conn.target.portName}`) ?? conn.portType;

    const sourceWidth = sourceType.kind === 'bus' ? sourceType.width : 1;
    const targetWidth = targetType.kind === 'bus' ? targetType.width : 1;
    const maxWidth = Math.max(sourceWidth, targetWidth);

    if (maxWidth <= 1) return { kind: 'bit' };
    return { kind: 'bus', width: maxWidth };
  }

  // Assign wire names for internal connections
  for (const conn of flat.connections) {
    const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
    const targetKey = `${conn.target.nodeId}.${conn.target.portName}`;

    if (!wireMap.has(sourceKey)) {
      const wireName = `w_${sanitizeId(conn.source.nodeId)}_${sanitizeId(conn.source.portName)}`;
      wireMap.set(sourceKey, wireName);
      const inferredType = inferWidth(conn);
      const widthStr = portTypeToVerilog(inferredType);
      wireDeclarations.set(wireName, `wire ${widthStr}${wireName};`);
    }

    if (!wireMap.has(targetKey)) {
      wireMap.set(targetKey, wireMap.get(sourceKey)!);
    }
  }

  // ── Simulator-to-Verilog timing ────────────────────────────────────────────
  // After the simulator timing fix, the simulator now uses standard
  // synchronous semantics: register.q reflects the PREVIOUS tick's state,
  // matching Verilog's non-blocking assignment behavior.
  // No timing transformation is needed — the wire map is used as-is.
  const consumerWireOverrides = new Map<string, string>(); // empty — no overrides

  // ── Register declarations + logic ──────────────────────────────────
  const allDeclarations: string[] = [];
  const allLogicLines: string[] = [];

  for (const node of logicNodes) {
    const wires: PrimitiveWires = {
      inputs: new Map(),
      outputs: new Map(),
    };

    // Map input ports to wire names (check per-consumer overrides first)
    for (const input of node.inputs) {
      const key = `${node.id}.${input.name}`;
      const override = consumerWireOverrides.get(key);
      const wireName = override ?? wireMap.get(key);
      if (wireName) wires.inputs.set(input.name, wireName);
    }

    // Map output ports to wire names
    for (const output of node.outputs) {
      const key = `${node.id}.${output.name}`;
      const wireName = wireMap.get(key);
      if (wireName) wires.outputs.set(output.name, wireName);
    }

    const ctx: PrimitiveContext = {
      behaviors: opts.behaviors,
      nodeId: node.id,
      primitiveType: node.primitiveType,
      args: node.arguments,
      wires,
      clockName: opts.clockName,
      resetName: RESET_NAME,
      target: opts.target,
      ports: {
        inputs: new Map(node.inputs.map((p) => [p.name, widthOf(p.portType)])),
        outputs: new Map(node.outputs.map((p) => [p.name, widthOf(p.portType)])),
      },
      state: definitions.resolveCircuit(node.primitiveType)?.state,
      stateInits: collectStateInits(node, definitions),
      inlineMemoryThreshold,
      sidecarFiles,
      moduleName,
    };

    const result = emitPrimitive(ctx);
    // Record gaps as they happen rather than probing emitPrimitive afterwards
    // with empty wires and no args, which can differ from what a real node
    // produces. Here the node is the one actually being emitted.
    if (result.unsupported !== undefined) {
      const ids = unsupported[node.primitiveType] ?? [];
      ids.push(node.id);
      unsupported[node.primitiveType] = ids;
      if (!reasons.has(node.primitiveType)) reasons.set(node.primitiveType, result.unsupported);
    }
    if (result.clocked) needsClock = true;
    allDeclarations.push(...result.declarations);
    if (result.lines.length > 0) {
      allLogicLines.push(`  // ${node.primitiveType} "${sanitizeId(node.id)}"`);
      allLogicLines.push(...result.lines.map((l) => `  ${l}`));
      allLogicLines.push('');
    }
  }

  // ── Module header ──────────────────────────────────────────────────
  const ports: string[] = [];

  if (needsClock) {
    ports.push(`input ${opts.clockName}`, `input ${RESET_NAME}`);
  }

  for (const input of flat.topLevelInputs) {
    const widthStr = portTypeToVerilog(input.portType);
    ports.push(`input ${widthStr}${input.name}`);
  }

  for (const output of flat.topLevelOutputs) {
    const widthStr = portTypeToVerilog(output.portType);
    ports.push(`output ${widthStr}${output.name}`);
  }

  lines.push(`module ${moduleName} (`);
  lines.push(`  ${ports.join(',\n  ')}`);
  lines.push(`);`);
  lines.push('');

  // ── Wire declarations ──────────────────────────────────────────────
  for (const decl of wireDeclarations.values()) {
    lines.push(`  ${decl}`);
  }
  if (wireDeclarations.size > 0) lines.push('');

  // Emit register declarations
  for (const decl of allDeclarations) {
    lines.push(`  ${decl}`);
  }
  if (allDeclarations.length > 0) lines.push('');

  // Emit logic
  lines.push(...allLogicLines);

  // ── Output port assignments ────────────────────────────────────────
  // Find the wire that drives each top-level output
  for (const output of flat.topLevelOutputs) {
    // Find the connection whose target is this output
    const conn = flat.connections.find(
      (c) => c.target.nodeId === TOP && c.target.portName === output.name,
    );
    if (conn) {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
      const sourceWire = wireMap.get(sourceKey);
      if (sourceWire) {
        lines.push(`  assign ${output.name} = ${sourceWire};`);
      }
    }
  }

  lines.push('');
  lines.push('endmodule');
  lines.push('');

  return {
    result: {
      verilog: lines.join('\n'),
      files: sidecarFiles,
      ...(Object.keys(unsupported).length > 0 ? { unsupported } : {}),
    },
    reasons,
  };
}
