/**
 * Standard Library — Networking / Ethernet Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

// CRC-32 lookup table (IEEE 802.3, polynomial 0xEDB88320 reflected)
const CRC32_TABLE: number[] = (() => {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? ((crc >>> 1) ^ 0xedb88320) >>> 0 : (crc >>> 1) >>> 0;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

/**
 * EtherType → protocol flags. Decodes the 16-bit EtherType field of an
 * Ethernet frame into one-hot flags for the common upper-layer protocols:
 * IPv4 (`0x0800`), IPv6 (`0x86DD`), ARP (`0x0806`), VLAN (`0x8100`),
 * MPLS (`0x8847`).
 *
 * **Input:** `ethertype` — `bus(16)`
 * **Outputs:** `is_ipv4`, `is_ipv6`, `is_arp`, `is_vlan`, `is_mpls` — `bit`
 */
export const Eth_ProtocolDecoder = circuit('Eth_ProtocolDecoder', {
  inputs: { ethertype: bus(16) },
  outputs: { is_ipv4: bit, is_ipv6: bit, is_arp: bit, is_vlan: bit, is_mpls: bit },
  eval: ({ ethertype }) => {
    const et = (ethertype as number) & 0xffff;
    return {
      is_ipv4: et === 0x0800 ? 1 : 0,
      is_ipv6: et === 0x86dd ? 1 : 0,
      is_arp: et === 0x0806 ? 1 : 0,
      is_vlan: et === 0x8100 ? 1 : 0,
      is_mpls: et === 0x8847 ? 1 : 0,
    };
  },
  meta: { category: 'networking', icon: 'EP', description: 'EtherType → protocol flags' },
});

/**
 * MAC address classifier. Examines the 48-bit destination MAC (split
 * across `dst_mac_hi` + `dst_mac_lo`) and emits one-hot flags:
 * - `is_broadcast` — all-ones MAC (`FF:FF:FF:FF:FF:FF`)
 * - `is_multicast` — group bit set (LSB of first octet = 1)
 * - `is_unicast` — neither of the above
 *
 * **Inputs:** `dst_mac_hi` — `bus(16)`; `dst_mac_lo` — `bus(32)`
 * **Outputs:** `is_broadcast`, `is_multicast`, `is_unicast` — `bit`
 */
export const Eth_AddrClassifier = circuit('Eth_AddrClassifier', {
  inputs: { dst_mac_hi: bus(16), dst_mac_lo: bus(32) },
  outputs: { is_broadcast: bit, is_multicast: bit, is_unicast: bit },
  eval: ({ dst_mac_hi, dst_mac_lo }) => {
    const hi = (dst_mac_hi as number) & 0xffff;
    const lo = ((dst_mac_lo as number) & 0xffffffff) >>> 0;
    const isBroadcast = hi === 0xffff && lo === 0xffffffff >>> 0 ? 1 : 0;
    const isMulticast = !isBroadcast && ((lo >>> 24) & 1) === 1 ? 1 : 0;
    const isUnicast = !isBroadcast && !isMulticast ? 1 : 0;
    return { is_broadcast: isBroadcast, is_multicast: isMulticast, is_unicast: isUnicast };
  },
  meta: { category: 'networking', icon: 'EA', description: 'MAC address classifier' },
});

/**
 * Ethernet frame input (AXI-Stream). Reads frame bytes from internal memory
 * and emits them as a 32-bit AXI-Stream — 4 bytes per beat, with `tkeep`
 * indicating which lanes are valid and `tlast` flagging the final beat.
 *
 * **Inputs:** `enable`, `reset` — `bit`
 * **Outputs:** `tdata` — `bus(32)`; `tkeep` — `bus(4)`;
 * `tvalid`, `tlast` — `bit`; `byte_offset` — `bus(16)`
 */
