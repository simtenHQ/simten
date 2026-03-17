/**
 * Networking Primitive Unit Tests
 *
 * Tests MemBusMux, UART_TX, and NIC_FIFO primitives in isolation.
 */

import { describe, it, expect } from 'vitest';
import { simulateCircuit } from '../../api/simulate.js';

/** Helper: simulate a 1-tick combinational circuit, return output values */
function sim(source: string, inputs: Record<string, number | boolean> = {}): Record<string, number | boolean> {
  const result = simulateCircuit({ source, ticks: 1, inputs });
  if ('error' in result) throw new Error(result.error);
  const out: Record<string, number | boolean> = {};
  for (const [key, rle] of Object.entries(result.signals)) {
    out[key] = rle[0].value;
  }
  return out;
}

/** Helper: simulate multi-tick, return final state */
function simState(source: string, ticks: number, inputs: Record<string, number | boolean> = {}) {
  const result = simulateCircuit({ source, ticks, inputs });
  if ('error' in result) throw new Error(result.error);
  return result;
}

// ============================================================================
// MemBusMux
// ============================================================================

describe('MemBusMux', () => {
  const circuit = `circuit T {
    input addr: Bus[32]
    input write_data: Bus[32]
    input mem_read: Bit
    input mem_write: Bit
    input funct3: Bus[3]
    input rd0: Bus[32]
    input rd1: Bus[32]
    input rd2: Bus[32]
    input rd3: Bus[32]
    output local_addr: Bus[32]
    output read_data: Bus[32]
    output p0_read: Bit
    output p0_write: Bit
    output p1_read: Bit
    output p1_write: Bit
    output p2_read: Bit
    output p2_write: Bit
    output p3_read: Bit
    output p3_write: Bit
    impl {
      node mux: MemBusMux
      connect addr -> mux.addr
      connect write_data -> mux.write_data
      connect mem_read -> mux.mem_read
      connect mem_write -> mux.mem_write
      connect funct3 -> mux.funct3
      connect rd0 -> mux.read_data_0
      connect rd1 -> mux.read_data_1
      connect rd2 -> mux.read_data_2
      connect rd3 -> mux.read_data_3
      connect mux.local_addr -> local_addr
      connect mux.read_data -> read_data
      connect mux.p0_read -> p0_read
      connect mux.p0_write -> p0_write
      connect mux.p1_read -> p1_read
      connect mux.p1_write -> p1_write
      connect mux.p2_read -> p2_read
      connect mux.p2_write -> p2_write
      connect mux.p3_read -> p3_read
      connect mux.p3_write -> p3_write
    }
  }`;

  it('routes DataMem range (0x10000) to p0', () => {
    const out = sim(circuit, {
      addr: 0x10004, mem_read: true, mem_write: false, funct3: 2,
      write_data: 0, rd0: 0xDEADBEEF, rd1: 0, rd2: 0, rd3: 0,
    });
    expect(out.p0_read).toBe(true);
    expect(out.p0_write).toBe(false);
    expect(out.p1_read).toBe(false);
    expect(out.local_addr).toBe(4); // 0x10004 - 0x10000
    expect((out.read_data as number) >>> 0).toBe(0xDEADBEEF >>> 0);
  });

  it('routes UART range (0x80000000) to p1', () => {
    const out = sim(circuit, {
      addr: 0x80000000, mem_write: true, mem_read: false, funct3: 0,
      write_data: 0x41, rd0: 0, rd1: 42, rd2: 0, rd3: 0,
    });
    expect(out.p1_write).toBe(true);
    expect(out.p1_read).toBe(false);
    expect(out.p0_write).toBe(false);
    expect(out.local_addr).toBe(0);
  });

  it('routes NIC TX range (0x80001000) to p2', () => {
    const out = sim(circuit, {
      addr: 0x80001008, mem_read: true, mem_write: false, funct3: 2,
      write_data: 0, rd0: 0, rd1: 0, rd2: 99, rd3: 0,
    });
    expect(out.p2_read).toBe(true);
    expect(out.local_addr).toBe(8);
    expect(out.read_data).toBe(99);
  });

  it('routes NIC RX range (0x80002000) to p3', () => {
    const out = sim(circuit, {
      addr: 0x80002008, mem_read: true, mem_write: false, funct3: 2,
      write_data: 0, rd0: 0, rd1: 0, rd2: 0, rd3: 77,
    });
    expect(out.p3_read).toBe(true);
    expect(out.local_addr).toBe(8);
    expect(out.read_data).toBe(77);
  });

  it('routes nothing when addr is out of range', () => {
    const out = sim(circuit, {
      addr: 0x50000000, mem_read: true, mem_write: false, funct3: 2,
      write_data: 0, rd0: 1, rd1: 2, rd2: 3, rd3: 4,
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
  it('is a sink that accepts writes without error', () => {
    // UART_TX is a sink — we can verify it doesn't error on writes
    // and always returns tx_ready=1 on reads
    const circuit = `circuit T {
      input addr: Bus[32]
      input write_data: Bus[32]
      input mem_read: Bit
      input mem_write: Bit
      output read_data: Bus[32]
      impl {
        node uart: UART_TX
        connect addr -> uart.addr
        connect write_data -> uart.write_data
        connect mem_read -> uart.mem_read
        connect mem_write -> uart.mem_write
        connect uart.read_data -> read_data
      }
    }`;

    // Write 'H' (0x48) for several ticks — should not error
    const result = simState(circuit, 4, {
      addr: 0, write_data: 0x48, mem_write: true, mem_read: false,
    });
    expect('error' in result).toBe(false);
  });

  it('returns tx_ready=1 on read', () => {
    const circuit = `circuit T {
      input addr: Bus[32]
      input write_data: Bus[32]
      input mem_read: Bit
      input mem_write: Bit
      output read_data: Bus[32]
      impl {
        node uart: UART_TX
        connect addr -> uart.addr
        connect write_data -> uart.write_data
        connect mem_read -> uart.mem_read
        connect mem_write -> uart.mem_write
        connect uart.read_data -> read_data
      }
    }`;

    const out = sim(circuit, { addr: 0, write_data: 0, mem_read: true, mem_write: false });
    expect(out.read_data).toBe(1); // tx_ready
  });
});

// ============================================================================
// NIC_FIFO
// ============================================================================

describe('NIC_FIFO', () => {
  const circuit = `circuit T {
    input tx_addr: Bus[32]
    input tx_write_data: Bus[32]
    input tx_mem_read: Bit
    input tx_mem_write: Bit
    input rx_addr: Bus[32]
    input rx_mem_read: Bit
    input rx_mem_write: Bit
    input net_rx_data: Bus[32]
    input net_rx_valid: Bit
    input net_rx_frame: Bit
    output tx_read_data: Bus[32]
    output rx_read_data: Bus[32]
    output net_tx_data: Bus[32]
    output net_tx_valid: Bit
    output net_tx_frame: Bit
    impl {
      node nic: NIC_FIFO
      connect tx_addr -> nic.tx_addr
      connect tx_write_data -> nic.tx_write_data
      connect tx_mem_read -> nic.tx_mem_read
      connect tx_mem_write -> nic.tx_mem_write
      connect rx_addr -> nic.rx_addr
      connect rx_mem_read -> nic.rx_mem_read
      connect rx_mem_write -> nic.rx_mem_write
      connect net_rx_data -> nic.net_rx_data
      connect net_rx_valid -> nic.net_rx_valid
      connect net_rx_frame -> nic.net_rx_frame
      connect nic.tx_read_data -> tx_read_data
      connect nic.rx_read_data -> rx_read_data
      connect nic.net_tx_data -> net_tx_data
      connect nic.net_tx_valid -> net_tx_valid
      connect nic.net_tx_frame -> net_tx_frame
    }
  }`;

  it('receives network data into RX FIFO', () => {
    // Send one word via network RX
    const result = simState(circuit, 4, {
      tx_addr: 0, tx_write_data: 0, tx_mem_read: false, tx_mem_write: false,
      rx_addr: 0x8, rx_mem_read: true, rx_mem_write: false,
      net_rx_data: 0xCAFEBABE, net_rx_valid: true, net_rx_frame: false,
    });
    if ('error' in result) throw new Error(result.error);

    // After 4 ticks of receiving, rx_count should be > 0
    // Check signals for rx_read_data at the last tick
    const rxReadData = result.signals['rx_read_data'];
    expect(rxReadData).toBeDefined();
    // The last RLE entry should show the rx count
    const lastValue = rxReadData[rxReadData.length - 1].value;
    expect(lastValue).toBeGreaterThan(0);
  });

  it('starts with zero rx count', () => {
    const out = sim(circuit, {
      tx_addr: 0, tx_write_data: 0, tx_mem_read: false, tx_mem_write: false,
      rx_addr: 0x8, rx_mem_read: true, rx_mem_write: false,
      net_rx_data: 0, net_rx_valid: false, net_rx_frame: false,
    });
    expect(out.rx_read_data).toBe(0); // no data yet
  });

  it('outputs nothing on network TX before frame-end', () => {
    // Write a word to TX FIFO but don't mark frame-end
    const out = sim(circuit, {
      tx_addr: 0, tx_write_data: 0xDEAD, tx_mem_read: false, tx_mem_write: true,
      rx_addr: 0, rx_mem_read: false, rx_mem_write: false,
      net_rx_data: 0, net_rx_valid: false, net_rx_frame: false,
    });
    expect(out.net_tx_valid).toBe(false);
  });
});
