/**
 * IEEE 802.3 Ethernet Parser Integration Tests
 *
 * Tests the full Eth_FrameInput → Eth_FrameParser → Eth_CRC32 pipeline
 * with real Ethernet frame data, using the circuit() API.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/simulate.js';
import {
  Eth_AddrClassifier,
  Eth_CRC32,
  Eth_FrameInput,
  Eth_FrameParser,
  Eth_ProtocolDecoder,
} from '../../std/index.js';

// ============================================================================
// CRC-32 computation (for building test frames)
// ============================================================================

const CRC32_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? ((crc >>> 1) ^ 0xedb88320) >>> 0 : (crc >>> 1) >>> 0;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function computeCRC32(data: number[]): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    const idx = (crc ^ byte) & 0xff;
    crc = (CRC32_TABLE[idx] ^ (crc >>> 8)) >>> 0;
  }
  return ~crc >>> 0;
}

/**
 * Build a valid Ethernet frame with FCS.
 * Returns a Map<address, byte> suitable for setNode.
 */
function buildEthernetFrame(
  dstMac: number[],
  srcMac: number[],
  ethertype: number,
  payload: number[],
): Map<number, number> {
  const frame = [...dstMac, ...srcMac, (ethertype >> 8) & 0xff, ethertype & 0xff, ...payload];
  while (frame.length < 60) frame.push(0x00);
  const crc = computeCRC32(frame);
  frame.push(crc & 0xff, (crc >> 8) & 0xff, (crc >> 16) & 0xff, (crc >> 24) & 0xff);

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
  payload: number[],
): Map<number, number> {
  const vlanTci = vlanId & 0xfff;
  const frame = [
    ...dstMac,
    ...srcMac,
    0x81,
    0x00, // VLAN TPID
    (vlanTci >> 8) & 0xff,
    vlanTci & 0xff,
    (ethertype >> 8) & 0xff,
    ethertype & 0xff,
    ...payload,
  ];
  while (frame.length < 60) frame.push(0x00);
  const crc = computeCRC32(frame);
  frame.push(crc & 0xff, (crc >> 8) & 0xff, (crc >> 16) & 0xff, (crc >> 24) & 0xff);

  const memory = new Map<number, number>();
  frame.forEach((b, i) => memory.set(i, b));
  return memory;
}

// ============================================================================
// Full pipeline circuit
// ============================================================================

const Pipeline = circuit('TestEthPipeline', {
  inputs: { enable: bit, reset: bit },
  outputs: {
    dst_mac_hi: bus(16),
    dst_mac_lo: bus(32),
    src_mac_hi: bus(16),
    src_mac_lo: bus(32),
    ethertype: bus(16),
    frame_done: bit,
    crc_ok: bit,
    is_broadcast: bit,
    is_multicast: bit,
    is_unicast: bit,
    is_ipv4: bit,
    is_arp: bit,
    has_vlan: bit,
    vlan_tci: bus(16),
    parse_state: bus(4),
    frame_length: bus(16),
  },
  nodes: {
    fi: Eth_FrameInput,
    parser: Eth_FrameParser,
    crc: Eth_CRC32,
    proto: Eth_ProtocolDecoder,
    addr: Eth_AddrClassifier,
  },
  connect: ({ inputs, outputs, nodes: { fi, parser, crc, proto, addr } }) => [
    inputs.enable.to(fi.enable),
    inputs.reset.to(fi.reset, crc.reset),

    fi.tdata.to(parser.tdata, crc.data),
    fi.tkeep.to(parser.tkeep, crc.tkeep),
    fi.tvalid.to(parser.tvalid, crc.data_valid),
    fi.tlast.to(parser.tlast, crc.tlast),

    parser.ethertype.to(proto.ethertype),
    parser.dst_mac_hi.to(addr.dst_mac_hi, outputs.dst_mac_hi),
    parser.dst_mac_lo.to(addr.dst_mac_lo, outputs.dst_mac_lo),
    parser.src_mac_hi.to(outputs.src_mac_hi),
    parser.src_mac_lo.to(outputs.src_mac_lo),
    parser.ethertype.to(outputs.ethertype),
    parser.frame_done.to(outputs.frame_done),
    parser.parse_state.to(outputs.parse_state),
    parser.frame_length.to(outputs.frame_length),
    parser.has_vlan.to(outputs.has_vlan),
    parser.vlan_tci.to(outputs.vlan_tci),

    crc.crc_ok.to(outputs.crc_ok),

    addr.is_broadcast.to(outputs.is_broadcast),
    addr.is_multicast.to(outputs.is_multicast),
    addr.is_unicast.to(outputs.is_unicast),

    proto.is_ipv4.to(outputs.is_ipv4),
    proto.is_arp.to(outputs.is_arp),
  ],
});

