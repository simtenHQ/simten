/**
 * Standard Library — Networking / Ethernet Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const Eth_ProtocolDecoder = circuit('Eth_ProtocolDecoder', {
  in: { ethertype: bus(16) },
  out: { is_ipv4: bit, is_ipv6: bit, is_arp: bit, is_vlan: bit, is_mpls: bit },
  meta: { category: 'networking', description: 'EtherType → protocol flags' },
});

export const Eth_AddrClassifier = circuit('Eth_AddrClassifier', {
  in: { dst_mac_hi: bus(16), dst_mac_lo: bus(32) },
  out: { is_broadcast: bit, is_multicast: bit, is_unicast: bit },
  meta: { category: 'networking', description: 'MAC address classifier' },
});

export const Eth_FrameInput = circuit('Eth_FrameInput', {
  in: { enable: bit, reset: bit },
  out: { tdata: bus(32), tkeep: bus(4), tvalid: bit, tlast: bit, byte_offset: bus(16) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'networking', description: 'Ethernet frame input (AXI-Stream)' },
});

export const Eth_FrameParser = circuit('Eth_FrameParser', {
  in: { tdata: bus(32), tkeep: bus(4), tvalid: bit, tlast: bit },
  out: { dst_mac_hi: bus(16), dst_mac_lo: bus(32), dst_mac_valid: bit, src_mac_hi: bus(16), src_mac_lo: bus(32), src_mac_valid: bit, ethertype: bus(16), ethertype_valid: bit, has_vlan: bit, vlan_tci: bus(16), vlan_valid: bit, payload_valid: bit, frame_done: bit, frame_length: bus(16), parse_state: bus(4) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'networking', description: 'Ethernet frame parser FSM' },
});

export const Eth_CRC32 = circuit('Eth_CRC32', {
  in: { data: bus(32), data_valid: bit, tkeep: bus(4), tlast: bit, reset: bit },
  out: { crc: bus(32), crc_ok: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'networking', description: 'IEEE 802.3 CRC-32 checker' },
});

export const MemBusMux = circuit('MemBusMux', {
  in: { addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit, funct3: bus(3), read_data_0: bus(32), read_data_1: bus(32), read_data_2: bus(32), read_data_3: bus(32), read_data_4: bus(32) },
  out: { local_addr: bus(32), write_data_out: bus(32), funct3_out: bus(3), read_data: bus(32), p0_read: bit, p0_write: bit, p1_read: bit, p1_write: bit, p2_read: bit, p2_write: bit, p3_read: bit, p3_write: bit, p4_read: bit, p4_write: bit },
  meta: { category: 'rv32i', description: 'Memory bus multiplexer' },
});

export const UART_TX = circuit('UART_TX', {
  in: { addr: bus(32), write_data: bus(32), mem_read: bit, mem_write: bit },
  out: { read_data: bus(32) },
  state: { memory: new Map<number, number>() },
  meta: { category: 'io', description: 'UART transmitter' },
});

export const NIC_FIFO = circuit('NIC_FIFO', {
  in: { tx_addr: bus(32), tx_write_data: bus(32), tx_mem_read: bit, tx_mem_write: bit, rx_addr: bus(32), rx_mem_read: bit, rx_mem_write: bit, net_rx_data: bus(32), net_rx_valid: bit, net_rx_frame: bit },
  out: { tx_read_data: bus(32), rx_read_data: bus(32), net_tx_data: bus(32), net_tx_valid: bit, net_tx_frame: bit },
  state: { memory: new Map<number, number>() },
  meta: { category: 'networking', description: 'Network interface FIFO' },
});
