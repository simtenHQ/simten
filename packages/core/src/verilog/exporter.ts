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

import type { Circuit, PortType } from '../types/circuit.js';
import type { FlatCircuit, FlatNode, FlatConnection } from '../types/simulator.js';
import type { CircuitLibrary } from '../types/simulator.js';
import { elaborate } from '../simulator/elaboration.js';
import type { VerilogExportOptions } from './types.js';
import {
  emitPrimitive,
  isIOPrimitive,
  isSinkPrimitive,
  isSequentialPrimitive,
  type PrimitiveWires,
  type PrimitiveContext,
} from './primitive-map.js';

const DEFAULT_OPTIONS: Required<VerilogExportOptions> = {
  mode: 'flat',
  topModuleName: '',
  clockName: 'clk',
  includeTimescale: true,
  target: 'simulation',
};

function sanitizeId(id: string): string {
  return id.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function portTypeToVerilog(pt: PortType): string {
  if (pt.kind === 'bit') return '';
  return `[${pt.width - 1}:0] `;
}

/**
 * Export a circuit to Verilog (flat mode).
 * Elaborates the circuit first, then emits a single flat module.
 */
export function exportVerilogFlat(
  circuit: Circuit,
  library: CircuitLibrary,
  options?: VerilogExportOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const flatCircuit = elaborate(circuit, library, false, { expandReferences: true });
  return emitFlatModule(circuit, flatCircuit, library, opts);
}

/**
 * Export a circuit to Verilog (auto mode — flat by default).
 */
export function exportVerilog(
  circuit: Circuit,
  library: CircuitLibrary,
  options?: VerilogExportOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.mode === 'hierarchical') {
    // TODO: hierarchical mode (emit sub-modules)
    // For now, fall back to flat
  }
  return exportVerilogFlat(circuit, library, opts);
}

// ── Flat module emission ────────────────────────────────────────────────

function emitFlatModule(
  circuit: Circuit,
  flat: FlatCircuit,
  library: CircuitLibrary,
  opts: Required<VerilogExportOptions>,
): string {
  const moduleName = opts.topModuleName || sanitizeId(circuit.name);
  const lines: string[] = [];

  if (opts.includeTimescale) {
    lines.push('`timescale 1ns / 1ps');
    lines.push('');
  }

  const TOP = '__top__';

  // Detect if circuit needs a clock
  const needsClock = flat.nodes.some(n => isSequentialPrimitive(n.primitiveType));

  // Filter to logic nodes only (I/O becomes module ports via topLevelInputs/Outputs)
  const logicNodes = flat.nodes.filter(n => !isSinkPrimitive(n.primitiveType));

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
  const resolvedPortTypes = new Map<string, PortType>();
  for (const node of flat.nodes) {
    const argWidth = typeof node.arguments?.width === 'number' ? node.arguments.width : undefined;

    for (const output of node.outputs) {
      let pt = output.portType;
      // If the node has a width argument and the port is narrower, widen it
      if (argWidth && argWidth > 1) {
        const portWidth = pt.kind === 'bus' ? pt.width : 1;
        if (portWidth < argWidth) {
          pt = { kind: 'bus', width: argWidth };
        }
      }
      resolvedPortTypes.set(`${node.id}.${output.name}`, pt);
    }
    for (const input of node.inputs) {
      let pt = input.portType;
      if (argWidth && argWidth > 1) {
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
      if (node.primitiveType === 'Mux' || node.primitiveType === 'Mux2' ||
          node.primitiveType === 'Buffer' || node.primitiveType === 'Probe') {
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
            resolvedPortTypes.set(key, maxInputWidth <= 1 ? { kind: 'bit' } : { kind: 'bus', width: maxInputWidth });
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
    const sourceType = resolvedPortTypes.get(`${conn.source.nodeId}.${conn.source.portName}`) ?? conn.portType;
    const targetType = resolvedPortTypes.get(`${conn.target.nodeId}.${conn.target.portName}`) ?? conn.portType;

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

  // ── Module header ──────────────────────────────────────────────────
  const ports: string[] = [];

  if (needsClock) {
    ports.push(`input ${opts.clockName}`);
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
      nodeId: node.id,
      primitiveType: node.primitiveType,
      args: node.arguments as Record<string, any>,
      wires,
      clockName: opts.clockName,
      target: opts.target,
    };

    const result = emitPrimitive(ctx);
    allDeclarations.push(...result.declarations);
    if (result.lines.length > 0) {
      allLogicLines.push(`  // ${node.primitiveType} "${sanitizeId(node.id)}"`);
      allLogicLines.push(...result.lines.map(l => `  ${l}`));
      allLogicLines.push('');
    }
  }

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
    const targetKey = `${TOP}.${output.name}`;
    // Find the connection whose target is this output
    const conn = flat.connections.find(
      c => c.target.nodeId === TOP && c.target.portName === output.name
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

  return lines.join('\n');
}

