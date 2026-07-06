/**
 * Networking Primitive Unit Tests
 *
 * Tests MemBusMux, UART_TX, and NIC_FIFO primitives in isolation
 * using the circuit() API.
 */

import { describe, expect, it } from 'vitest';
import type { BuiltCircuit } from '../../circuit/index.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/simulate.js';
import { MemBusMux, NIC_FIFO, UART_TX } from '../../std/index.js';

/** Helper: simulate combinational circuit, return output values */
function sim<C extends BuiltCircuit>(
  built: C,
  inputs: Record<string, number | boolean> = {},
): Record<string, number | boolean> {
  const s = simulate(built);
  try {
    s.set(inputs as any);
    const out: Record<string, number | boolean> = {};
    for (const port of built.circuit.outputs) {
      const v = s.get(port.name as any);
      out[port.name] = port.portType.kind === 'bit' ? Boolean(v) : (v as number);
    }
    return out;
  } finally {
    s.dispose();
  }
}

/** Helper: simulate multi-tick with constant inputs, return last-tick output values */
function simAfterTicks<C extends BuiltCircuit>(
  built: C,
  ticks: number,
  inputs: Record<string, number | boolean> = {},
): Record<string, number | boolean> {
  const s = simulate(built);
  try {
    s.set(inputs as any);
    for (let i = 0; i < ticks; i++) s.tick();
    const out: Record<string, number | boolean> = {};
    for (const port of built.circuit.outputs) {
      const v = s.get(port.name as any);
      out[port.name] = port.portType.kind === 'bit' ? Boolean(v) : (v as number);
    }
    return out;
  } finally {
    s.dispose();
  }
}

// ============================================================================
// MemBusMux
// ============================================================================

describe('MemBusMux', () => {
  const c = circuit('TestMemBusMux', {
    inputs: {
      addr: bus(32),
      write_data: bus(32),
      mem_read: bit,
      mem_write: bit,
      funct3: bus(3),
      rd0: bus(32),
      rd1: bus(32),
      rd2: bus(32),
      rd3: bus(32),
      rd4: bus(32),
    },
    outputs: {
      local_addr: bus(32),
      read_data: bus(32),
      p0_read: bit,
      p0_write: bit,
      p1_read: bit,
      p1_write: bit,
      p2_read: bit,
      p2_write: bit,
      p3_read: bit,
      p3_write: bit,
    },
    nodes: { mux: MemBusMux },
    connect: ({ inputs, outputs, nodes: { mux } }) => [
      inputs.addr.to(mux.addr),
      inputs.write_data.to(mux.write_data),
      inputs.mem_read.to(mux.mem_read),
      inputs.mem_write.to(mux.mem_write),
      inputs.funct3.to(mux.funct3),
      inputs.rd0.to(mux.read_data_0),
      inputs.rd1.to(mux.read_data_1),
      inputs.rd2.to(mux.read_data_2),
      inputs.rd3.to(mux.read_data_3),
      inputs.rd4.to(mux.read_data_4),
      mux.local_addr.to(outputs.local_addr),
      mux.read_data.to(outputs.read_data),
      mux.p0_read.to(outputs.p0_read),
      mux.p0_write.to(outputs.p0_write),
      mux.p1_read.to(outputs.p1_read),
      mux.p1_write.to(outputs.p1_write),
      mux.p2_read.to(outputs.p2_read),
      mux.p2_write.to(outputs.p2_write),
      mux.p3_read.to(outputs.p3_read),
      mux.p3_write.to(outputs.p3_write),
    ],
  });

  it('routes DataMem range (0x10000) to p0', () => {
    const out = sim(c, {
      addr: 0x10004,
      mem_read: true,
      mem_write: false,
      funct3: 2,
      write_data: 0,
      rd0: 0xdeadbeef,
      rd1: 0,
      rd2: 0,
      rd3: 0,
      rd4: 0,
    });
    expect(out.p0_read).toBe(true);
    expect(out.p0_write).toBe(false);
    expect(out.p1_read).toBe(false);
    expect(out.local_addr).toBe(4);
    expect((out.read_data as number) >>> 0).toBe(0xdeadbeef >>> 0);
  });

  it('routes UART range (0x80000000) to p1', () => {
    const out = sim(c, {
      addr: 0x80000000,
      mem_write: true,
      mem_read: false,
      funct3: 0,
      write_data: 0x41,
      rd0: 0,
      rd1: 42,
      rd2: 0,
      rd3: 0,
      rd4: 0,
    });
    expect(out.p1_write).toBe(true);
    expect(out.p1_read).toBe(false);
    expect(out.p0_write).toBe(false);
    expect(out.local_addr).toBe(0);
  });

  it('routes NIC TX range (0x80001000) to p2', () => {
    const out = sim(c, {
      addr: 0x80001008,
      mem_read: true,
      mem_write: false,
      funct3: 2,
      write_data: 0,
      rd0: 0,
      rd1: 0,
      rd2: 99,
      rd3: 0,
      rd4: 0,
    });
    expect(out.p2_read).toBe(true);
    expect(out.local_addr).toBe(8);
    expect(out.read_data).toBe(99);
  });

  it('routes NIC RX range (0x80002000) to p3', () => {
    const out = sim(c, {
      addr: 0x80002008,
      mem_read: true,
      mem_write: false,
      funct3: 2,
      write_data: 0,
      rd0: 0,
      rd1: 0,
      rd2: 0,
      rd3: 77,
      rd4: 0,
    });
    expect(out.p3_read).toBe(true);
    expect(out.local_addr).toBe(8);
    expect(out.read_data).toBe(77);
  });

  it('routes nothing when addr is out of range', () => {
    const out = sim(c, {
      addr: 0x50000000,
      mem_read: true,
      mem_write: false,
      funct3: 2,
      write_data: 0,
      rd0: 1,
      rd1: 2,
      rd2: 3,
      rd3: 4,
      rd4: 0,
    });
    expect(out.p0_read).toBe(false);
    expect(out.p1_read).toBe(false);
    expect(out.p2_read).toBe(false);
    expect(out.p3_read).toBe(false);
    expect(out.read_data).toBe(0);
  });
});

