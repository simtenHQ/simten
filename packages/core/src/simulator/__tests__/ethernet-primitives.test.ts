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
  Eth_ProtocolDecoder,
  Eth_AddrClassifier,
  Eth_FrameInput,
  Eth_FrameParser,
  Eth_CRC32,
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
    inputs: { ethertype: bus(16) },
    outputs: {
      is_ipv4: bit,
      is_ipv6: bit,
      is_arp: bit,
      is_vlan: bit,
      is_mpls: bit,
    },
    nodes: { d: Eth_ProtocolDecoder },
    connect: ({ inputs, outputs, nodes: { d } }) => [
      inputs.ethertype.to(d.ethertype),
      d.is_ipv4.to(outputs.is_ipv4),
      d.is_ipv6.to(outputs.is_ipv6),
      d.is_arp.to(outputs.is_arp),
      d.is_vlan.to(outputs.is_vlan),
      d.is_mpls.to(outputs.is_mpls),
    ],
  });

  it('decodes IPv4 (0x0800)', () => {
    const out = sim(c, { ethertype: 0x0800 });
    expect(out.is_ipv4).toBe(true);
    expect(out.is_ipv6).toBe(false);
    expect(out.is_arp).toBe(false);
  });

  it('decodes IPv6 (0x86DD)', () => {
    const out = sim(c, { ethertype: 0x86dd });
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
    inputs: { dst_mac_hi: bus(16), dst_mac_lo: bus(32) },
    outputs: { is_broadcast: bit, is_multicast: bit, is_unicast: bit },
    nodes: { ac: Eth_AddrClassifier },
    connect: ({ inputs, outputs, nodes: { ac } }) => [
      inputs.dst_mac_hi.to(ac.dst_mac_hi),
      inputs.dst_mac_lo.to(ac.dst_mac_lo),
      ac.is_broadcast.to(outputs.is_broadcast),
      ac.is_multicast.to(outputs.is_multicast),
      ac.is_unicast.to(outputs.is_unicast),
    ],
  });

  it('detects broadcast FF:FF:FF:FF:FF:FF', () => {
    const out = sim(c, { dst_mac_hi: 0xffff, dst_mac_lo: 0xffffffff });
    expect(out.is_broadcast).toBe(true);
    expect(out.is_multicast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects multicast 01:00:5E:xx:xx:xx (I/G bit set)', () => {
    const out = sim(c, { dst_mac_hi: 0x0001, dst_mac_lo: 0x01005e00 });
    expect(out.is_multicast).toBe(true);
    expect(out.is_broadcast).toBe(false);
    expect(out.is_unicast).toBe(false);
  });

  it('detects unicast 00:1A:2B:3C:4D:5E', () => {
    const out = sim(c, { dst_mac_hi: 0x4d5e, dst_mac_lo: 0x001a2b3c });
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
    inputs: { enable: bit, reset: bit },
    outputs: {
      tdata: bus(32),
      tkeep: bus(4),
      tvalid: bit,
      tlast: bit,
      byte_offset: bus(16),
    },
    nodes: { fi: Eth_FrameInput },
    connect: ({ inputs, outputs, nodes: { fi } }) => [
      inputs.enable.to(fi.enable),
      inputs.reset.to(fi.reset),
      fi.tdata.to(outputs.tdata),
      fi.tkeep.to(outputs.tkeep),
      fi.tvalid.to(outputs.tvalid),
      fi.tlast.to(outputs.tlast),
      fi.byte_offset.to(outputs.byte_offset),
    ],
  });

  function loadFrame(s: ReturnType<typeof simulate>, bytes: number[]) {
    const memory = new Map<number, number>();
    bytes.forEach((b, i) => memory.set(i, b));
    s.setNode('fi', memory);
  }

  it('streams 8-byte frame in 2 cycles', () => {
    const out = simTicks(c, 4, { enable: true, reset: false }, (s) =>
      loadFrame(s, [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22]),
    );

    // Tick 0: pre-first-clock, registers not yet populated
    expect(out.tvalid[0]).toBe(false);

    // Tick 1: first 4 bytes big-endian
    expect((out.tdata[1] as number) >>> 0).toBe(0xaabbccdd);
    expect(out.tkeep[1]).toBe(0xf);
    expect(out.tvalid[1]).toBe(true);
    expect(out.tlast[1]).toBe(false);

    // Tick 2: next 4 bytes, last word
    expect((out.tdata[2] as number) >>> 0).toBe(0xeeff1122);
    expect(out.tkeep[2]).toBe(0xf);
    expect(out.tvalid[2]).toBe(true);
    expect(out.tlast[2]).toBe(true);

    // Tick 3: no more data
    expect(out.tvalid[3]).toBe(false);
  });

  it('handles partial last word (5 bytes = 1 full + 1 partial)', () => {
    const out = simTicks(c, 4, { enable: true, reset: false }, (s) =>
      loadFrame(s, [0x01, 0x02, 0x03, 0x04, 0x05]),
    );

    expect(out.tvalid[0]).toBe(false);

    expect((out.tdata[1] as number) >>> 0).toBe(0x01020304);
    expect(out.tkeep[1]).toBe(0xf);
    expect(out.tlast[1]).toBe(false);

    expect(out.tkeep[2]).toBe(0x8);
    expect(out.tlast[2]).toBe(true);
    expect(((out.tdata[2] as number) >>> 24) & 0xff).toBe(0x05);
  });

  it('reports byte_offset correctly', () => {
    const bytes: number[] = [];
    for (let i = 0; i < 12; i++) bytes.push(i);
    const out = simTicks(c, 5, { enable: true, reset: false }, (s) => loadFrame(s, bytes));
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
    inputs: { data: bus(32), data_valid: bit, tkeep: bus(4), tlast: bit, reset: bit },
    outputs: { crc: bus(32), crc_ok: bit },
    nodes: { cr: Eth_CRC32 },
    connect: ({ inputs, outputs, nodes: { cr } }) => [
      inputs.data.to(cr.data),
      inputs.data_valid.to(cr.data_valid),
      inputs.tkeep.to(cr.tkeep),
      inputs.tlast.to(cr.tlast),
      inputs.reset.to(cr.reset),
      cr.crc.to(outputs.crc),
      cr.crc_ok.to(outputs.crc_ok),
    ],
  });

  it('computes CRC-32 and updates state', () => {
    const out = simTicks(c, 2, {
      data: 0x49454e44,
      data_valid: true,
      tkeep: 0xf,
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
    inputs: { tdata: bus(32), tkeep: bus(4), tvalid: bit, tlast: bit },
    outputs: {
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
    connect: ({ inputs, outputs, nodes: { p } }) => [
      inputs.tdata.to(p.tdata),
      inputs.tkeep.to(p.tkeep),
      inputs.tvalid.to(p.tvalid),
      inputs.tlast.to(p.tlast),
      p.dst_mac_hi.to(outputs.dst_mac_hi),
      p.dst_mac_lo.to(outputs.dst_mac_lo),
      p.dst_mac_valid.to(outputs.dst_mac_valid),
      p.src_mac_hi.to(outputs.src_mac_hi),
      p.src_mac_lo.to(outputs.src_mac_lo),
      p.src_mac_valid.to(outputs.src_mac_valid),
      p.ethertype.to(outputs.ethertype),
      p.ethertype_valid.to(outputs.ethertype_valid),
      p.has_vlan.to(outputs.has_vlan),
      p.vlan_tci.to(outputs.vlan_tci),
      p.payload_valid.to(outputs.payload_valid),
      p.frame_done.to(outputs.frame_done),
      p.parse_state.to(outputs.parse_state),
      p.frame_length.to(outputs.frame_length),
    ],
  });

  it('advances FSM state on valid data', () => {
    const out = simTicks(c, 3, {
      tdata: 0xaabbccdd,
      tkeep: 0xf,
      tvalid: true,
      tlast: false,
    });

    // Tick 0: initial state (IDLE)
    expect(out.parse_state[0]).toBe(0);

    // Tick 1: FSM processed first word
    expect(out.parse_state[1]).toBe(2);
    expect((out.dst_mac_lo[1] as number) >>> 0).toBe(0xaabbccdd);

    // Tick 2: FSM processed second word
    expect(out.parse_state[2]).toBe(3);
  });
});
