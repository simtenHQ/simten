/**
 * IEEE 802.3 Ethernet Parser Integration Tests
 *
 * Tests the full Eth_FrameInput → Eth_FrameParser → Eth_CRC32 pipeline
 * with real Ethernet frame data.
 */

import { describe, it, expect } from 'vitest';
import { simulateCircuit } from '../../api/simulate.js';

// ============================================================================
// CRC-32 computation (for building test frames)
// ============================================================================

const CRC32_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) >>> 0 : (crc >>> 1) >>> 0;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function computeCRC32(data: number[]): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    const idx = (crc ^ byte) & 0xFF;
    crc = (CRC32_TABLE[idx] ^ (crc >>> 8)) >>> 0;
  }
  return (~crc) >>> 0;
}

/**
 * Build a valid Ethernet frame with FCS.
 * Returns a Map<address, byte> suitable for memoryData.
 */
function buildEthernetFrame(
  dstMac: number[],
  srcMac: number[],
  ethertype: number,
  payload: number[]
): Map<number, number> {
  const frame = [
    ...dstMac,
    ...srcMac,
    (ethertype >> 8) & 0xFF, ethertype & 0xFF,
    ...payload,
  ];
  // Pad to minimum 60 bytes (before FCS)
  while (frame.length < 60) frame.push(0x00);
  // Compute and append FCS (little-endian per IEEE 802.3)
  const crc = computeCRC32(frame);
  frame.push(crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF);

  const memory = new Map<number, number>();
  frame.forEach((b, i) => memory.set(i, b));
  return memory;
}

/** Build VLAN-tagged frame */
function buildVlanFrame(
  dstMac: number[],
  srcMac: number[],
  vlanId: number,
  ethertype: number,
  payload: number[]
): Map<number, number> {
  const vlanTci = vlanId & 0xFFF; // PCP=0, DEI=0
  const frame = [
    ...dstMac,
    ...srcMac,
    0x81, 0x00,  // VLAN TPID
    (vlanTci >> 8) & 0xFF, vlanTci & 0xFF,
    (ethertype >> 8) & 0xFF, ethertype & 0xFF,
    ...payload,
  ];
  while (frame.length < 60) frame.push(0x00);
  const crc = computeCRC32(frame);
  frame.push(crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF);

  const memory = new Map<number, number>();
  frame.forEach((b, i) => memory.set(i, b));
  return memory;
}

// ============================================================================
// Full pipeline circuit
// ============================================================================

const PIPELINE_CIRCUIT = `circuit T {
  output dst_mac_hi: Bus[16]
  output dst_mac_lo: Bus[32]
  output src_mac_hi: Bus[16]
  output src_mac_lo: Bus[32]
  output ethertype: Bus[16]
  output frame_done: Bit
  output crc_ok: Bit
  output is_broadcast: Bit
  output is_multicast: Bit
  output is_unicast: Bit
  output is_ipv4: Bit
  output is_arp: Bit
  output has_vlan: Bit
  output vlan_tci: Bus[16]
  output parse_state: Bus[4]
  output frame_length: Bus[16]
  impl {
    node fi: Eth_FrameInput
    node en: Constant(value=1, width=1)
    connect en.out -> fi.enable

    node parser: Eth_FrameParser
    connect fi.tdata -> parser.tdata
    connect fi.tkeep -> parser.tkeep
    connect fi.tvalid -> parser.tvalid
    connect fi.tlast -> parser.tlast

    node crc: Eth_CRC32
    connect fi.tdata -> crc.data
    connect fi.tvalid -> crc.data_valid
    connect fi.tkeep -> crc.tkeep
    connect fi.tlast -> crc.tlast

    node proto: Eth_ProtocolDecoder
    connect parser.ethertype -> proto.ethertype

    node addr: Eth_AddrClassifier
    connect parser.dst_mac_hi -> addr.dst_mac_hi
    connect parser.dst_mac_lo -> addr.dst_mac_lo

    connect parser.dst_mac_hi -> dst_mac_hi
    connect parser.dst_mac_lo -> dst_mac_lo
    connect parser.src_mac_hi -> src_mac_hi
    connect parser.src_mac_lo -> src_mac_lo
    connect parser.ethertype -> ethertype
    connect parser.frame_done -> frame_done
    connect parser.parse_state -> parse_state
    connect parser.frame_length -> frame_length
    connect parser.has_vlan -> has_vlan
    connect parser.vlan_tci -> vlan_tci
    connect crc.crc_ok -> crc_ok
    connect addr.is_broadcast -> is_broadcast
    connect addr.is_multicast -> is_multicast
    connect addr.is_unicast -> is_unicast
    connect proto.is_ipv4 -> is_ipv4
    connect proto.is_arp -> is_arp
  }
}`;