export const Eth_FrameInput = circuit('Eth_FrameInput', {
  inputs: { enable: bit, reset: bit },
  outputs: { tdata: bus(32), tkeep: bus(4), tvalid: bit, tlast: bit, byte_offset: bus(16) },
  state: { memory: new Map<number, number>() },
  eval: ({ memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    const tdata = (mem.get(0x10003) ?? 0) >>> 0;
    const tkeep = (mem.get(0x10004) ?? 0) & 0xf;
    const tvalid = (mem.get(0x10005) ?? 0) !== 0 ? 1 : 0;
    const tlast = (mem.get(0x10006) ?? 0) !== 0 ? 1 : 0;
    const byte_offset = (mem.get(0x10007) ?? 0) & 0xffff;
    return { tdata, tkeep, tvalid, tlast, byte_offset };
  },
  onTick: ({ enable, reset, memory }) => {
    const mem = (memory as Map<number, number>) ?? new Map();
    const REG_READ_PTR = 0x10000,
      REG_FRAME_LEN = 0x10001,
      REG_INITIALIZED = 0x10002;
    const REG_OUT_TDATA = 0x10003,
      REG_OUT_TKEEP = 0x10004;
    const REG_OUT_TVALID = 0x10005,
      REG_OUT_TLAST = 0x10006,
      REG_OUT_OFFSET = 0x10007;

    if (reset) {
      const newMem = new Map(mem);
      newMem.set(REG_READ_PTR, 0);
      newMem.set(REG_INITIALIZED, 0);
      newMem.set(REG_OUT_TVALID, 0);
      newMem.set(REG_OUT_TLAST, 0);
      return { memory: newMem };
    }
    if (!enable) {
      const newMem = new Map(mem);
      newMem.set(REG_OUT_TVALID, 0);
      return { memory: newMem };
    }
    const newMem = new Map(mem);
    if (!(mem.get(REG_INITIALIZED) ?? 0)) {
      let maxAddr = -1;
      for (const addr of mem.keys()) {
        if (addr < 0x10000 && addr > maxAddr) maxAddr = addr;
      }
      newMem.set(REG_FRAME_LEN, maxAddr + 1);
      newMem.set(REG_INITIALIZED, 1);
    }
    const frameLength = newMem.get(REG_FRAME_LEN) ?? 0;
    const readPtr = mem.get(REG_READ_PTR) ?? 0;
    if (readPtr >= frameLength || frameLength === 0) {
      newMem.set(REG_OUT_TDATA, 0);
      newMem.set(REG_OUT_TKEEP, 0);
      newMem.set(REG_OUT_TVALID, 0);
      newMem.set(REG_OUT_TLAST, 0);
      newMem.set(REG_OUT_OFFSET, readPtr & 0xffff);
      return { memory: newMem };
    }
    const remaining = frameLength - readPtr;
    const bytesToRead = Math.min(4, remaining);
    let tdata = 0,
      tkeep = 0;
    for (let i = 0; i < bytesToRead; i++) {
      tdata = (tdata | (((mem.get(readPtr + i) ?? 0) & 0xff) << (24 - i * 8))) >>> 0;
      tkeep |= 1 << (3 - i);
    }
    const isLast = readPtr + bytesToRead >= frameLength;
    newMem.set(REG_OUT_TDATA, tdata);
    newMem.set(REG_OUT_TKEEP, tkeep);
    newMem.set(REG_OUT_TVALID, 1);
    newMem.set(REG_OUT_TLAST, isLast ? 1 : 0);
    newMem.set(REG_OUT_OFFSET, readPtr & 0xffff);
    newMem.set(REG_READ_PTR, readPtr + bytesToRead);
    return { memory: newMem };
  },
  meta: { category: 'networking', icon: 'EI', description: 'Ethernet frame input (AXI-Stream)' },
});

/**
 * Ethernet frame parser FSM. Consumes an AXI-Stream of frame bytes and
 * extracts the L2 header fields — destination MAC, source MAC, EtherType,
 * and (optionally) 802.1Q VLAN tag. Per-field `*_valid` flags assert as
 * each header field finishes parsing.
 *
 * **Inputs:** `tdata` — `bus(32)`; `tkeep` — `bus(4)`;
 * `tvalid`, `tlast` — `bit`
 * **Outputs:** parsed MAC/EtherType/VLAN fields and a `parse_state` cursor
 */
export const Eth_FrameParser = circuit('Eth_FrameParser', {
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
    vlan_valid: bit,
    payload_valid: bit,
    frame_done: bit,
    frame_length: bus(16),
    parse_state: bus(4),
  },
  state: { memory: new Map<number, number>() },
  eval: ({ memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    const state = regs.get(0) ?? 0;
    const dstMacLo = (regs.get(1) ?? 0) >>> 0;
    const dstMacHi = (regs.get(2) ?? 0) & 0xffff;
    const srcMacLo = (regs.get(3) ?? 0) >>> 0;
    const srcMacHi = (regs.get(4) ?? 0) & 0xffff;
    const ethertype = (regs.get(5) ?? 0) & 0xffff;
    const vlanTci = (regs.get(6) ?? 0) & 0xffff;
    const hasVlan = (regs.get(7) ?? 0) !== 0;
    const byteCounter = (regs.get(8) ?? 0) & 0xffff;
    return {
      dst_mac_hi: dstMacHi,
      dst_mac_lo: dstMacLo,
      dst_mac_valid: state >= 2 ? 1 : 0,
      src_mac_hi: srcMacHi,
      src_mac_lo: srcMacLo,
      src_mac_valid: state >= 4 ? 1 : 0,
      ethertype,
      ethertype_valid: state >= 6 ? 1 : 0,
      has_vlan: hasVlan ? 1 : 0,
      vlan_tci: vlanTci,
      vlan_valid: hasVlan && state >= 6 ? 1 : 0,
      payload_valid: state === 6 || state === 7 ? 1 : 0,
      frame_done: state === 7 ? 1 : 0,
      frame_length: byteCounter,
      parse_state: state,
    };
  },
  onTick: ({ tdata, tkeep, tvalid, tlast, memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    if (!tvalid) return { memory: regs };
    const td = (tdata as number) >>> 0;
    const tk = (tkeep as number) & 0xf;
    const last = !!tlast;
    const R_STATE = 0,
      R_DST_MAC_LO = 1,
      R_DST_MAC_HI = 2,
      R_SRC_MAC_LO = 3,
      R_SRC_MAC_HI = 4;
    const R_ETHERTYPE = 5,
      R_VLAN_TCI = 6,
      R_HAS_VLAN = 7,
      R_BYTE_COUNTER = 8;
    const IDLE = 0,
      DST_MAC_HI_SRC = 2,
      SRC_MAC = 3,
      ETHERTYPE = 4,
      VLAN = 5,
      PAYLOAD = 6,
      DONE = 7;
    const newRegs = new Map(regs);
    let state = regs.get(R_STATE) ?? IDLE;
    const byteCount = ((tk >> 3) & 1) + ((tk >> 2) & 1) + ((tk >> 1) & 1) + (tk & 1);
    const prevCounter = regs.get(R_BYTE_COUNTER) ?? 0;
    newRegs.set(R_BYTE_COUNTER, prevCounter + byteCount);
    const b0 = (td >>> 24) & 0xff,
      b1 = (td >>> 16) & 0xff,
      b2 = (td >>> 8) & 0xff,
      b3 = td & 0xff;
    switch (state) {
      case IDLE:
        newRegs.set(R_DST_MAC_LO, td);
        newRegs.set(R_STATE, DST_MAC_HI_SRC);
        break;
      case DST_MAC_HI_SRC:
        newRegs.set(R_DST_MAC_HI, (b0 << 8) | b1);
        newRegs.set(R_SRC_MAC_LO, (b2 << 8) | b3);
        newRegs.set(R_STATE, SRC_MAC);
        break;
      case SRC_MAC:
        newRegs.set(R_SRC_MAC_HI, regs.get(R_SRC_MAC_LO) ?? 0 & 0xffff);
        newRegs.set(R_SRC_MAC_LO, td);
        newRegs.set(R_STATE, ETHERTYPE);
        break;
      case ETHERTYPE: {
        const etype = ((b0 << 8) | b1) & 0xffff;
        if (etype === 0x8100) {
          newRegs.set(R_VLAN_TCI, ((b2 << 8) | b3) & 0xffff);
          newRegs.set(R_HAS_VLAN, 1);
          newRegs.set(R_ETHERTYPE, etype);
          newRegs.set(R_STATE, VLAN);
        } else {
          newRegs.set(R_ETHERTYPE, etype);
          newRegs.set(R_STATE, last ? DONE : PAYLOAD);
        }
        break;
      }
      case VLAN:
        newRegs.set(R_ETHERTYPE, ((b0 << 8) | b1) & 0xffff);
        newRegs.set(R_STATE, last ? DONE : PAYLOAD);
        break;
      case PAYLOAD:
        if (last) newRegs.set(R_STATE, DONE);
        break;
    }
    if (last && state !== DONE) newRegs.set(R_BYTE_COUNTER, prevCounter + byteCount);
    return { memory: newRegs };
  },
  meta: { category: 'networking', icon: 'EF', description: 'Ethernet frame parser FSM' },
});

/**
 * IEEE 802.3 CRC-32 checker. Computes the Ethernet FCS (CRC-32 with
 * polynomial `0xEDB88320` reflected) over an AXI-Stream input. Asserts
 * `crc_ok` on `tlast` if the residual matches the expected magic constant
 * `0xDEBB20E3`.
 *
 * **Inputs:** `data` — `bus(32)`; `tkeep` — `bus(4)`;
 * `data_valid`, `tlast`, `reset` — `bit`
 * **Outputs:** `crc` — `bus(32)`; `crc_ok` — `bit`
 */
export const Eth_CRC32 = circuit('Eth_CRC32', {
  inputs: { data: bus(32), data_valid: bit, tkeep: bus(4), tlast: bit, reset: bit },
  outputs: { crc: bus(32), crc_ok: bit },
  state: { memory: new Map<number, number>() },
  eval: ({ memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    const crcReg = (regs.get(0) ?? 0xffffffff) >>> 0;
    const done = (regs.get(1) ?? 0) !== 0;
    return {
      crc: ~crcReg >>> 0,
      crc_ok: done && crcReg === 0xdebb20e3 >>> 0 ? 1 : 0,
    };
  },
  onTick: ({ data, data_valid, tkeep, tlast, reset, memory }) => {
    const regs = (memory as Map<number, number>) ?? new Map();
    if (reset) {
      const m = new Map(regs);
      m.set(0, 0xffffffff);
      m.set(1, 0);
      return { memory: m };
    }
    if (!data_valid) return { memory: regs };
    const d = (data as number) >>> 0;
    const tk = (tkeep as number) & 0xf;
    let crc = (regs.get(0) ?? 0xffffffff) >>> 0;
    for (let i = 3; i >= 0; i--) {
      if ((tk >> i) & 1) {
        const byteVal = (d >>> (i * 8)) & 0xff;
        crc = (CRC32_TABLE[(crc ^ byteVal) & 0xff] ^ (crc >>> 8)) >>> 0;
      }
    }
    const m = new Map(regs);
    m.set(0, crc);
    if (tlast) m.set(1, 1);
    return { memory: m };
  },
  meta: { category: 'networking', icon: 'EC', description: 'IEEE 802.3 CRC-32 checker' },
});

/**
 * Memory bus multiplexer. Routes a 32-bit address into one of five
 * peripheral regions (data RAM, MMIO ranges, etc.) based on per-port
 * `base`/`end` arguments. Asserts the matching port's `pN_read`/`pN_write`
 * strobes and returns the selected port's data on `read_data`.
 *
 * **Inputs:** `addr`, `write_data` — `bus(32)`; `mem_read`, `mem_write` — `bit`;
 * `funct3` — `bus(3)`; `read_data_0`..`read_data_4` — `bus(32)`
 * **Outputs:** `local_addr`, `write_data_out`, `read_data` — `bus(32)`;
 * `funct3_out` — `bus(3)`; `p0_read`/`p0_write`..`p4_read`/`p4_write` — `bit`
 */
export const MemBusMux = circuit('MemBusMux', {
  inputs: {
    addr: bus(32),
    write_data: bus(32),
    mem_read: bit,
    mem_write: bit,
    funct3: bus(3),
    read_data_0: bus(32),
    read_data_1: bus(32),
    read_data_2: bus(32),
    read_data_3: bus(32),
    read_data_4: bus(32),
  },
  outputs: {
    local_addr: bus(32),
    write_data_out: bus(32),
    funct3_out: bus(3),
    read_data: bus(32),
    p0_read: bit,
    p0_write: bit,
    p1_read: bit,
    p1_write: bit,
    p2_read: bit,
    p2_write: bit,
    p3_read: bit,
    p3_write: bit,
    p4_read: bit,
    p4_write: bit,
  },
  eval: ({
    addr,
    write_data,
    mem_read,
    mem_write,
    funct3,
    read_data_0,
    read_data_1,
    read_data_2,
    read_data_3,
    read_data_4,
    base0,
    base1,
    base2,
    base3,
    base4,
    end0,
    end1,
    end2,
    end3,
    end4,
  }) => {
    const a = ((addr as number) ?? 0) >>> 0;
    const wd = ((write_data as number) ?? 0) >>> 0;
    const f3 = ((funct3 as number) ?? 0) & 0x7;
    const ranges = [
      {
        base: ((base0 as number) ?? 0x00010000) >>> 0,
        end: ((end0 as number) ?? 0x0001ffff) >>> 0,
      },
      {
        base: ((base1 as number) ?? 0x80000000) >>> 0,
        end: ((end1 as number) ?? 0x80000fff) >>> 0,
      },
      {
        base: ((base2 as number) ?? 0x80001000) >>> 0,
        end: ((end2 as number) ?? 0x80001fff) >>> 0,
      },
      {
        base: ((base3 as number) ?? 0x80002000) >>> 0,
        end: ((end3 as number) ?? 0x80002fff) >>> 0,
      },
      {
        base: ((base4 as number) ?? 0x00000000) >>> 0,
        end: ((end4 as number) ?? 0x0000ffff) >>> 0,
      },
    ];
    let match = -1;
    for (let i = 0; i < 5; i++) {
      if (a >= ranges[i].base && a <= ranges[i].end) {
        match = i;
        break;
      }
    }
    const localAddr = match >= 0 ? (a - ranges[match].base) >>> 0 : 0;
    const rdArr = [read_data_0, read_data_1, read_data_2, read_data_3, read_data_4].map(
      (v) => ((v as number) ?? 0) >>> 0,
    );
    const readData = match >= 0 ? rdArr[match] : 0;
    const mr = !!mem_read,
      mw = !!mem_write;
    return {
      local_addr: localAddr,
      write_data_out: wd,
      funct3_out: f3,
      read_data: readData,
      p0_read: match === 0 && mr ? 1 : 0,
      p0_write: match === 0 && mw ? 1 : 0,
      p1_read: match === 1 && mr ? 1 : 0,
      p1_write: match === 1 && mw ? 1 : 0,
      p2_read: match === 2 && mr ? 1 : 0,
      p2_write: match === 2 && mw ? 1 : 0,
      p3_read: match === 3 && mr ? 1 : 0,
      p3_write: match === 3 && mw ? 1 : 0,
      p4_read: match === 4 && mr ? 1 : 0,
      p4_write: match === 4 && mw ? 1 : 0,
    };
  },
  meta: { category: 'rv32i', icon: 'BUS', description: 'Memory bus multiplexer' },
});

/**
 * UART transmitter. Memory-mapped TX-only UART — a write to address 0
 * appends the low byte of `write_data` to the output text buffer (kept
 * to the most recent 4 KB). Simulation-only peripheral — not synthesizable
 * to Verilog.
 *
 * **Inputs:** `addr`, `write_data` — `bus(32)`; `mem_read`, `mem_write` — `bit`
 * **Output:** `read_data` — `bus(32)`
 */
export const UART_TX = circuit('UART_TX', {
  inputs: { addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit },
  outputs: { read_data: bus(32) },
  state: { text: '' as string },
  eval: ({ mem_read }) => ({ read_data: mem_read ? 1 : 0 }),
  onTick: ({ addr, write_data, mem_write, text }) => {
    if (!mem_write) return { text };
    const a = (addr as number) >>> 0;
    if (a !== 0) return { text };
    const char = String.fromCharCode((write_data as number) & 0xff);
    const newText = ((text as string) ?? '') + char;
    return { text: newText.length > 4096 ? newText.slice(-4096) : newText };
  },
  meta: { category: 'io', icon: 'TX', description: 'UART transmitter', synthesizable: false },
});

/**
 * Network interface FIFO. Memory-mapped Ethernet-style NIC with separate
 * TX and RX queues. Write bytes to the TX queue and trigger a drain to
 * emit a frame onto the network port; receive frames into the RX queue
 * from the network side. Simulation-only peripheral — not synthesizable
 * to Verilog.
 *
 * **Inputs:** TX/RX `addr`/`write_data` + control strobes, plus network-side
 * `net_rx_data`/`net_rx_valid`/`net_rx_frame`.
 * **Outputs:** TX/RX read-data + network-side `net_tx_*` stream.
 */
export const NIC_FIFO = circuit('NIC_FIFO', {
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
  state: { memory: new Map<number, number>() },
  eval: ({ tx_mem_read, rx_mem_read, tx_addr, rx_addr, memory }) => {
    const state = (memory as Map<number, number>) ?? new Map();
    let txReadData = 0;
    if (tx_mem_read) {
      const a = ((tx_addr as number) ?? 0) >>> 0;
      if (a === 0x8) txReadData = (state.get(0x2000) ?? 0) - (state.get(0x2001) ?? 0);
    }
    let rxReadData = 0;
    if (rx_mem_read) {
      const a = ((rx_addr as number) ?? 0) >>> 0;
      if (a === 0x0) rxReadData = (state.get(0x1000 + (state.get(0x2011) ?? 0)) ?? 0) >>> 0;
      else if (a === 0x8) rxReadData = state.get(0x2012) ?? 0;
    }
    const draining = state.get(0x2004) ?? 0;
    const txDrainPtr = state.get(0x2003) ?? 0;
    const txWp = state.get(0x2000) ?? 0;
    let netTxData = 0,
      netTxValid = 0,
      netTxFrame = 0;
    if (draining && txDrainPtr < txWp) {
      netTxData = (state.get(0x0000 + txDrainPtr) ?? 0) >>> 0;
      netTxValid = 1;
      netTxFrame = txDrainPtr + 1 >= txWp ? 1 : 0;
    }
    return {
      tx_read_data: txReadData,
      rx_read_data: rxReadData,
      net_tx_data: netTxData,
      net_tx_valid: netTxValid,
      net_tx_frame: netTxFrame,
    };
  },
  onTick: ({
    tx_addr,
    tx_write_data,
    tx_mem_write,
    rx_addr,
    rx_mem_write,
    net_rx_data,
    net_rx_valid,
    memory,
  }) => {
    const state = (memory as Map<number, number>) ?? new Map();
    const newState = new Map(state);
    if (tx_mem_write) {
      const a = ((tx_addr as number) ?? 0) >>> 0;
      const d = ((tx_write_data as number) ?? 0) >>> 0;
      if (a === 0x0) {
        const wp = newState.get(0x2000) ?? 0;
        newState.set(0x0000 + wp, d);
        newState.set(0x2000, wp + 1);
      } else if (a === 0xc) {
        newState.set(0x2002, 1);
        newState.set(0x2003, 0);
        newState.set(0x2004, 1);
      }
    }
    const wasDraining = state.get(0x2004) ?? 0;
    if (wasDraining) {
      const dp = newState.get(0x2003) ?? 0,
        wp = newState.get(0x2000) ?? 0;
      if (dp < wp) {
        newState.set(0x2003, dp + 1);
        if (dp + 1 >= wp) {
          newState.set(0x2004, 0);
          newState.set(0x2000, 0);
          newState.set(0x2001, 0);
          newState.set(0x2002, 0);
        }
      }
    }
    if (net_rx_valid) {
      const d = ((net_rx_data as number) ?? 0) >>> 0;
      const wp = newState.get(0x2010) ?? 0;
      newState.set(0x1000 + wp, d);
      newState.set(0x2010, wp + 1);
      newState.set(0x2012, (newState.get(0x2012) ?? 0) + 1);
    }
    if (rx_mem_write) {
      const a = ((rx_addr as number) ?? 0) >>> 0;
      if (a === 0x4) {
        const rp = newState.get(0x2011) ?? 0,
          cnt = newState.get(0x2012) ?? 0;
        if (cnt > 0) {
          newState.set(0x2011, rp + 1);
          newState.set(0x2012, cnt - 1);
        }
      }
    }
    return { memory: newState };
  },
  meta: {
    category: 'networking',
    icon: 'NIC',
    description: 'Network interface FIFO',
    synthesizable: false,
  },
});
