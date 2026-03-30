/**
 * Verilog primitive mapping.
 *
 * Maps each DSL primitive to its Verilog equivalent.
 * Returns an array of Verilog statements (assign, always, etc.).
 *
 * Convention:
 * - Combinational → `assign` statements
 * - Sequential → `always @(posedge clk)` with non-blocking `<=`
 * - I/O → module ports (emitted by the exporter, not here)
 * - Sinks → stub comments
 *
 * All operations are unsigned. Signed tracking is a future enhancement.
 */

import type { ArgumentValue } from '../types/circuit.js';

export interface PrimitiveWires {
  /** Map of input port name → wire/port name in Verilog */
  inputs: Map<string, string>;
  /** Map of output port name → wire/port name in Verilog */
  outputs: Map<string, string>;
}

export interface PrimitiveContext {
  nodeId: string;
  primitiveType: string;
  args: Record<string, ArgumentValue>;
  wires: PrimitiveWires;
  clockName: string;
  target: 'simulation' | 'synthesis';
}

/**
 * Resolve the effective width from primitive arguments.
 */
function getWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.width;
  return typeof w === 'number' ? w : defaultWidth;
}

function getAddressWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.addressWidth;
  return typeof w === 'number' ? w : defaultWidth;
}

function getDataWidth(args: Record<string, ArgumentValue>, defaultWidth = 8): number {
  const w = args.dataWidth;
  return typeof w === 'number' ? w : defaultWidth;
}

function wire(wires: PrimitiveWires, port: string, type: 'input' | 'output'): string {
  const map = type === 'input' ? wires.inputs : wires.outputs;
  return map.get(port) ?? `__unused_${sanitizeId(port)}`;
}

function isConnected(wires: PrimitiveWires, port: string, type: 'input' | 'output'): boolean {
  const map = type === 'input' ? wires.inputs : wires.outputs;
  return map.has(port);
}

