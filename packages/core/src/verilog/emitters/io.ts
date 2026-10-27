/**
 * I/O and peripherals: sources that export as their constant, sinks that
 * become module ports, and simulation-only devices that export as a stub.
 */

import { type Emitter, getWidth, isConnected, pins, sanitizeId } from './helpers.js';

/** These become module ports — no logic emitted here */
const port: Emitter = () => ({ lines: [], declarations: [] });

const stub: Emitter = ({ primitiveType, nodeId }) => ({
  lines: [
    `// Stub: ${primitiveType} "${sanitizeId(nodeId)}" (simulation-only sink, no Verilog equivalent)`,
  ],
  declarations: [],
});

export const ioEmitters: Readonly<Record<string, Emitter>> = {
  // ── I/O ──────────────────────────────────────────────────────────
  // A Switch or Input drives its `value` argument, which is what the
  // simulator runs with when nobody toggles it. Exported as that constant.
  Switch: ({ wires, args }) => {
    const { o } = pins(wires);
    return {
      lines: isConnected(wires, 'out', 'output')
        ? [`assign ${o('out')} = 1'b${args.value ? 1 : 0};`]
        : [],
      declarations: [],
    };
  },
  Input: ({ wires, args }) => {
    const { o } = pins(wires);
    const w = getWidth(args);
    const value = typeof args.value === 'number' ? args.value : 0;
    const masked = w >= 32 ? value >>> 0 : (value & (2 ** w - 1)) >>> 0;
    return {
      lines: isConnected(wires, 'out', 'output') ? [`assign ${o('out')} = ${w}'d${masked};`] : [],
      declarations: [],
    };
  },
  // Sinks with no outputs: nothing to drive.
  Led: port,
  Output: port,
  HexDisplay: port,
  SevenSegment: port,

  // ── Display sinks (simulation-only, no hardware equivalent) ──────
  Screen: stub,
  RasterDisplay: stub,
  Console: stub,
  UART_TX: stub,

  NIC_FIFO: ({ nodeId }) => ({
    lines: [
      `// Stub: NIC_FIFO "${sanitizeId(nodeId)}" — network interface FIFO (complex stateful peripheral, not yet synthesisable)`,
    ],
    declarations: [],
  }),
};
