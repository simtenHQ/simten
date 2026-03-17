/**
 * IEEE 802.3 Ethernet Primitive Unit Tests
 *
 * Tests each Ethernet primitive in isolation using inline DSL circuits.
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

/** Helper: simulate multi-tick, return output values at each tick */
function simTicks(
  source: string,
  ticks: number,
  inputs: Record<string, number | boolean> = {},
  memoryData?: Map<string, Map<number, number>>
): Record<string, (number | boolean)[]> {
  const result = simulateCircuit({ source, ticks, inputs, memoryData });
  if ('error' in result) throw new Error(result.error);
  const out: Record<string, (number | boolean)[]> = {};
  for (const [key, rle] of Object.entries(result.signals)) {
    const values: (number | boolean)[] = [];
    for (const { value, count } of rle) {
      for (let i = 0; i < count; i++) values.push(value);
    }
    out[key] = values;
  }
  return out;
}

// ============================================================================
// Eth_ProtocolDecoder
// ============================================================================

describe('Eth_ProtocolDecoder', () => {
  const circuit = `circuit T {
    input ethertype: Bus[16]
    output is_ipv4: Bit
    output is_ipv6: Bit
    output is_arp: Bit
    output is_vlan: Bit
    output is_mpls: Bit
    impl {
      node d: Eth_ProtocolDecoder
      connect ethertype -> d.ethertype
      connect d.is_ipv4 -> is_ipv4
      connect d.is_ipv6 -> is_ipv6
      connect d.is_arp -> is_arp
      connect d.is_vlan -> is_vlan
      connect d.is_mpls -> is_mpls
    }
  }`;

  it('decodes IPv4 (0x0800)', () => {
    const out = sim(circuit, { ethertype: 0x0800 });
    expect(out.is_ipv4).toBe(true);
    expect(out.is_ipv6).toBe(false);
    expect(out.is_arp).toBe(false);
  });

  it('decodes IPv6 (0x86DD)', () => {
    const out = sim(circuit, { ethertype: 0x86DD });
    expect(out.is_ipv6).toBe(true);
    expect(out.is_ipv4).toBe(false);
  });

  it('decodes ARP (0x0806)', () => {
    const out = sim(circuit, { ethertype: 0x0806 });
    expect(out.is_arp).toBe(true);
    expect(out.is_ipv4).toBe(false);
  });

  it('decodes VLAN (0x8100)', () => {
    const out = sim(circuit, { ethertype: 0x8100 });
    expect(out.is_vlan).toBe(true);
  });

  it('decodes MPLS (0x8847)', () => {
    const out = sim(circuit, { ethertype: 0x8847 });
    expect(out.is_mpls).toBe(true);
  });

  it('unknown ethertype sets no flags', () => {
    const out = sim(circuit, { ethertype: 0x1234 });
    expect(out.is_ipv4).toBe(false);
    expect(out.is_ipv6).toBe(false);
    expect(out.is_arp).toBe(false);
    expect(out.is_vlan).toBe(false);
    expect(out.is_mpls).toBe(false);
  });
});

// ============================================================================
// Eth_AddrClassifier
// ============================================================================