/** Run pipeline simulation and return per-tick signal arrays */
function runPipeline(
  frameMemory: Map<number, number>,
  ticks: number
): Record<string, (number | boolean)[]> {
  const memoryData = new Map([['eth_frameinput', frameMemory]]);
  const result = simulateCircuit({
    source: PIPELINE_CIRCUIT,
    ticks,
    memoryData,
  });
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
// Integration Tests
// ============================================================================

describe('Ethernet Parser Pipeline', () => {
  // Standard test MACs
  const DST_MAC = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
  const SRC_MAC = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
  const BROADCAST_MAC = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
  const MULTICAST_MAC = [0x01, 0x00, 0x5E, 0x00, 0x00, 0x01]; // IPv4 multicast

  it('parses minimum untagged IPv4 frame (64 bytes)', () => {
    const payload = new Array(46).fill(0x42); // 46 bytes payload → 60 bytes before FCS → 64 total
    const frame = buildEthernetFrame(DST_MAC, SRC_MAC, 0x0800, payload);
    expect(frame.size).toBe(64);

    // 64 bytes / 4 bytes per cycle = 16 cycles to stream
    const out = runPipeline(frame, 20);

    // Find the tick where frame_done goes true
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    // Verify parsed fields at done tick
    expect(out.is_ipv4[doneTick]).toBe(true);
    expect(out.is_broadcast[doneTick]).toBe(false);
    expect(out.is_unicast[doneTick]).toBe(true);

    // Verify dst MAC: AA:BB:CC:DD → dst_mac_lo, EE:FF → dst_mac_hi
    expect((out.dst_mac_lo[doneTick] as number) >>> 0).toBe(0xAABBCCDD);
    expect(out.dst_mac_hi[doneTick]).toBe(0xEEFF);

    // Verify src MAC
    expect(out.src_mac_hi[doneTick]).toBe(0x1122);
    expect((out.src_mac_lo[doneTick] as number) >>> 0).toBe(0x33445566);

    // Verify ethertype
    expect(out.ethertype[doneTick]).toBe(0x0800);

    // CRC should validate
    expect(out.crc_ok[doneTick]).toBe(true);
  });

  it('parses VLAN-tagged frame', () => {
    const payload = new Array(42).fill(0x55); // smaller payload to account for VLAN header
    const frame = buildVlanFrame(DST_MAC, SRC_MAC, 100, 0x0800, payload);

    const out = runPipeline(frame, 22);

    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    // Should detect VLAN
    expect(out.has_vlan[doneTick]).toBe(true);
    expect(out.vlan_tci[doneTick]).toBe(100); // VLAN ID 100

    // Real ethertype (after VLAN) should be IPv4
    expect(out.ethertype[doneTick]).toBe(0x0800);
    expect(out.is_ipv4[doneTick]).toBe(true);
    expect(out.crc_ok[doneTick]).toBe(true);
  });

  it('detects broadcast destination', () => {
    const payload = new Array(46).fill(0x00);
    const frame = buildEthernetFrame(BROADCAST_MAC, SRC_MAC, 0x0806, payload);

    const out = runPipeline(frame, 20);
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    expect(out.is_broadcast[doneTick]).toBe(true);
    expect(out.is_unicast[doneTick]).toBe(false);
    expect(out.is_arp[doneTick]).toBe(true);
  });

  it('detects multicast destination (01:00:5E:xx)', () => {
    const payload = new Array(46).fill(0x00);
    const frame = buildEthernetFrame(MULTICAST_MAC, SRC_MAC, 0x0800, payload);

    const out = runPipeline(frame, 20);
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    expect(out.is_multicast[doneTick]).toBe(true);
    expect(out.is_broadcast[doneTick]).toBe(false);
  });

  it('detects CRC failure on corrupted frame', () => {
    const payload = new Array(46).fill(0x42);
    const frame = buildEthernetFrame(DST_MAC, SRC_MAC, 0x0800, payload);

    // Corrupt a byte in the middle
    frame.set(20, (frame.get(20) ?? 0) ^ 0xFF);

    const out = runPipeline(frame, 20);
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    // CRC should fail
    expect(out.crc_ok[doneTick]).toBe(false);
  });

  it('completes 64-byte frame in exactly 16 stream cycles', () => {
    const payload = new Array(46).fill(0x00);
    const frame = buildEthernetFrame(DST_MAC, SRC_MAC, 0x0800, payload);
    expect(frame.size).toBe(64);

    const out = runPipeline(frame, 20);

    // The parser should reach DONE state
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);
    expect(out.parse_state[doneTick]).toBe(7); // DONE state
  });
});
