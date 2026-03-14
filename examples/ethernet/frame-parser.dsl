// IEEE 802.3 Ethernet Frame Parser
//
// Models the receive path of a 1G Ethernet MAC + parser pipeline.
// 32-bit data bus (GMII), 4 bytes per clock cycle.
//
// PHY layer (preamble/SFD stripping) is below our abstraction boundary.
// Eth_FrameInput represents the MAC RX interface — frame data starts
// at byte 0 of the destination MAC address, after SFD detection.
//
// Pipeline:
//   Eth_FrameInput (MAC RX) ──→ Eth_FrameParser (field extraction FSM)
//          │                            │
//          └──→ Eth_CRC32 (parallel)    ├──→ Eth_AddrClassifier
//                                       └──→ Eth_ProtocolDecoder

circuit Eth_802_3_Parser {
  output dst_mac_hi: Bus[16]
  output dst_mac_lo: Bus[32]
  output src_mac_hi: Bus[16]
  output src_mac_lo: Bus[32]
  output ethertype: Bus[16]
  output frame_done: Bit
  output crc_ok: Bit
  output is_broadcast: Bit
  output is_ipv4: Bit
  output parse_state: Bus[4]
  impl {
    // MAC RX interface — frame bytes loaded at runtime via memoryData
    node frame_in: Eth_FrameInput
    node enable: Constant(value=1, width=1)
    connect enable.out -> frame_in.enable

    // Parse state machine — extracts fields from AXI-Stream
    node parser: Eth_FrameParser
    connect frame_in.tdata -> parser.tdata
    connect frame_in.tkeep -> parser.tkeep
    connect frame_in.tvalid -> parser.tvalid
    connect frame_in.tlast -> parser.tlast

    // CRC-32 checker — runs in parallel with parser
    node crc: Eth_CRC32
    connect frame_in.tdata -> crc.data
    connect frame_in.tvalid -> crc.data_valid
    connect frame_in.tkeep -> crc.tkeep
    connect frame_in.tlast -> crc.tlast

    // Protocol decode — combinational dispatch on EtherType
    node proto: Eth_ProtocolDecoder
    connect parser.ethertype -> proto.ethertype

    // Address classification — after parsing, before forwarding
    node addr: Eth_AddrClassifier
    connect parser.dst_mac_hi -> addr.dst_mac_hi
    connect parser.dst_mac_lo -> addr.dst_mac_lo

    // Observable outputs
    connect parser.dst_mac_hi -> dst_mac_hi
    connect parser.dst_mac_lo -> dst_mac_lo
    connect parser.src_mac_hi -> src_mac_hi
    connect parser.src_mac_lo -> src_mac_lo
    connect parser.ethertype -> ethertype
    connect parser.frame_done -> frame_done
    connect parser.parse_state -> parse_state
    connect crc.crc_ok -> crc_ok
    connect addr.is_broadcast -> is_broadcast
    connect proto.is_ipv4 -> is_ipv4
  }
}