describe('Eth_AddrClassifier', () => {
  const circuit = `circuit T {
    input dst_mac_hi: Bus[16]
    input dst_mac_lo: Bus[32]
    output is_broadcast: Bit
    output is_multicast: Bit
    output is_unicast: Bit
    impl {
      node c: Eth_AddrClassifier
      connect dst_mac_hi -> c.dst_mac_hi
      connect dst_mac_lo -> c.dst_mac_lo
      connect c.is_broadcast -> is_broadcast
      connect c.is_multicast -> is_multicast
      connect c.is_unicast -> is_unicast
    }
  }`;

  it('detects broadcast FF:FF:FF:FF:FF:FF', () => {
    const out = sim(circuit, { dst_mac_hi: 0xFFFF, dst_mac_lo: 0xFFFFFFFF });
    expect(out.is_broadcast).toBe(true);
    expect(out.is_multicast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects multicast 01:00:5E:xx:xx:xx (I/G bit set)', () => {
    // MAC 01:00:5E:00:00:01
    // Parser layout: dst_mac_lo = bytes[0:3] = 0x01005E00, dst_mac_hi = bytes[4:5] = 0x0001
    const out = sim(circuit, { dst_mac_hi: 0x0001, dst_mac_lo: 0x01005E00 });
    expect(out.is_multicast).toBe(true);
    expect(out.is_broadcast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects unicast 00:1A:2B:3C:4D:5E', () => {
    // Parser layout: dst_mac_lo = bytes[0:3] = 0x001A2B3C, dst_mac_hi = bytes[4:5] = 0x4D5E
    const out = sim(circuit, { dst_mac_hi: 0x4D5E, dst_mac_lo: 0x001A2B3C });
    expect(out.is_unicast).toBe(true);
    expect(out.is_broadcast).toBe(false);
    expect(out.is_multicast).toBe(false);
  });

  it('detects IPv6 multicast 33:33:xx:xx:xx:xx', () => {
    // Parser layout: dst_mac_lo = bytes[0:3] = 0x33330000, dst_mac_hi = bytes[4:5] = 0x0001
    // Bit 0 of first byte (0x33) = 1 → multicast
    const out = sim(circuit, { dst_mac_hi: 0x0001, dst_mac_lo: 0x33330000 });
    expect(out.is_multicast).toBe(true);
  });
});

// ============================================================================
// Eth_FrameInput
// ============================================================================

describe('Eth_FrameInput', () => {
  const circuit = `circuit T {
    output tdata: Bus[32]
    output tkeep: Bus[4]
    output tvalid: Bit
    output tlast: Bit
    output byte_offset: Bus[16]
    impl {
      node fi: Eth_FrameInput
      node en: Constant(value=1, width=1)
      connect en.out -> fi.enable
      connect fi.tdata -> tdata
      connect fi.tkeep -> tkeep
      connect fi.tvalid -> tvalid
      connect fi.tlast -> tlast
      connect fi.byte_offset -> byte_offset
    }
  }`;

  it('streams 8-byte frame in 2 cycles', () => {
    // 8 bytes: [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22]
    const memory = new Map<number, number>();
    [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22].forEach((b, i) => memory.set(i, b));
    const memoryData = new Map([['eth_frameinput', memory]]);

    const out = simTicks(circuit, 4, {}, memoryData);

    // Tick 0: output registers not yet populated (pre-first clock edge)
    expect(out.tvalid[0]).toBe(false);

    // Tick 1: first 4 bytes big-endian (after first clock edge)
    expect((out.tdata[1] as number) >>> 0).toBe(0xAABBCCDD);
    expect(out.tkeep[1]).toBe(0xF); // all 4 bytes valid
    expect(out.tvalid[1]).toBe(true);
    expect(out.tlast[1]).toBe(false);

    // Tick 2: next 4 bytes, this is the last word
    expect((out.tdata[2] as number) >>> 0).toBe(0xEEFF1122);
    expect(out.tkeep[2]).toBe(0xF);
    expect(out.tvalid[2]).toBe(true);
    expect(out.tlast[2]).toBe(true);

    // Tick 3: no more data
    expect(out.tvalid[3]).toBe(false);
  });

  it('handles partial last word (5 bytes = 1 full + 1 partial)', () => {
    const memory = new Map<number, number>();
    [0x01, 0x02, 0x03, 0x04, 0x05].forEach((b, i) => memory.set(i, b));
    const memoryData = new Map([['eth_frameinput', memory]]);

    const out = simTicks(circuit, 4, {}, memoryData);

    // Tick 0: output registers not yet populated
    expect(out.tvalid[0]).toBe(false);

    // Tick 1: first 4 bytes (after first clock edge)
    expect((out.tdata[1] as number) >>> 0).toBe(0x01020304);
    expect(out.tkeep[1]).toBe(0xF);
    expect(out.tlast[1]).toBe(false);

    // Tick 2: 1 remaining byte in MSB position
    expect(out.tkeep[2]).toBe(0x8); // only bit 3 set (byte at tdata[31:24])
    expect(out.tlast[2]).toBe(true);
    expect(((out.tdata[2] as number) >>> 24) & 0xFF).toBe(0x05);
  });

  it('reports byte_offset correctly', () => {
    const memory = new Map<number, number>();
    for (let i = 0; i < 12; i++) memory.set(i, i);
    const memoryData = new Map([['eth_frameinput', memory]]);

    const out = simTicks(circuit, 5, {}, memoryData);
    // Tick 0: pre-first-clock, tick 1+: output registers populated
    expect(out.byte_offset[1]).toBe(0);
    expect(out.byte_offset[2]).toBe(4);
    expect(out.byte_offset[3]).toBe(8);
  });
});

// ============================================================================
// Eth_CRC32
// ============================================================================

describe('Eth_CRC32', () => {
  it('computes CRC-32 and updates state', () => {
    const circuit = `circuit T {
      input data: Bus[32]
      input data_valid: Bit
      input tkeep: Bus[4]
      input tlast: Bit
      output crc: Bus[32]
      output crc_ok: Bit
      impl {
        node c: Eth_CRC32
        connect data -> c.data
        connect data_valid -> c.data_valid
        connect tkeep -> c.tkeep
        connect tlast -> c.tlast
        connect c.crc -> crc
        connect c.crc_ok -> crc_ok
      }
    }`;

    // Feed 4 bytes as a single word with tlast
    const out = simTicks(circuit, 2, {
      data: 0x49454E44,
      data_valid: true,
      tkeep: 0xF,
      tlast: true,
    });

    // Tick 0: pre-clock snapshot shows initial CRC (zero)
    // Tick 1: CRC processes data from tick 0's clock edge, shows computed value
    const crcVal = (out.crc[1] as number) >>> 0;
    expect(crcVal).not.toBe(0);
    // crc_ok should be false since we didn't feed a complete frame with valid FCS
    expect(out.crc_ok[1]).toBe(false);
  });
});

// ============================================================================
// Eth_FrameParser
// ============================================================================

describe('Eth_FrameParser', () => {
  const circuit = `circuit T {
    input tdata: Bus[32]
    input tkeep: Bus[4]
    input tvalid: Bit
    input tlast: Bit
    output dst_mac_hi: Bus[16]
    output dst_mac_lo: Bus[32]
    output dst_mac_valid: Bit
    output src_mac_hi: Bus[16]
    output src_mac_lo: Bus[32]
    output src_mac_valid: Bit
    output ethertype: Bus[16]
    output ethertype_valid: Bit
    output has_vlan: Bit
    output vlan_tci: Bus[16]
    output payload_valid: Bit
    output frame_done: Bit
    output parse_state: Bus[4]
    output frame_length: Bus[16]
    impl {
      node p: Eth_FrameParser
      connect tdata -> p.tdata
      connect tkeep -> p.tkeep
      connect tvalid -> p.tvalid
      connect tlast -> p.tlast
      connect p.dst_mac_hi -> dst_mac_hi
      connect p.dst_mac_lo -> dst_mac_lo
      connect p.dst_mac_valid -> dst_mac_valid
      connect p.src_mac_hi -> src_mac_hi
      connect p.src_mac_lo -> src_mac_lo
      connect p.src_mac_valid -> src_mac_valid
      connect p.ethertype -> ethertype
      connect p.ethertype_valid -> ethertype_valid
      connect p.has_vlan -> has_vlan
      connect p.vlan_tci -> vlan_tci
      connect p.payload_valid -> payload_valid
      connect p.frame_done -> frame_done
      connect p.parse_state -> parse_state
      connect p.frame_length -> frame_length
    }
  }`;

  it('advances FSM state on valid data', () => {
    // With constant tvalid=true input, each tick advances the FSM.
    // Trace snapshots are captured before the clock edge (Phase 1), so:
    // Tick 0: initial state (IDLE=0), updateState processes first word
    // Tick 1: shows state after first clock edge → DST_MAC_HI_SRC(2)
    // Tick 2: shows state after second clock edge → SRC_MAC(3)

    const out = simTicks(circuit, 3, {
      tdata: 0xAABBCCDD,
      tkeep: 0xF,
      tvalid: true,
      tlast: false,
    });

    // Tick 0: initial state (IDLE)
    expect(out.parse_state[0]).toBe(0);

    // Tick 1: FSM processed first word, now in DST_MAC_HI_SRC
    expect(out.parse_state[1]).toBe(2);
    expect((out.dst_mac_lo[1] as number) >>> 0).toBe(0xAABBCCDD);

    // Tick 2: FSM processed second word, now in SRC_MAC
    expect(out.parse_state[2]).toBe(3);
  });
});