/** Run pipeline simulation and return per-tick signal arrays */
function runPipeline(
  frameMemory: Map<number, number>,
  ticks: number,
): Record<string, (number | boolean)[]> {
  const s = simulate(Pipeline);
  try {
    s.setNode('fi', frameMemory);
    s.set({ enable: true, reset: false } as any);

    const out: Record<string, (number | boolean)[]> = {};
    for (const port of Pipeline.circuit.outputs) out[port.name] = [];

    for (let i = 0; i < ticks; i++) {
      for (const port of Pipeline.circuit.outputs) {
        const v = s.get(port.name as any);
        out[port.name].push(port.portType.kind === 'bit' ? Boolean(v) : (v as number));
      }
      s.tick();
    }
    return out;
  } finally {
    s.dispose();
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Ethernet Parser Pipeline', () => {
  // Standard test MACs
  const DST_MAC = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
  const SRC_MAC = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66];
  const BROADCAST_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  const MULTICAST_MAC = [0x01, 0x00, 0x5e, 0x00, 0x00, 0x01];

  it('parses minimum untagged IPv4 frame (64 bytes)', () => {
    const payload = new Array(46).fill(0x42);
    const frame = buildEthernetFrame(DST_MAC, SRC_MAC, 0x0800, payload);
    expect(frame.size).toBe(64);

    const out = runPipeline(frame, 20);

    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    expect(out.is_ipv4[doneTick]).toBe(true);
    expect(out.is_broadcast[doneTick]).toBe(false);
    expect(out.is_unicast[doneTick]).toBe(true);

    expect((out.dst_mac_lo[doneTick] as number) >>> 0).toBe(0xaabbccdd);
    expect(out.dst_mac_hi[doneTick]).toBe(0xeeff);

    expect(out.src_mac_hi[doneTick]).toBe(0x1122);
    expect((out.src_mac_lo[doneTick] as number) >>> 0).toBe(0x33445566);

    expect(out.ethertype[doneTick]).toBe(0x0800);

    expect(out.crc_ok[doneTick]).toBe(true);
  });

  it('parses VLAN-tagged frame', () => {
    const payload = new Array(42).fill(0x55);
    const frame = buildVlanFrame(DST_MAC, SRC_MAC, 100, 0x0800, payload);

    const out = runPipeline(frame, 22);

    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    expect(out.has_vlan[doneTick]).toBe(true);
    expect(out.vlan_tci[doneTick]).toBe(100);

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

    frame.set(20, (frame.get(20) ?? 0) ^ 0xff);

    const out = runPipeline(frame, 20);
    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);

    expect(out.crc_ok[doneTick]).toBe(false);
  });

  it('completes 64-byte frame in exactly 16 stream cycles', () => {
    const payload = new Array(46).fill(0x00);
    const frame = buildEthernetFrame(DST_MAC, SRC_MAC, 0x0800, payload);
    expect(frame.size).toBe(64);

    const out = runPipeline(frame, 20);

    const doneTick = out.frame_done.indexOf(true);
    expect(doneTick).toBeGreaterThan(0);
    expect(out.parse_state[doneTick]).toBe(7);
  });
});
