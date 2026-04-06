// Auto-generated from DSL

const Eth_802_3_Parser = circuit('Eth_802_3_Parser', {
  out: { dst_mac_hi: bus(16), dst_mac_lo: bus(32), src_mac_hi: bus(16), src_mac_lo: bus(32), ethertype: bus(16), frame_done: bit, crc_ok: bit, is_broadcast: bit, is_ipv4: bit, parse_state: bus(4) },
  nodes: { frame_in: Eth_FrameInput, enable: Constant, parser: Eth_FrameParser, crc: Eth_CRC32, proto: Eth_ProtocolDecoder, addr: Eth_AddrClassifier },
  nodeArgs: { enable: { value: 1, width: 1 } },
  connect: ({ in: inp, out, frame_in, enable, parser, crc, proto, addr }) => [
    enable.out.to(frame_in.enable),
    frame_in.tdata.to(parser.tdata, crc.data),
    frame_in.tkeep.to(parser.tkeep, crc.tkeep),
    frame_in.tvalid.to(parser.tvalid, crc.data_valid),
    frame_in.tlast.to(parser.tlast, crc.tlast),
    parser.ethertype.to(proto.ethertype, out.ethertype),
    parser.dst_mac_hi.to(addr.dst_mac_hi, out.dst_mac_hi),
    parser.dst_mac_lo.to(addr.dst_mac_lo, out.dst_mac_lo),
    parser.src_mac_hi.to(out.src_mac_hi),
    parser.src_mac_lo.to(out.src_mac_lo),
    parser.frame_done.to(out.frame_done),
    parser.parse_state.to(out.parse_state),
    crc.crc_ok.to(out.crc_ok),
    addr.is_broadcast.to(out.is_broadcast),
    proto.is_ipv4.to(out.is_ipv4),
  ],
})
