/**
 * I/O and peripherals: sources that export as their constant, sinks that
 * become module ports, and simulation-only devices that export as a stub.
 */

import { type Emitter, getWidth, isConnected, pins, sanitizeId } from './helpers.js';

/** These become module ports — no logic emitted here */
const port: Emitter = () => ({ lines: [], declarations: [] });

/** A simulation-only sink with no outputs: its state lives only in the simulator. */
const stub: Emitter = () => ({ lines: [], declarations: [] });

/**
 * A simulation-only display. Its outputs read 0 in the simulator (the canvas
 * does the scanning), so each connected one is tied to 0.
 */
const display: Emitter = ({ wires }) => ({
  lines: [...wires.outputs.values()].map((net) => `assign ${net} = 0;`),
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
  Screen: display,
  RasterDisplay: display,
  PaletteDisplay: stub,
  Console: stub,
  // Its transmit buffer is simulation-only, but a read returns 1 (ready).
  UART_TX: ({ wires }) => {
    const { i, o } = pins(wires);
    return {
      lines: isConnected(wires, 'read_data', 'output')
        ? [`assign ${o('read_data')} = {31'd0, ${i('mem_read')}};`]
        : [],
      declarations: [],
    };
  },

  NIC_FIFO: ({ nodeId }) => ({
    lines: [
      `// Stub: NIC_FIFO "${sanitizeId(nodeId)}" — network interface FIFO (complex stateful peripheral, not yet synthesisable)`,
    ],
    declarations: [],
  }),
};
