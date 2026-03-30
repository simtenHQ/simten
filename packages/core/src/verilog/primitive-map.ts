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
  if (map.has(port)) return map.get(port)!;
  // Unconnected input: tie to zero. Unconnected output: use dummy (caller should skip via isConnected).
  return type === 'input' ? "1'b0" : `__unused_${sanitizeId(port)}`;
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

    // ── RV32I Behavioral Primitives ─────────────────────────────────
    // These are too complex for DSL reference circuits (they'd be hundreds
    // of nodes). Instead, emit behavioral Verilog directly.

    case 'RV32I_Decode': {
      const decLines: string[] = [];
      if (isConnected(wires, 'opcode', 'output')) decLines.push(`assign ${o('opcode')} = ${i('instruction')}[6:0];`);
      if (isConnected(wires, 'rd', 'output')) decLines.push(`assign ${o('rd')} = ${i('instruction')}[11:7];`);
      if (isConnected(wires, 'funct3', 'output')) decLines.push(`assign ${o('funct3')} = ${i('instruction')}[14:12];`);
      if (isConnected(wires, 'rs1', 'output')) decLines.push(`assign ${o('rs1')} = ${i('instruction')}[19:15];`);
      if (isConnected(wires, 'rs2', 'output')) decLines.push(`assign ${o('rs2')} = ${i('instruction')}[24:20];`);
      if (isConnected(wires, 'funct7', 'output')) decLines.push(`assign ${o('funct7')} = ${i('instruction')}[31:25];`);
      return { lines: decLines, declarations: [] };
    }

    case 'RV32I_ALU': {
      const resultWire = `alu_result_${id}`;
      return {
        declarations: [`reg [31:0] ${resultWire};`],
        lines: [
          `always @(*) begin`,
          `  case (${i('alu_op')})`,
          `    4'd0: ${resultWire} = ${i('a')} + ${i('b')};`,
          `    4'd1: ${resultWire} = ${i('a')} - ${i('b')};`,
          `    4'd2: ${resultWire} = ${i('a')} & ${i('b')};`,
          `    4'd3: ${resultWire} = ${i('a')} | ${i('b')};`,
          `    4'd4: ${resultWire} = ${i('a')} ^ ${i('b')};`,
          `    4'd5: ${resultWire} = ${i('a')} << ${i('b')}[4:0];`,
          `    4'd6: ${resultWire} = ${i('a')} >> ${i('b')}[4:0];`,
          `    4'd7: ${resultWire} = $signed(${i('a')}) >>> ${i('b')}[4:0];`,
          `    4'd8: ${resultWire} = ($signed(${i('a')}) < $signed(${i('b')})) ? 32'd1 : 32'd0;`,
          `    4'd9: ${resultWire} = (${i('a')} < ${i('b')}) ? 32'd1 : 32'd0;`,
          `    default: ${resultWire} = 32'd0;`,
          `  endcase`,
          `end`,
          `assign ${o('result')} = ${resultWire};`,
          ...(isConnected(wires, 'zero', 'output') ? [`assign ${o('zero')} = (${resultWire} == 32'd0);`] : []),
        ],
      };
    }

    case 'RV32I_ImmGen': {
      const immWire = `imm_${id}`;
      return {
        declarations: [`reg [31:0] ${immWire};`],
        lines: [
          `always @(*) begin`,
          `  case (${i('instruction')}[6:0])`,
          `    7'h13, 7'h03, 7'h67: ${immWire} = {{20{${i('instruction')}[31]}}, ${i('instruction')}[31:20]};`,
          `    7'h23: ${immWire} = {{20{${i('instruction')}[31]}}, ${i('instruction')}[31:25], ${i('instruction')}[11:7]};`,
          `    7'h63: ${immWire} = {{19{${i('instruction')}[31]}}, ${i('instruction')}[31], ${i('instruction')}[7], ${i('instruction')}[30:25], ${i('instruction')}[11:8], 1'b0};`,
          `    7'h37, 7'h17: ${immWire} = {${i('instruction')}[31:12], 12'b0};`,
          `    7'h6F: ${immWire} = {{11{${i('instruction')}[31]}}, ${i('instruction')}[31], ${i('instruction')}[19:12], ${i('instruction')}[20], ${i('instruction')}[30:21], 1'b0};`,
          `    default: ${immWire} = 32'd0;`,
          `  endcase`,
          `end`,
          `assign ${o('immediate')} = ${immWire};`,
        ],
      };
    }

    case 'RV32I_Control': {
      const ctlPrefix = `ctl_${id}`;
      return {
        declarations: [
          `reg [3:0] ${ctlPrefix}_alu_op;`,
          `reg ${ctlPrefix}_alu_src, ${ctlPrefix}_mem_read, ${ctlPrefix}_mem_write;`,
          `reg ${ctlPrefix}_reg_write, ${ctlPrefix}_mem_to_reg, ${ctlPrefix}_branch;`,
          `reg ${ctlPrefix}_jump, ${ctlPrefix}_lui, ${ctlPrefix}_auipc, ${ctlPrefix}_is_jalr;`,
        ],
        lines: [
          `always @(*) begin`,
          `  ${ctlPrefix}_alu_op = 4'd0; ${ctlPrefix}_alu_src = 0; ${ctlPrefix}_mem_read = 0;`,
          `  ${ctlPrefix}_mem_write = 0; ${ctlPrefix}_reg_write = 0; ${ctlPrefix}_mem_to_reg = 0;`,
          `  ${ctlPrefix}_branch = 0; ${ctlPrefix}_jump = 0; ${ctlPrefix}_lui = 0;`,
          `  ${ctlPrefix}_auipc = 0; ${ctlPrefix}_is_jalr = 0;`,
          `  case (${i('opcode')})`,
          `    7'h33: begin ${ctlPrefix}_reg_write = 1;`, // R-type
          `      case (${i('funct3')})`,
          `        3'd0: ${ctlPrefix}_alu_op = ${i('funct7_bit')} ? 4'd1 : 4'd0;`,
          `        3'd1: ${ctlPrefix}_alu_op = 4'd5;`,
          `        3'd2: ${ctlPrefix}_alu_op = 4'd8;`,
          `        3'd3: ${ctlPrefix}_alu_op = 4'd9;`,
          `        3'd4: ${ctlPrefix}_alu_op = 4'd4;`,
          `        3'd5: ${ctlPrefix}_alu_op = ${i('funct7_bit')} ? 4'd7 : 4'd6;`,
          `        3'd6: ${ctlPrefix}_alu_op = 4'd3;`,
          `        3'd7: ${ctlPrefix}_alu_op = 4'd2;`,
          `      endcase end`,
          `    7'h13: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_alu_src = 1;`, // I-type ALU
          `      case (${i('funct3')})`,
          `        3'd0: ${ctlPrefix}_alu_op = 4'd0;`,
          `        3'd1: ${ctlPrefix}_alu_op = 4'd5;`,
          `        3'd2: ${ctlPrefix}_alu_op = 4'd8;`,
          `        3'd3: ${ctlPrefix}_alu_op = 4'd9;`,
          `        3'd4: ${ctlPrefix}_alu_op = 4'd4;`,
          `        3'd5: ${ctlPrefix}_alu_op = ${i('funct7_bit')} ? 4'd7 : 4'd6;`,
          `        3'd6: ${ctlPrefix}_alu_op = 4'd3;`,
          `        3'd7: ${ctlPrefix}_alu_op = 4'd2;`,
          `      endcase end`,
          `    7'h03: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_alu_src = 1; ${ctlPrefix}_mem_read = 1; ${ctlPrefix}_mem_to_reg = 1; end`, // Load
          `    7'h23: begin ${ctlPrefix}_alu_src = 1; ${ctlPrefix}_mem_write = 1; end`, // Store
          `    7'h63: begin ${ctlPrefix}_branch = 1; ${ctlPrefix}_alu_op = 4'd1; end`, // Branch
          `    7'h6F: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_jump = 1; end`, // JAL
          `    7'h67: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_jump = 1; ${ctlPrefix}_alu_src = 1; ${ctlPrefix}_is_jalr = 1; end`, // JALR
          `    7'h37: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_lui = 1; end`, // LUI
          `    7'h17: begin ${ctlPrefix}_reg_write = 1; ${ctlPrefix}_auipc = 1; end`, // AUIPC
          `  endcase`,
          `end`,
          `assign ${o('alu_op')} = ${ctlPrefix}_alu_op;`,
          `assign ${o('alu_src')} = ${ctlPrefix}_alu_src;`,
          `assign ${o('mem_read')} = ${ctlPrefix}_mem_read;`,
          `assign ${o('mem_write')} = ${ctlPrefix}_mem_write;`,
          `assign ${o('reg_write')} = ${ctlPrefix}_reg_write;`,
          `assign ${o('mem_to_reg')} = ${ctlPrefix}_mem_to_reg;`,
          `assign ${o('branch')} = ${ctlPrefix}_branch;`,
          `assign ${o('jump')} = ${ctlPrefix}_jump;`,
          `assign ${o('lui')} = ${ctlPrefix}_lui;`,
          `assign ${o('auipc')} = ${ctlPrefix}_auipc;`,
          `assign ${o('is_jalr')} = ${ctlPrefix}_is_jalr;`,
        ],
      };
    }

    case 'RV32I_BranchComp': {
      const bWire = `branch_${id}`;
      return {
        declarations: [`reg ${bWire};`],
        lines: [
          `always @(*) begin`,
          `  case (${i('funct3')})`,
          `    3'd0: ${bWire} = (${i('a')} == ${i('b')});`,
          `    3'd1: ${bWire} = (${i('a')} != ${i('b')});`,
          `    3'd4: ${bWire} = ($signed(${i('a')}) < $signed(${i('b')}));`,
          `    3'd5: ${bWire} = ($signed(${i('a')}) >= $signed(${i('b')}));`,
          `    3'd6: ${bWire} = (${i('a')} < ${i('b')});`,
          `    3'd7: ${bWire} = (${i('a')} >= ${i('b')});`,
          `    default: ${bWire} = 0;`,
          `  endcase`,
          `end`,
          `assign ${o('take_branch')} = ${bWire};`,
        ],
      };
    }

    case 'RV32I_RegisterFile': {
      const rfName = `rf_${id}`;
      return {
        declarations: [`reg [31:0] ${rfName} [0:31];`],
        lines: [
          `initial begin : ${rfName}_init`,
          `  integer i;`,
          `  for (i = 0; i < 32; i = i + 1) ${rfName}[i] = 32'd0;`,
          `end`,
          `always @(posedge ${clockName}) begin`,
          `  if (${i('we')} && ${i('rd')} != 5'd0) ${rfName}[${i('rd')}] <= ${i('write_data')};`,
          `end`,
          `assign ${o('read1')} = (${i('rs1')} == 5'd0) ? 32'd0 : ${rfName}[${i('rs1')}];`,
          `assign ${o('read2')} = (${i('rs2')} == 5'd0) ? 32'd0 : ${rfName}[${i('rs2')}];`,
        ],
      };
    }

    case 'RV32I_InstrMem': {
      const imemName = `imem_${id}`;
      const aw = 16; // 64KB = 2^16
      return {
        declarations: [`reg [31:0] ${imemName} [0:${(1 << aw) - 1}];`],
        lines: [
          `assign ${o('instruction')} = ${imemName}[${i('addr')}[${aw + 1}:2]];`,
        ],
      };
    }

    case 'RV32I_DataMem': {
      const dmemName = `dmem_${id}`;
      const aw = 16;
      return {
        declarations: [`reg [31:0] ${dmemName} [0:${(1 << aw) - 1}];`],
        lines: [
          `always @(posedge ${clockName}) begin`,
          `  if (${i('mem_write')}) ${dmemName}[${i('addr')}[${aw + 1}:2]] <= ${i('write_data')};`,
          `end`,
          `assign ${o('read_data')} = ${i('mem_read')} ? ${dmemName}[${i('addr')}[${aw + 1}:2]] : 32'd0;`,
        ],
      };
    }

    case 'RV32I_LoadAlign': {
      const laWire = `la_${id}`;
      return {
        declarations: [`reg [31:0] ${laWire};`],
        lines: [
          `always @(*) begin`,
          `  case (${i('funct3')})`,
          `    3'd0: ${laWire} = {{24{${i('data')}[7]}}, ${i('data')}[7:0]};`,
          `    3'd1: ${laWire} = {{16{${i('data')}[15]}}, ${i('data')}[15:0]};`,
          `    3'd4: ${laWire} = {24'd0, ${i('data')}[7:0]};`,
          `    3'd5: ${laWire} = {16'd0, ${i('data')}[15:0]};`,
          `    default: ${laWire} = ${i('data')};`,
          `  endcase`,
          `end`,
          `assign ${o('out')} = ${laWire};`,
        ],
      };
    }

    case 'MemBusMux': {
      const busId = `bus_${id}`;
      // Address decode with hardcoded ranges (default MemBusMux params)
      return {
        declarations: [`reg [31:0] ${busId}_read_data;`, `reg [4:0] ${busId}_sel;`],
        lines: [
          `assign ${o('local_addr')} = ${i('addr')};`,
          `assign ${o('write_data_out')} = ${i('write_data')};`,
          `assign ${o('funct3_out')} = ${i('funct3')};`,
          `// Address decode`,
          `always @(*) begin`,
          `  ${busId}_sel = 5'd0;`,
          `  if (${i('addr')} >= 32'h00010000 && ${i('addr')} <= 32'h0001FFFF) ${busId}_sel = 5'd1;`,
          `  else if (${i('addr')} >= 32'h80000000 && ${i('addr')} <= 32'h80000FFF) ${busId}_sel = 5'd2;`,
          `  else if (${i('addr')} >= 32'h80001000 && ${i('addr')} <= 32'h80001FFF) ${busId}_sel = 5'd4;`,
          `  else if (${i('addr')} >= 32'h80002000 && ${i('addr')} <= 32'h80002FFF) ${busId}_sel = 5'd8;`,
          `  else if (${i('addr')} <= 32'h0000FFFF) ${busId}_sel = 5'd16;`,
          `end`,
          `assign ${o('p0_read')} = ${i('mem_read')} & ${busId}_sel[0];`,
          `assign ${o('p0_write')} = ${i('mem_write')} & ${busId}_sel[0];`,
          `assign ${o('p1_read')} = ${i('mem_read')} & ${busId}_sel[1];`,
          `assign ${o('p1_write')} = ${i('mem_write')} & ${busId}_sel[1];`,
          `assign ${o('p2_read')} = ${i('mem_read')} & ${busId}_sel[2];`,
          `assign ${o('p2_write')} = ${i('mem_write')} & ${busId}_sel[2];`,
          `assign ${o('p3_read')} = ${i('mem_read')} & ${busId}_sel[3];`,
          `assign ${o('p3_write')} = ${i('mem_write')} & ${busId}_sel[3];`,
          ...(isConnected(wires, 'p4_read', 'output') ? [`assign ${o('p4_read')} = ${i('mem_read')} & ${busId}_sel[4];`] : []),
          ...(isConnected(wires, 'p4_write', 'output') ? [`assign ${o('p4_write')} = ${i('mem_write')} & ${busId}_sel[4];`] : []),
          `// Read data mux`,
          `always @(*) begin`,
          `  case (${busId}_sel)`,
          `    5'd1: ${busId}_read_data = ${i('read_data_0')};`,
          `    5'd2: ${busId}_read_data = ${i('read_data_1')};`,
          `    5'd4: ${busId}_read_data = ${i('read_data_2')};`,
          `    5'd8: ${busId}_read_data = ${i('read_data_3')};`,
          `    5'd16: ${busId}_read_data = ${i('read_data_4')};`,
          `    default: ${busId}_read_data = 32'd0;`,
          `  endcase`,
          `end`,
          `assign ${o('read_data')} = ${busId}_read_data;`,
        ],
      };
    }

    case 'NIC_FIFO':
      return {
        lines: [`// Stub: NIC_FIFO "${id}" — network interface FIFO (complex stateful peripheral, not yet synthesisable)`],
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

/**
 * Check if a primitive type is a base primitive — one that the Verilog
 * exporter handles natively. Derived from the emitPrimitive switch statement.
 * Primitives NOT handled here must have reference circuits to be exportable.
 *
 * This avoids a hardcoded list — if a new case is added to emitPrimitive,
 * it automatically becomes a base primitive.
 */
export function isBasePrimitive(primitiveType: string): boolean {
  // Test by calling emitPrimitive with dummy wires — if it returns
  // a WARNING comment, it's not a base primitive.
  const dummyWires: PrimitiveWires = { inputs: new Map(), outputs: new Map() };
  const result = emitPrimitive({
    nodeId: '__test__',
    primitiveType,
    args: {},
    wires: dummyWires,
    clockName: 'clk',
    target: 'simulation',
  });
  // The default case emits "// WARNING: Unsupported primitive"
  return !result.lines.some(l => l.includes('WARNING: Unsupported primitive'));
}
