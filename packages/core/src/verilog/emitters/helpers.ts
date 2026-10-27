/**
 * What every primitive emitter shares: the context it is handed, what it
 * returns, and helpers for reading arguments, naming nets, and preloading
 * memories.
 */

import type { BehaviorTable } from '../../circuit/behavior.js';
import type { ArgumentValue, StateBlock } from '../../ir/circuit-ir.js';

export interface PrimitiveWires {
  /** Map of input port name → wire/port name in Verilog */
  inputs: Map<string, string>;
  /** Map of output port name → wire/port name in Verilog */
  outputs: Map<string, string>;
}

/**
 * Preloaded memory data for a single state block on a primitive node.
 * Populated by the exporter from the component definition's
 * `state[].initialValue` for memory-kind state blocks; passed to primitives
 * so they can emit `initial begin mem[K] = …; end` (or `$readmemh` for large
 * memories) using their own reg-name conventions.
 */
export interface StateInit {
  /** Name of the state block in the component definition (e.g. "memory"). */
  stateName: string;
  /** Sparse initial data — keys are addresses, values are word contents. */
  data: Map<number, number>;
  /** Word width in bits, from the state block's dataWidth. */
  width: number;
}

/** Port widths of one node, by port name. */
export interface PortWidths {
  inputs: ReadonlyMap<string, number>;
  outputs: ReadonlyMap<string, number>;
}

/** What `emitPrimitive` produces for one node. */
export interface Emitted {
  lines: string[];
  declarations: string[];
  /** It uses the module's clock and reset. */
  clocked?: boolean;
  /** Why it couldn't be exported; the lines then hold only a warning. */
  unsupported?: string;
}

export interface PrimitiveContext {
  /** Behavior by primitive name, for eval-synth when there is no mapping. */
  behaviors: BehaviorTable;
  /** The node's port widths, which eval-synth reads (32 bits where absent). */
  ports?: PortWidths;
  /** The primitive's state blocks, for eval-synth. */
  state?: readonly StateBlock[];
  nodeId: string;
  primitiveType: string;
  args: Record<string, ArgumentValue>;
  wires: PrimitiveWires;
  clockName: string;
  /**
   * Name of the active-low synchronous reset port emitted at the top of
   * every module that contains sequential logic. Used by every primitive
   * that emits an `always @(posedge clk)` block to gate the reset arm.
   */
  resetName: string;
  target: 'simulation' | 'synthesis';
  /** Preloaded memory state from the component definition (if any). */
  stateInits?: StateInit[];
  /**
   * Threshold (in words) above which a memory's initial data is emitted
   * as `$readmemh("<file>.hex")` + sidecar file instead of inline
   * `initial begin … end`. Defaults handled by the exporter.
   */
  inlineMemoryThreshold?: number;
  /**
   * Sink for sidecar files generated during primitive emission (hex
   * files referenced by `$readmemh`). Emitters push here; the
   * exporter drains into `ExportResult.files`.
   */
  sidecarFiles?: Record<string, string>;
  /**
   * Module name, used to qualify sidecar filenames so multi-circuit
   * projects don't collide on `<node>_<state>.hex`.
   */
  moduleName?: string;
}

/** Hand-written Verilog for one std primitive. */
export type Emitter = (ctx: PrimitiveContext) => Emitted;

/**
 * Emit a memory-initialization block for the given reg name, picking
 * between two paths based on size:
 *
 * - **Inline** (default, for small memories): `initial begin` followed
 *   by `mem[K] = W'hXX;` per address. Readable, single-file, good for
 *   lookup tables and small ROMs.
 *
 * - **`$readmemh` sidecar** (for large memories, ≥ threshold entries):
 *   emits `initial $readmemh("<file>.hex", <reg>);` and writes the hex
 *   contents into `ctx.sidecarFiles[<file>]`. Matches what FPGA toolchains
 *   (Yosys, Vivado, Quartus) expect for program ROMs, framebuffers, and
 *   other memories that are too large to inline.
 *
 * Keys are sorted for determinism. Pass the full `ctx` so we can reach
 * the sidecar collector and the optional threshold override.
 */