// ============================================================================
// UART_TX
// ============================================================================

describe('UART_TX', () => {
  const uartCircuit = circuit('TestUART', {
    inputs: {
      addr: bus(32),
      write_data: bus(32),
      mem_read: bit,
      mem_write: bit,
    },
    outputs: { read_data: bus(32) },
    nodes: { uart: UART_TX },
    connect: ({ inputs, outputs, nodes: { uart } }) => [
      inputs.addr.to(uart.addr),
      inputs.write_data.to(uart.write_data),
      inputs.mem_read.to(uart.mem_read),
      inputs.mem_write.to(uart.mem_write),
      uart.read_data.to(outputs.read_data),
    ],
  });

  it('is a sink that accepts writes without error', () => {
    expect(() => {
      simAfterTicks(uartCircuit, 4, {
        addr: 0,
        write_data: 0x48,
        mem_write: true,
        mem_read: false,
      });
    }).not.toThrow();
  });

  it('returns tx_ready=1 on read', () => {
    const out = simAfterTicks(uartCircuit, 1, {
      addr: 0,
      write_data: 0,
      mem_read: true,
      mem_write: false,
    });
    expect(out.read_data).toBe(1);
  });
});

// ============================================================================
// NIC_FIFO
// ============================================================================

describe('NIC_FIFO', () => {
  const c = circuit('TestNICFifo', {
    inputs: {
      tx_addr: bus(32),
      tx_write_data: bus(32),
      tx_mem_read: bit,
      tx_mem_write: bit,
      rx_addr: bus(32),
      rx_mem_read: bit,
      rx_mem_write: bit,
      net_rx_data: bus(32),
      net_rx_valid: bit,
      net_rx_frame: bit,
    },
    outputs: {
      tx_read_data: bus(32),
      rx_read_data: bus(32),
      net_tx_data: bus(32),
      net_tx_valid: bit,
      net_tx_frame: bit,
    },
    nodes: { nic: NIC_FIFO },
    connect: ({ inputs, outputs, nodes: { nic } }) => [
      inputs.tx_addr.to(nic.tx_addr),
      inputs.tx_write_data.to(nic.tx_write_data),
      inputs.tx_mem_read.to(nic.tx_mem_read),
      inputs.tx_mem_write.to(nic.tx_mem_write),
      inputs.rx_addr.to(nic.rx_addr),
      inputs.rx_mem_read.to(nic.rx_mem_read),
      inputs.rx_mem_write.to(nic.rx_mem_write),
      inputs.net_rx_data.to(nic.net_rx_data),
      inputs.net_rx_valid.to(nic.net_rx_valid),
      inputs.net_rx_frame.to(nic.net_rx_frame),
      nic.tx_read_data.to(outputs.tx_read_data),
      nic.rx_read_data.to(outputs.rx_read_data),
      nic.net_tx_data.to(outputs.net_tx_data),
      nic.net_tx_valid.to(outputs.net_tx_valid),
      nic.net_tx_frame.to(outputs.net_tx_frame),
    ],
  });

  it('receives network data into RX FIFO', () => {
    const out = simAfterTicks(c, 4, {
      tx_addr: 0,
      tx_write_data: 0,
      tx_mem_read: false,
      tx_mem_write: false,
      rx_addr: 0x8,
      rx_mem_read: true,
      rx_mem_write: false,
      net_rx_data: 0xcafebabe,
      net_rx_valid: true,
      net_rx_frame: false,
    });
    expect(out.rx_read_data as number).toBeGreaterThan(0);
  });

  it('starts with zero rx count', () => {
    const out = sim(c, {
      tx_addr: 0,
      tx_write_data: 0,
      tx_mem_read: false,
      tx_mem_write: false,
      rx_addr: 0x8,
      rx_mem_read: true,
      rx_mem_write: false,
      net_rx_data: 0,
      net_rx_valid: false,
      net_rx_frame: false,
    });
    expect(out.rx_read_data).toBe(0);
  });

  it('outputs nothing on network TX before frame-end', () => {
    const out = sim(c, {
      tx_addr: 0,
      tx_write_data: 0xdead,
      tx_mem_read: false,
      tx_mem_write: true,
      rx_addr: 0,
      rx_mem_read: false,
      rx_mem_write: false,
      net_rx_data: 0,
      net_rx_valid: false,
      net_rx_frame: false,
    });
    expect(out.net_tx_valid).toBe(false);
  });
});