function sanitizeId(id: string): string {
  return id.replace(/[.\-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Emit Verilog for a single primitive instance.
 * Returns { lines: string[], declarations: string[] }
 * - lines: assign/always statements
 * - declarations: reg/wire declarations needed for this primitive
 */
export function emitPrimitive(ctx: PrimitiveContext): { lines: string[]; declarations: string[] } {
  const { primitiveType, args, wires, clockName, nodeId } = ctx;
  const w = getWidth(args);
  const id = sanitizeId(nodeId);

  const i = (port: string) => wire(wires, port, 'input');
  const o = (port: string) => wire(wires, port, 'output');

  switch (primitiveType) {
    // ── Logic Gates ──────────────────────────────────────────────────
    case 'And':
      return { lines: [`assign ${o('out')} = ${i('a')} & ${i('b')};`], declarations: [] };
    case 'Or':
      return { lines: [`assign ${o('out')} = ${i('a')} | ${i('b')};`], declarations: [] };
    case 'Not':
      return { lines: [`assign ${o('out')} = ~${i('in')};`], declarations: [] };
    case 'Nand':
      return { lines: [`assign ${o('out')} = ~(${i('a')} & ${i('b')});`], declarations: [] };
    case 'Nor':
      return { lines: [`assign ${o('out')} = ~(${i('a')} | ${i('b')});`], declarations: [] };
    case 'Xor':
      return { lines: [`assign ${o('out')} = ${i('a')} ^ ${i('b')};`], declarations: [] };
    case 'Xnor':
      return { lines: [`assign ${o('out')} = ~(${i('a')} ^ ${i('b')});`], declarations: [] };
    case 'Buffer':
      return { lines: [`assign ${o('out')} = ${i('in')};`], declarations: [] };
    case 'Probe':
      return { lines: [`assign ${o('out')} = ${i('in')};`], declarations: [] };

    // ── Bus Logic ────────────────────────────────────────────────────
    case 'BusAnd':
      return { lines: [`assign ${o('out')} = ${i('a')} & ${i('b')};`], declarations: [] };
    case 'BusOr':
      return { lines: [`assign ${o('out')} = ${i('a')} | ${i('b')};`], declarations: [] };
    case 'BusXor':
      return { lines: [`assign ${o('out')} = ${i('a')} ^ ${i('b')};`], declarations: [] };
    case 'BusNot':
      return { lines: [`assign ${o('out')} = ~${i('in')};`], declarations: [] };

    // ── Arithmetic ───────────────────────────────────────────────────
    case 'Adder': {
      if (isConnected(wires, 'carry_out', 'output')) {
        return { lines: [`assign {${o('carry_out')}, ${o('sum')}} = ${i('a')} + ${i('b')} + ${i('carry_in')};`], declarations: [] };
      }
      // carry_out not connected — just assign sum without concatenation
      return { lines: [`assign ${o('sum')} = ${i('a')} + ${i('b')} + ${i('carry_in')};`], declarations: [] };
    }
    case 'SignedAdder': {
      const saLines: string[] = [];
      if (isConnected(wires, 'carry_out', 'output')) {
        saLines.push(`assign {${o('carry_out')}, ${o('sum')}} = $signed(${i('a')}) + $signed(${i('b')}) + ${i('carry_in')};`);
      } else {
        saLines.push(`assign ${o('sum')} = $signed(${i('a')}) + $signed(${i('b')}) + ${i('carry_in')};`);
      }
      if (isConnected(wires, 'overflow', 'output')) {
        saLines.push(`assign ${o('overflow')} = (${i('a')}[${w - 1}] == ${i('b')}[${w - 1}]) && (${o('sum')}[${w - 1}] != ${i('a')}[${w - 1}]);`);
      }
      return { lines: saLines, declarations: [] };
    }
    case 'Subtractor': {
      if (isConnected(wires, 'borrow_out', 'output')) {
        return { lines: [`assign {${o('borrow_out')}, ${o('difference')}} = ${i('a')} - ${i('b')} - ${i('borrow_in')};`], declarations: [] };
      }
      return { lines: [`assign ${o('difference')} = ${i('a')} - ${i('b')} - ${i('borrow_in')};`], declarations: [] };
    }
    case 'Multiplier':
      return { lines: [`assign ${o('product')} = ${i('a')} * ${i('b')};`], declarations: [] };
    case 'SignedMultiplier':
      return { lines: [`assign ${o('product')} = $signed(${i('a')}) * $signed(${i('b')});`], declarations: [] };
    case 'Incrementer':
      return { lines: [`assign ${o('out')} = ${i('in')} + 1;`], declarations: [] };

    // ── Shift ────────────────────────────────────────────────────────
    case 'LeftShifter':
      return { lines: [`assign ${o('result')} = ${i('value')} << ${i('shift')};`], declarations: [] };
    case 'RightShifter':
      return { lines: [`assign ${o('result')} = ${i('value')} >> ${i('shift')};`], declarations: [] };

    // ── Comparison ───────────────────────────────────────────────────
    case 'Comparator': {
      const cmpLines: string[] = [];
      if (isConnected(wires, 'eq', 'output')) cmpLines.push(`assign ${o('eq')} = (${i('a')} == ${i('b')});`);
      if (isConnected(wires, 'lt', 'output')) cmpLines.push(`assign ${o('lt')} = (${i('a')} < ${i('b')});`);
      if (isConnected(wires, 'gt', 'output')) cmpLines.push(`assign ${o('gt')} = (${i('a')} > ${i('b')});`);
      return { lines: cmpLines, declarations: [] };
    }
    case 'SignedComparator': {
      const scmpLines: string[] = [];
      if (isConnected(wires, 'eq', 'output')) scmpLines.push(`assign ${o('eq')} = ($signed(${i('a')}) == $signed(${i('b')}));`);
      if (isConnected(wires, 'lt', 'output')) scmpLines.push(`assign ${o('lt')} = ($signed(${i('a')}) < $signed(${i('b')}));`);
      if (isConnected(wires, 'gt', 'output')) scmpLines.push(`assign ${o('gt')} = ($signed(${i('a')}) > $signed(${i('b')}));`);
      if (isConnected(wires, 'lte', 'output')) scmpLines.push(`assign ${o('lte')} = ($signed(${i('a')}) <= $signed(${i('b')}));`);
      if (isConnected(wires, 'gte', 'output')) scmpLines.push(`assign ${o('gte')} = ($signed(${i('a')}) >= $signed(${i('b')}));`);
      return { lines: scmpLines, declarations: [] };
    }

    // ── Multiplexing ─────────────────────────────────────────────────
    case 'Mux':
      return { lines: [`assign ${o('out')} = ${i('sel')} ? ${i('in1')} : ${i('in0')};`], declarations: [] };

    // ── Bit manipulation ─────────────────────────────────────────────
    case 'BitSlice': {
      const low = typeof args.low === 'number' ? args.low : 0;
      const high = typeof args.high === 'number' ? args.high : 7;
      return { lines: [`assign ${o('out')} = ${i('in')}[${high}:${low}];`], declarations: [] };
    }
    case 'Concat': {
      const lowWidth = typeof args.lowWidth === 'number' ? args.lowWidth : 4;
      return { lines: [`assign ${o('out')} = {${i('high')}, ${i('low')}};`], declarations: [] };
    }
    case 'Splitter':
      return {
        lines: [
          `assign ${o('out0')} = ${i('in')}[3:0];`,
          `assign ${o('out1')} = ${i('in')}[7:4];`,
        ],
        declarations: [],
      };
    case 'Splitter8to8':
      return {
        lines: Array.from({ length: 8 }, (_, bit) =>
          `assign ${o(`bit${bit}`)} = ${i('in')}[${bit}];`
        ),
        declarations: [],
      };
    case 'Combiner8to8':
      return {
        lines: [`assign ${o('out')} = {${Array.from({ length: 8 }, (_, bit) => i(`bit${7 - bit}`)).join(', ')}};`],
        declarations: [],
      };
    case 'AddressCombiner':
      return { lines: [`assign ${o('out')} = {${i('hi')}, ${i('lo')}};`], declarations: [] };

    // ── Decoder ──────────────────────────────────────────────────────
    case 'Decoder':
      return {
        lines: [
          `assign ${o('out0')} = (${i('in')} == 2'd0);`,
          `assign ${o('out1')} = (${i('in')} == 2'd1);`,
          `assign ${o('out2')} = (${i('in')} == 2'd2);`,
          `assign ${o('out3')} = (${i('in')} == 2'd3);`,
        ],
        declarations: [],
      };

    // ── Constants ────────────────────────────────────────────────────
    case 'Constant': {
      const value = typeof args.value === 'number' ? args.value : 0;
      if (w <= 1) {
        return { lines: [`assign ${o('out')} = 1'b${value ? 1 : 0};`], declarations: [] };
      }
      return { lines: [`assign ${o('out')} = ${w}'d${value};`], declarations: [] };
    }

    // ── Sequential: DFlipFlop ────────────────────────────────────────
    case 'DFlipFlop': {
      const regName = `reg_${id}`;
      const initLines = ctx.target === 'simulation' ? [`initial ${regName} = 1'b0;`] : [];
      return {
        declarations: [`reg ${regName};`],
        lines: [
          ...initLines,
          `always @(posedge ${clockName}) begin`,
          `  ${regName} <= ${i('d')};`,
          `end`,
          `assign ${o('q')} = ${regName};`,
          ...(isConnected(wires, 'q_bar', 'output') ? [`assign ${o('q_bar')} = ~${regName};`] : []),
        ],
      };
    }

    // ── Sequential: Register ─────────────────────────────────────────
    case 'Register': {
      const regName = `reg_${id}`;
      const widthStr = w > 1 ? `[${w - 1}:0] ` : '';
      const initialValue = typeof args.initial === 'number' ? args.initial : 0;
      const initLines = ctx.target === 'simulation'
        ? [`initial ${regName} = ${w > 1 ? `${w}'d` : "1'b"}${initialValue};`]
        : [];
      return {
        declarations: [`reg ${widthStr}${regName};`],
        lines: [
          ...initLines,
          `always @(posedge ${clockName}) begin`,
          `  if (${i('we')}) ${regName} <= ${i('data')};`,
          `end`,
          `assign ${o('q')} = ${regName};`,
        ],
      };
    }

    // ── Sequential: ROM ──────────────────────────────────────────────
    case 'ROM': {
      const aw = getAddressWidth(args, 16);
      const dw = getDataWidth(args, 8);
      const memName = `mem_${id}`;
      const declarations = [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`];

      // Initialize ROM data from arguments
      const initLines: string[] = [];
      if (ctx.target === 'simulation') {
        const initData = args.init;
        if (initData && typeof initData === 'object' && !Array.isArray(initData)) {
          initLines.push(`initial begin`);
          for (const [addr, val] of Object.entries(initData as Record<number, number>)) {
            initLines.push(`  ${memName}[${addr}] = ${dw}'d${val};`);
          }
          initLines.push(`end`);
        }
      }

      return {
        declarations,
        lines: [
          ...initLines,
          `assign ${o('data_out')} = ${memName}[${i('addr')}];`,
        ],
      };
    }

    // ── Sequential: RAM ──────────────────────────────────────────────
    case 'RAM': {
      const aw = getAddressWidth(args, 8);
      const dw = getDataWidth(args, 8);
      const memName = `mem_${id}`;
      return {
        declarations: [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`],
        lines: [
          `// Write-first RAM`,
          `always @(posedge ${clockName}) begin`,
          `  if (${i('we')}) ${memName}[${i('addr')}] <= ${i('data_in')};`,
          `end`,
          `assign ${o('data_out')} = ${memName}[${i('addr')}];`,
        ],
      };
    }

    // ── Sequential: DualPortRAM ──────────────────────────────────────
    case 'DualPortRAM': {
      const aw = getAddressWidth(args, 8);
      const dw = getDataWidth(args, 8);
      const memName = `mem_${id}`;

      const initLines: string[] = [];
      if (ctx.target === 'simulation') {
        const initData = args.init;
        if (initData && typeof initData === 'object' && !Array.isArray(initData)) {
          initLines.push(`initial begin`);
          for (const [addr, val] of Object.entries(initData as Record<number, number>)) {
            initLines.push(`  ${memName}[${addr}] = ${dw}'d${val};`);
          }
          initLines.push(`end`);
        }
      }

      return {
        declarations: [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`],
        lines: [
          ...initLines,
          `// Write-first DualPortRAM`,
          `always @(posedge ${clockName}) begin`,
          `  if (${i('weA')}) ${memName}[${i('addrA')}] <= ${i('dataA')};`,
          `end`,
          `assign ${o('outA')} = ${memName}[${i('addrA')}];`,
          `assign ${o('outB')} = ${memName}[${i('addrB')}];`,
        ],
      };
    }

    // ── I/O (handled by exporter as module ports) ────────────────────
    case 'Switch':
    case 'Input':
    case 'Button':
    case 'Led':
    case 'Output':
    case 'HexDisplay':
    case 'SevenSegment':
      // These become module ports — no logic emitted here
      return { lines: [], declarations: [] };

    // ── Display sinks (simulation-only, no hardware equivalent) ──────
    case 'Screen':
    case 'RasterDisplay':
    case 'Console':
    case 'UART_TX':
      return {
        lines: [`// Stub: ${primitiveType} "${id}" (simulation-only sink, no Verilog equivalent)`],
        declarations: [],
      };

    // ── Unknown ──────────────────────────────────────────────────────
    default:
      return {
        lines: [`// WARNING: Unsupported primitive "${primitiveType}" (${id})`],
        declarations: [],
      };
  }
}

/**
 * Check if a primitive type is an I/O component (becomes a module port).
 */
export function isIOPrimitive(primitiveType: string): boolean {
  return ['Switch', 'Input', 'Button', 'Led', 'Output', 'HexDisplay', 'SevenSegment'].includes(primitiveType);
}

/**
 * Check if a primitive type is a sink (no Verilog output).
 */
export function isSinkPrimitive(primitiveType: string): boolean {
  return ['Screen', 'RasterDisplay', 'Console', 'UART_TX'].includes(primitiveType);
}

/**
 * Check if a primitive type is sequential (needs a clock).
 */
export function isSequentialPrimitive(primitiveType: string): boolean {
  return ['DFlipFlop', 'Register', 'RAM', 'ROM', 'DualPortRAM', 'Console', 'UART_TX'].includes(primitiveType);
}
