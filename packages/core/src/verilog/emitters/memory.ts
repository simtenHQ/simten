/**
 * Everything that holds state: the flip-flop, the register, and the generic
 * ROM and RAM blocks. (The RV32I memories are in rv32i.ts.)
 */

import {
  argMemoryInitBody,
  type Emitter,
  emitArgMemoryInit,
  emitMemoryInit,
  getAddressWidth,
  getDataWidth,
  getWidth,
  isConnected,
  memoryInitBody,
  type PrimitiveContext,
  pins,
  sanitizeId,
} from './helpers.js';

/**
 * A memory's preloaded contents, in simulation only. Per-instance path:
 * `args.memory` from the factory call (e.g. user-supplied ROM contents).
 * Declarative path: `ctx.stateInits` from the component's `mem()` state. Both
 * emit to the same reg; args.memory runs first, then stateInits overlay.
 */
function memoryInits(memName: string, dw: number, ctx: PrimitiveContext): string[] {
  const initLines: string[] = [];
  if (ctx.target === 'simulation') {
    initLines.push(...emitArgMemoryInit(memName, ctx.args.memory, dw));
    for (const init of ctx.stateInits ?? []) {
      initLines.push(...emitMemoryInit(memName, init, ctx));
    }
  }
  return initLines;
}

export const memoryEmitters: Readonly<Record<string, Emitter>> = {
  // ── Sequential: DFlipFlop ────────────────────────────────────────
  DFlipFlop: ({ wires, args, nodeId, clockName, resetName }) => {
    const { i, o } = pins(wires);
    const regName = `reg_${sanitizeId(nodeId)}`;
    const initialBit = args.value ? 1 : 0;
    const initLines = [`initial ${regName} = 1'b${initialBit};`];
    return {
      declarations: [`reg ${regName};`],
      lines: [
        ...initLines,
        `always @(posedge ${clockName}) begin`,
        `  if (!${resetName}) ${regName} <= 1'b${initialBit};`,
        `  else ${regName} <= ${i('d')};`,
        `end`,
        `assign ${o('q')} = ${regName};`,
        ...(isConnected(wires, 'q_bar', 'output') ? [`assign ${o('q_bar')} = ~${regName};`] : []),
      ],
    };
  },

  // ── Sequential: Register ─────────────────────────────────────────
  Register: ({ wires, args, nodeId, clockName, resetName }) => {
    const { i, o } = pins(wires);
    const w = getWidth(args);
    const regName = `reg_${sanitizeId(nodeId)}`;
    const widthStr = w > 1 ? `[${w - 1}:0] ` : '';
    const initialValue = typeof args.value === 'number' ? args.value : 0;
    const initialLiteral = w > 1 ? `${w}'d${initialValue}` : `1'b${initialValue ? 1 : 0}`;
    const initLines = [`initial ${regName} = ${initialLiteral};`];
    const zeroLiteral = w > 1 ? `${w}'d0` : `1'b0`;
    return {
      declarations: [`reg ${widthStr}${regName};`],
      lines: [
        ...initLines,
        `always @(posedge ${clockName}) begin`,
        // Module-level power-on reset (active-low rst_n) → initial value.
        `  if (!${resetName}) ${regName} <= ${initialLiteral};`,
        // Optional per-register synchronous reset (rst) → clears to 0. When
        // unconnected, i('rst') is 1'b0, so this arm folds away in synthesis.
        `  else if (${i('rst')}) ${regName} <= ${zeroLiteral};`,
        `  else if (${i('we')}) ${regName} <= ${i('data')};`,
        `end`,
        `assign ${o('q')} = ${regName};`,
      ],
    };
  },

  // ── Sequential: ROM ──────────────────────────────────────────────
  ROM: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const aw = getAddressWidth(ctx.args, 16);
    const dw = getDataWidth(ctx.args, 8);
    const memName = `mem_${sanitizeId(ctx.nodeId)}`;
    const declarations = [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`];
    const initLines = memoryInits(memName, dw, ctx);

    return {
      declarations,
      lines: [...initLines, `assign ${o('data_out')} = ${memName}[${i('addr')}];`],
    };
  },

  // ── Sequential: RAM ──────────────────────────────────────────────
  RAM: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const { clockName, resetName } = ctx;
    const aw = getAddressWidth(ctx.args, 8);
    const dw = getDataWidth(ctx.args, 8);
    const memName = `mem_${sanitizeId(ctx.nodeId)}`;
    const initLines = memoryInits(memName, dw, ctx);
    return {
      declarations: [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`],
      lines: [
        ...initLines,
        `// Write-first RAM (writes suppressed during reset; contents preserved)`,
        `always @(posedge ${clockName}) begin`,
        `  if (${i('we')} && ${resetName}) ${memName}[${i('addr')}] <= ${i('data_in')};`,
        `end`,
        `assign ${o('data_out')} = ${memName}[${i('addr')}];`,
      ],
    };
  },

  // ── Sequential: DualPortRAM ──────────────────────────────────────
  DualPortRAM: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const { clockName, resetName } = ctx;
    const aw = getAddressWidth(ctx.args, 8);
    const dw = getDataWidth(ctx.args, 8);
    const memName = `mem_${sanitizeId(ctx.nodeId)}`;
    const initLines = memoryInits(memName, dw, ctx);

    return {
      declarations: [`reg [${dw - 1}:0] ${memName} [0:${(1 << aw) - 1}];`],
      lines: [
        ...initLines,
        `// Write-first DualPortRAM (writes suppressed during reset; contents preserved)`,
        `always @(posedge ${clockName}) begin`,
        `  if (${i('weA')} && ${resetName}) ${memName}[${i('addrA')}] <= ${i('dataA')};`,
        `end`,
        `assign ${o('outA')} = ${memName}[${i('addrA')}];`,
        `assign ${o('outB')} = ${memName}[${i('addrB')}];`,
      ],
    };
  },

  // ── Sequential: DualPortROM ──────────────────────────────────────
  // 64 KiB of bytes, read a little-endian word at a time on two ports. Each
  // port reads the word containing its byte address, as the simulator does,
  // and reads 0 past the end of the memory. Unset bytes read 0, so the
  // memory is zeroed before its contents load.
  DualPortROM: (ctx) => {
    const { i, o } = pins(ctx.wires);
    const memName = `mem_${sanitizeId(ctx.nodeId)}`;
    const depth = 65536;
    // Zeroing and contents in one block: two `initial`s at time 0 run in no
    // set order.
    const initLines =
      ctx.target === 'simulation'
        ? [
            `initial begin : ${memName}_init`,
            `  integer k;`,
            `  for (k = 0; k < ${depth}; k = k + 1) ${memName}[k] = 8'd0;`,
            ...(argMemoryInitBody(memName, ctx.args.memory, 8) ?? []),
            ...(ctx.stateInits ?? []).flatMap((init) => memoryInitBody(memName, init, ctx)),
            `end`,
          ]
        : [];
    const port = (addr: string, data: string) => {
      const base = `${memName}_${addr}`;
      return [
        `assign ${base} = ${i(addr)} & ~32'd3;`,
        `assign ${o(data)} = (${base} < 32'd${depth}) ? {${[3, 2, 1, 0].map((k) => `${memName}[${base} + ${k}]`).join(', ')}} : 32'd0;`,
      ];
    };
    return {
      declarations: [
        `reg [7:0] ${memName} [0:${depth - 1}];`,
        `wire [31:0] ${memName}_addrA;`,
        `wire [31:0] ${memName}_addrB;`,
      ],
      lines: [...initLines, ...port('addrA', 'dataA'), ...port('addrB', 'dataB')],
    };
  },
};
