/**
 * IEEE 802.3 Ethernet Primitive Unit Tests
 *
 * Tests each Ethernet primitive in isolation using the circuit() API.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../../sim/simulate.js';
import { circuit, bit, bus } from '../../circuit/index.js';
import type { BuiltCircuit } from '../../circuit/index.js';
import {
  Eth_ProtocolDecoder, Eth_AddrClassifier, Eth_FrameInput,
  Eth_FrameParser, Eth_CRC32,
} from '../../std/index.js';

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

/** Helper: simulate multi-tick with constant inputs, return per-tick output values */
function simTicks<C extends BuiltCircuit>(
  built: C,
  ticks: number,
  inputs: Record<string, number | boolean> = {},
  preTickSetup?: (s: ReturnType<typeof simulate>) => void,
): Record<string, (number | boolean)[]> {
  const s = simulate(built);
  try {
    if (preTickSetup) preTickSetup(s);
    s.set(inputs as any);
    const out: Record<string, (number | boolean)[]> = {};
    for (const port of built.circuit.outputs) out[port.name] = [];
    for (let i = 0; i < ticks; i++) {
      // Capture pre-edge values to match the legacy trace semantics
      for (const port of built.circuit.outputs) {
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
// Eth_ProtocolDecoder
// ============================================================================

describe('Eth_ProtocolDecoder', () => {
  const c = circuit('TestProtocolDecoder', {
    in: { ethertype: bus(16) },
    out: {
      is_ipv4: bit,
      is_ipv6: bit,
      is_arp: bit,
      is_vlan: bit,
      is_mpls: bit,
    },
    nodes: { d: Eth_ProtocolDecoder },
    connect: ({ in: inp, out, d }) => [
      inp.ethertype.to(d.ethertype),
      d.is_ipv4.to(out.is_ipv4),
      d.is_ipv6.to(out.is_ipv6),
      d.is_arp.to(out.is_arp),
      d.is_vlan.to(out.is_vlan),
      d.is_mpls.to(out.is_mpls),
    ],
  });

  it('decodes IPv4 (0x0800)', () => {
    const out = sim(c, { ethertype: 0x0800 });
    expect(out.is_ipv4).toBe(true);
    expect(out.is_ipv6).toBe(false);
    expect(out.is_arp).toBe(false);
  });

  it('decodes IPv6 (0x86DD)', () => {
    const out = sim(c, { ethertype: 0x86DD });
    expect(out.is_ipv6).toBe(true);
    expect(out.is_ipv4).toBe(false);
  });

  it('decodes ARP (0x0806)', () => {
    const out = sim(c, { ethertype: 0x0806 });
    expect(out.is_arp).toBe(true);
    expect(out.is_ipv4).toBe(false);
  });

  it('decodes VLAN (0x8100)', () => {
    const out = sim(c, { ethertype: 0x8100 });
    expect(out.is_vlan).toBe(true);
  });

  it('decodes MPLS (0x8847)', () => {
    const out = sim(c, { ethertype: 0x8847 });
    expect(out.is_mpls).toBe(true);
  });

  it('unknown ethertype sets no flags', () => {
    const out = sim(c, { ethertype: 0x1234 });
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
  const c = circuit('TestAddrClassifier', {
    in: { dst_mac_hi: bus(16), dst_mac_lo: bus(32) },
    out: { is_broadcast: bit, is_multicast: bit, is_unicast: bit },
    nodes: { ac: Eth_AddrClassifier },
    connect: ({ in: inp, out, ac }) => [
      inp.dst_mac_hi.to(ac.dst_mac_hi),
      inp.dst_mac_lo.to(ac.dst_mac_lo),
      ac.is_broadcast.to(out.is_broadcast),
      ac.is_multicast.to(out.is_multicast),
      ac.is_unicast.to(out.is_unicast),
    ],
  });

  it('detects broadcast FF:FF:FF:FF:FF:FF', () => {
    const out = sim(c, { dst_mac_hi: 0xFFFF, dst_mac_lo: 0xFFFFFFFF });
    expect(out.is_broadcast).toBe(true);
    expect(out.is_multicast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects multicast 01:00:5E:xx:xx:xx (I/G bit set)', () => {
    const out = sim(c, { dst_mac_hi: 0x0001, dst_mac_lo: 0x01005E00 });
    expect(out.is_multicast).toBe(true);
    expect(out.is_broadcast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects unicast 00:1A:2B:3C:4D:5E', () => {
    const out = sim(c, { dst_mac_hi: 0x4D5E, dst_mac_lo: 0x001A2B3C });
    expect(out.is_unicast).toBe(true);
    expect(out.is_broadcast).toBe(false);
    expect(out.is_multicast).toBe(false);
  });

  it('detects IPv6 multicast 33:33:xx:xx:xx:xx', () => {
    const out = sim(c, { dst_mac_hi: 0x0001, dst_mac_lo: 0x33330000 });
    expect(out.is_multicast).toBe(true);
  });
});

// ============================================================================
// Eth_FrameInput
// ============================================================================

describe('Eth_FrameInput', () => {
  const c = circuit('TestFrameInput', {
    in: { enable: bit, reset: bit },
    out: {
      tdata: bus(32),
      tkeep: bus(4),
      tvalid: bit,
      tlast: bit,
      byte_offset: bus(16),
    },
    nodes: { fi: Eth_FrameInput },
    connect: ({ in: inp, out, fi }) => [
      inp.enable.to(fi.enable),
      inp.reset.to(fi.reset),
      fi.tdata.to(out.tdata),
      fi.tkeep.to(out.tkeep),
      fi.tvalid.to(out.tvalid),
      fi.tlast.to(out.tlast),
      fi.byte_offset.to(out.byte_offset),
    ],
  });

  function loadFrame(s: ReturnType<typeof simulate>, bytes: number[]) {
    const memory = new Map<number, number>();
    bytes.forEach((b, i) => memory.set(i, b));
    s.setNode('fi', memory);
  }

  it('streams 8-byte frame in 2 cycles', () => {
    const out = simTicks(
      c,
      4,
      { enable: true, reset: false },
      (s) => loadFrame(s, [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22]),
    );

    // Tick 0: pre-first-clock, registers not yet populated
    expect(out.tvalid[0]).toBe(false);

    // Tick 1: first 4 bytes big-endian
    expect((out.tdata[1] as number) >>> 0).toBe(0xAABBCCDD);
    expect(out.tkeep[1]).toBe(0xF);
    expect(out.tvalid[1]).toBe(true);
    expect(out.tlast[1]).toBe(false);

    // Tick 2: next 4 bytes, last word
    expect((out.tdata[2] as number) >>> 0).toBe(0xEEFF1122);
    expect(out.tkeep[2]).toBe(0xF);
    expect(out.tvalid[2]).toBe(true);
    expect(out.tlast[2]).toBe(true);

    // Tick 3: no more data
    expect(out.tvalid[3]).toBe(false);
  });

  it('handles partial last word (5 bytes = 1 full + 1 partial)', () => {
    const out = simTicks(
      c,
      4,
      { enable: true, reset: false },
      (s) => loadFrame(s, [0x01, 0x02, 0x03, 0x04, 0x05]),
    );

    expect(out.tvalid[0]).toBe(false);

    expect((out.tdata[1] as number) >>> 0).toBe(0x01020304);
    expect(out.tkeep[1]).toBe(0xF);
    expect(out.tlast[1]).toBe(false);

    expect(out.tkeep[2]).toBe(0x8);
    expect(out.tlast[2]).toBe(true);
    expect(((out.tdata[2] as number) >>> 24) & 0xFF).toBe(0x05);
  });

  it('reports byte_offset correctly', () => {
    const bytes: number[] = [];
    for (let i = 0; i < 12; i++) bytes.push(i);
    const out = simTicks(
      c,
      5,
      { enable: true, reset: false },
      (s) => loadFrame(s, bytes),
    );
    expect(out.byte_offset[1]).toBe(0);
    expect(out.byte_offset[2]).toBe(4);
    expect(out.byte_offset[3]).toBe(8);
  });
});

// ============================================================================
// Eth_CRC32
// ============================================================================

describe('Eth_CRC32', () => {
  const c = circuit('TestCRC32', {
    in: { data: bus(32), data_valid: bit, tkeep: bus(4), tlast: bit, reset: bit },
    out: { crc: bus(32), crc_ok: bit },
    nodes: { cr: Eth_CRC32 },
    connect: ({ in: inp, out, cr }) => [
      inp.data.to(cr.data),
      inp.data_valid.to(cr.data_valid),
      inp.tkeep.to(cr.tkeep),
      inp.tlast.to(cr.tlast),
      inp.reset.to(cr.reset),
      cr.crc.to(out.crc),
      cr.crc_ok.to(out.crc_ok),
    ],
  });

  it('computes CRC-32 and updates state', () => {
    const out = simTicks(c, 2, {
      data: 0x49454E44,
      data_valid: true,
      tkeep: 0xF,
      tlast: true,
      reset: false,
    });

    const crcVal = (out.crc[1] as number) >>> 0;
    expect(crcVal).not.toBe(0);
    expect(out.crc_ok[1]).toBe(false);
  });
});

// ============================================================================
// Eth_FrameParser
// ============================================================================

describe('Eth_FrameParser', () => {
  const c = circuit('TestFrameParser', {
    in: { tdata: bus(32), tkeep: bus(4), tvalid: bit, tlast: bit },
    out: {
      dst_mac_hi: bus(16),
      dst_mac_lo: bus(32),
      dst_mac_valid: bit,
      src_mac_hi: bus(16),
      src_mac_lo: bus(32),
      src_mac_valid: bit,
      ethertype: bus(16),
      ethertype_valid: bit,
      has_vlan: bit,
      vlan_tci: bus(16),
      payload_valid: bit,
      frame_done: bit,
      parse_state: bus(4),
      frame_length: bus(16),
    },
    nodes: { p: Eth_FrameParser },
    connect: ({ in: inp, out, p }) => [
      inp.tdata.to(p.tdata),
      inp.tkeep.to(p.tkeep),
      inp.tvalid.to(p.tvalid),
      inp.tlast.to(p.tlast),
      p.dst_mac_hi.to(out.dst_mac_hi),
      p.dst_mac_lo.to(out.dst_mac_lo),
      p.dst_mac_valid.to(out.dst_mac_valid),
      p.src_mac_hi.to(out.src_mac_hi),
      p.src_mac_lo.to(out.src_mac_lo),
      p.src_mac_valid.to(out.src_mac_valid),
      p.ethertype.to(out.ethertype),
      p.ethertype_valid.to(out.ethertype_valid),
      p.has_vlan.to(out.has_vlan),
      p.vlan_tci.to(out.vlan_tci),
      p.payload_valid.to(out.payload_valid),
      p.frame_done.to(out.frame_done),
      p.parse_state.to(out.parse_state),
      p.frame_length.to(out.frame_length),
    ],
  });

  it('advances FSM state on valid data', () => {
    const out = simTicks(c, 3, {
      tdata: 0xAABBCCDD,
      tkeep: 0xF,
      tvalid: true,
      tlast: false,
    });

    // Tick 0: initial state (IDLE)
    expect(out.parse_state[0]).toBe(0);

    // Tick 1: FSM processed first word
    expect(out.parse_state[1]).toBe(2);
    expect((out.dst_mac_lo[1] as number) >>> 0).toBe(0xAABBCCDD);

    // Tick 2: FSM processed second word
    expect(out.parse_state[2]).toBe(3);
  });
});
