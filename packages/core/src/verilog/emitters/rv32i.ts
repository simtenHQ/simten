/**
 * The RV32I CPU's parts, and MemBusMux, the memory-mapped bus its computer
 * reads and writes through.
 */

import { type Emitter, emitMemoryInit, isConnected, pins, sanitizeId } from './helpers.js';

export const rv32iEmitters: Readonly<Record<string, Emitter>> = {
  // ── RV32I Behavioral Primitives ─────────────────────────────────
  // These are too complex for reference circuits (they'd be hundreds
  // of nodes). Instead, emit behavioral Verilog directly.

  RV32I_Decode: (ctx) => {
    const { wires } = ctx;
    const { i, o } = pins(wires);
    const decLines: string[] = [];
    if (isConnected(wires, 'opcode', 'output'))
      decLines.push(`assign ${o('opcode')} = ${i('instruction')}[6:0];`);
    if (isConnected(wires, 'rd', 'output'))
      decLines.push(`assign ${o('rd')} = ${i('instruction')}[11:7];`);
    if (isConnected(wires, 'funct3', 'output'))
      decLines.push(`assign ${o('funct3')} = ${i('instruction')}[14:12];`);
    if (isConnected(wires, 'rs1', 'output'))
      decLines.push(`assign ${o('rs1')} = ${i('instruction')}[19:15];`);
    if (isConnected(wires, 'rs2', 'output'))
      decLines.push(`assign ${o('rs2')} = ${i('instruction')}[24:20];`);
    if (isConnected(wires, 'funct7', 'output'))
      decLines.push(`assign ${o('funct7')} = ${i('instruction')}[31:25];`);
    return { lines: decLines, declarations: [] };
  },

  RV32I_ALU: (ctx) => {
    const { wires } = ctx;
    const { i, o } = pins(wires);
    const id = sanitizeId(ctx.nodeId);
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
        ...(isConnected(wires, 'zero', 'output')
          ? [`assign ${o('zero')} = (${resultWire} == 32'd0);`]
          : []),
      ],
    };
  },

  RV32I_ImmGen: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
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
  },

  RV32I_Control: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
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
  },

  RV32I_BranchComp: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
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
  },

  RV32I_RegisterFile: (ctx) => {
    const { wires, clockName, resetName } = ctx;
    const { i, o } = pins(wires);
    const id = sanitizeId(ctx.nodeId);
    const rfName = `rf_${id}`;
    const initLines: string[] = [
      `initial begin : ${rfName}_init`,
      `  integer i;`,
      `  for (i = 0; i < 32; i = i + 1) ${rfName}[i] = 32'd0;`,
      `end`,
    ];
    if (ctx.target === 'simulation') {
      for (const init of ctx.stateInits ?? []) {
        initLines.push(...emitMemoryInit(rfName, init, ctx));
      }
    }
    return {
      declarations: [
        `reg [31:0] ${rfName} [0:31];`,
        // Debug read port: added in WS4b for the /learn/cpu scan interface.
        // See RV32I_RegisterFile in packages/core/src/std/rv32i.ts.
      ],
      lines: [
        ...initLines,
        `integer ${rfName}_i;`,
        `always @(posedge ${clockName}) begin`,
        `  if (!${resetName}) begin`,
        `    for (${rfName}_i = 0; ${rfName}_i < 32; ${rfName}_i = ${rfName}_i + 1) ${rfName}[${rfName}_i] <= 32'd0;`,
        `  end else if (${i('we')} && ${i('rd')} != 5'd0) ${rfName}[${i('rd')}] <= ${i('write_data')};`,
        `end`,
        `assign ${o('read1')} = (${i('rs1')} == 5'd0) ? 32'd0 : ${rfName}[${i('rs1')}];`,
        `assign ${o('read2')} = (${i('rs2')} == 5'd0) ? 32'd0 : ${rfName}[${i('rs2')}];`,
        ...(isConnected(wires, 'debug_read', 'output')
          ? [
              `assign ${o('debug_read')} = (${i('debug_rs')} == 5'd0) ? 32'd0 : ${rfName}[${i('debug_rs')}];`,
            ]
          : []),
      ],
    };
  },

  RV32I_InstrMem: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
    const imemName = `imem_${id}`;
    const aw = 16; // 64KB = 2^16
    const initLines: string[] = [];
    if (ctx.target === 'simulation') {
      for (const init of ctx.stateInits ?? []) {
        initLines.push(...emitMemoryInit(imemName, init, ctx));
      }
    }
    return {
      declarations: [`reg [31:0] ${imemName} [0:${(1 << aw) - 1}];`],
      lines: [...initLines, `assign ${o('instruction')} = ${imemName}[${i('addr')}[${aw + 1}:2]];`],
    };
  },

  RV32I_DataMem: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const { clockName, resetName } = ctx;
    const id = sanitizeId(ctx.nodeId);
    const dmemName = `dmem_${id}`;
    const aw = 16;
    const initLines: string[] = [];
    if (ctx.target === 'simulation') {
      for (const init of ctx.stateInits ?? []) {
        initLines.push(...emitMemoryInit(dmemName, init, ctx));
      }
    }
    return {
      declarations: [`reg [31:0] ${dmemName} [0:${(1 << aw) - 1}];`],
      lines: [
        ...initLines,
        `// Data memory (writes suppressed during reset; contents preserved)`,
        `always @(posedge ${clockName}) begin`,
        `  if (${i('mem_write')} && ${resetName}) ${dmemName}[${i('addr')}[${aw + 1}:2]] <= ${i('write_data')};`,
        `end`,
        `assign ${o('read_data')} = ${i('mem_read')} ? ${dmemName}[${i('addr')}[${aw + 1}:2]] : 32'd0;`,
      ],
    };
  },

  RV32I_LoadAlign: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
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
  },

  RV32I_LoadAlignFull: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
    const byte_wire = `la2b_${id}`;
    const half_wire = `la2h_${id}`;
    const out_wire = `la2_${id}`;
    return {
      declarations: [
        `wire [7:0] ${byte_wire};`,
        `wire [15:0] ${half_wire};`,
        `reg [31:0] ${out_wire};`,
      ],
      lines: [
        `assign ${byte_wire} = (${i('byte_offset')} == 2'd3) ? ${i('data')}[31:24] :`,
        `                      (${i('byte_offset')} == 2'd2) ? ${i('data')}[23:16] :`,
        `                      (${i('byte_offset')} == 2'd1) ? ${i('data')}[15:8]  :`,
        `                                                       ${i('data')}[7:0];`,
        `assign ${half_wire} = ${i('byte_offset')}[1] ? ${i('data')}[31:16] : ${i('data')}[15:0];`,
        `always @(*) begin`,
        `  case (${i('funct3')})`,
        `    3'd0: ${out_wire} = {{24{${byte_wire}[7]}}, ${byte_wire}};`,
        `    3'd1: ${out_wire} = {{16{${half_wire}[15]}}, ${half_wire}};`,
        `    3'd4: ${out_wire} = {24'd0, ${byte_wire}};`,
        `    3'd5: ${out_wire} = {16'd0, ${half_wire}};`,
        `    default: ${out_wire} = ${i('data')};`,
        `  endcase`,
        `end`,
        `assign ${o('out')} = ${out_wire};`,
      ],
    };
  },

  RV32I_ForwardingUnit: (ctx) => {
    const { i, o } = pins(ctx.wires);
    return {
      declarations: [],
      lines: [
        `assign ${o('forward_a')} = (${i('ex_reg_write')} && ${i('ex_rd')} != 5'd0 && ${i('ex_rd')} == ${i('id_rs1')}) ? 2'd1 :`,
        `                            (${i('mem_reg_write')} && ${i('mem_rd')} != 5'd0 && ${i('mem_rd')} == ${i('id_rs1')}) ? 2'd2 : 2'd0;`,
        `assign ${o('forward_b')} = (${i('ex_reg_write')} && ${i('ex_rd')} != 5'd0 && ${i('ex_rd')} == ${i('id_rs2')}) ? 2'd1 :`,
        `                            (${i('mem_reg_write')} && ${i('mem_rd')} != 5'd0 && ${i('mem_rd')} == ${i('id_rs2')}) ? 2'd2 : 2'd0;`,
      ],
    };
  },

  RV32I_WBBypass: (ctx) => {
    const { i, o } = pins(ctx.wires);
    return {
      declarations: [],
      lines: [
        `assign ${o('out')} = (${i('wb_we')} && ${i('wb_rd')} != 5'd0 && ${i('wb_rd')} == ${i('rs_addr')}) ? ${i('wb_val')} : ${i('rs_val')};`,
      ],
    };
  },

  RV32I_HazardUnit: (ctx) => {
    const { i, o } = pins(ctx.wires);
    return {
      declarations: [],
      lines: [
        `assign ${o('stall')} = (${i('id_mem_read')} && ${i('id_rd')} != 5'd0 && (${i('id_rd')} == ${i('if_rs1')} || ${i('id_rd')} == ${i('if_rs2')})) ? 1'b1 : 1'b0;`,
        `assign ${o('flush')} = (${i('branch_taken')} || ${i('jump')}) ? 1'b1 : 1'b0;`,
      ],
    };
  },

  RV32I_WritebackMux: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
    const tmp = `wbmux_${id}`;
    return {
      declarations: [`reg [31:0] ${tmp};`],
      lines: [
        `always @(*) begin`,
        `  if (${i('jump')})           ${tmp} = ${i('pc_plus4')};`,
        `  else if (${i('auipc')})     ${tmp} = ${i('pc_plus_imm')};`,
        `  else if (${i('lui')})       ${tmp} = ${i('immediate')};`,
        `  else if (${i('mem_to_reg')}) ${tmp} = ${i('load_data')};`,
        `  else                        ${tmp} = ${i('alu_result')};`,
        `end`,
        `assign ${o('write_data')} = ${tmp};`,
      ],
    };
  },

  RV32I_NextPCMux: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const id = sanitizeId(ctx.nodeId);
    const tmp = `pcmux_${id}`;
    return {
      declarations: [`reg [31:0] ${tmp};`],
      lines: [
        `always @(*) begin`,
        `  if (${i('jump')} && ${i('is_jalr')}) ${tmp} = ${i('jalr_target')} & 32'hFFFFFFFE;`,
        `  else if (${i('jump')})               ${tmp} = ${i('jal_target')};`,
        `  else if (${i('branch')} && ${i('take_branch')}) ${tmp} = ${i('branch_target')};`,
        `  else                                 ${tmp} = ${i('pc_plus4')};`,
        `end`,
        `assign ${o('next_pc')} = ${tmp};`,
      ],
    };
  },

  MemBusMux: (ctx) => {
    const { wires } = ctx;
    const { i, o } = pins(wires);
    const id = sanitizeId(ctx.nodeId);
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
        ...(isConnected(wires, 'p4_read', 'output')
          ? [`assign ${o('p4_read')} = ${i('mem_read')} & ${busId}_sel[4];`]
          : []),
        ...(isConnected(wires, 'p4_write', 'output')
          ? [`assign ${o('p4_write')} = ${i('mem_write')} & ${busId}_sel[4];`]
          : []),
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
  },
};