export function emitMemoryInit(regName: string, init: StateInit, ctx?: PrimitiveContext): string[] {
  const body = memoryInitBody(regName, init, ctx);
  return body.length > 0 ? ['initial begin', ...body, 'end'] : [];
}

/** The statements inside `emitMemoryInit`'s `initial` block. */
export function memoryInitBody(regName: string, init: StateInit, ctx?: PrimitiveContext): string[] {
  if (init.data.size === 0) return [];
  const w = init.width;
  const hexWidth = Math.max(1, Math.ceil(w / 4));
  const threshold = ctx?.inlineMemoryThreshold ?? 2048;
  const keys = [...init.data.keys()].sort((a, b) => a - b);

  // Large-memory path — emit $readmemh and stash the hex contents as a
  // sidecar file. Depths up to the highest used address are padded with
  // zeros so the file represents the full memory.
  if (keys.length >= threshold && ctx?.sidecarFiles !== undefined) {
    const modPrefix = ctx.moduleName ? `${ctx.moduleName}_` : '';
    const fileName = `${modPrefix}${sanitizeId(ctx.nodeId ?? 'node')}_${init.stateName}.hex`;
    const maxAddr = keys[keys.length - 1];
    // Build the hex file content: one word per line, zero-padded to
    // width/4 chars. Addresses below the max but unpopulated are zeros.
    const lines: string[] = new Array(maxAddr + 1);
    for (let i = 0; i <= maxAddr; i++) {
      const val = init.data.get(i) ?? 0;
      lines[i] = (val >>> 0).toString(16).padStart(hexWidth, '0');
    }
    ctx.sidecarFiles[fileName] = `${lines.join('\n')}\n`;
    return [`  $readmemh("${fileName}", ${regName});`];
  }

  // Inline path.
  return keys.map((addr) => {
    const val = init.data.get(addr) ?? 0;
    const hex = (val >>> 0).toString(16).padStart(hexWidth, '0');
    return `  ${regName}[${addr}] = ${w}'h${hex};`;
  });
}

/**
 * `initial` block for a node's own memory contents, the `memory` argument of a
 * factory call (`ROM({ memory })`). Empty when the node has none.
 */
export function emitArgMemoryInit(
  memName: string,
  contents: ArgumentValue | undefined,
  dw: number,
): string[] {
  const body = argMemoryInitBody(memName, contents, dw);
  return body ? ['initial begin', ...body, 'end'] : [];
}

/** The statements inside `emitArgMemoryInit`'s block, or undefined with no contents. */
export function argMemoryInitBody(
  memName: string,
  contents: ArgumentValue | undefined,
  dw: number,
): string[] | undefined {
  if (!contents || typeof contents !== 'object') return undefined;
  return Object.entries(contents).map(([addr, val]) => `  ${memName}[${addr}] = ${dw}'d${val};`);
}

/**
 * Resolve the effective width from primitive arguments.
 */
export function getWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.width;
  return typeof w === 'number' ? w : defaultWidth;
}

/** All ones, `width` bits wide. */
export function ones(width: number): string {
  return `{${width}{1'b1}}`;
}

export function getAddressWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.addressWidth;
  return typeof w === 'number' ? w : defaultWidth;
}

export function getDataWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.dataWidth;
  return typeof w === 'number' ? w : defaultWidth;
}

function wire(wires: PrimitiveWires, port: string, type: 'input' | 'output'): string {
  const map = type === 'input' ? wires.inputs : wires.outputs;
  const net = map.get(port);
  if (net !== undefined) return net;
  // Unconnected input: tie to zero. Unconnected output: use dummy (caller should skip via isConnected).
  return type === 'input' ? "1'b0" : `__unused_${sanitizeId(port)}`;
}

/** Net accessors for one node: `i(port)` reads an input's net, `o(port)` an output's. */
export function pins(wires: PrimitiveWires): {
  i: (port: string) => string;
  o: (port: string) => string;
} {
  return {
    i: (port) => wire(wires, port, 'input'),
    o: (port) => wire(wires, port, 'output'),
  };
}

export function isConnected(
  wires: PrimitiveWires,
  port: string,
  type: 'input' | 'output',
): boolean {
  const map = type === 'input' ? wires.inputs : wires.outputs;
  return map.has(port);
}

export function sanitizeId(id: string): string {
  return id.replace(/[.-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}
