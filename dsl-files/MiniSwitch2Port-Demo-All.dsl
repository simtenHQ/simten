circuit PacketGenerator {
  // ============================================================================
  // Packet Generator - Automatic Packet Transmission
  // ============================================================================
  // Automatically generates Ethernet-like packets in a loop:
  // - 7 × preamble (0x55)
  // - 1 × SFD (0xD5)
  // - 8 × packet data
  // - 4 × idle gap
  // Total: 20 cycles per packet, then repeats
  // ============================================================================

  clock clk
  output byte_out: Bus[8]
  output valid: Bit

  impl {
    // Cycle counter (0-19, then wraps)
    node cycle_counter: Register
    node counter_inc: Adder
    connect cycle_counter.q -> counter_inc.a
    node ONE: Input(value=1)
    connect ONE.out -> counter_inc.b

    // Check if counter reached 19 (reset to 0)
    node is_nineteen: Comparator
    connect cycle_counter.q -> is_nineteen.a
    node NINETEEN: Input(value=19)
    connect NINETEEN.out -> is_nineteen.b

    // Next counter value: 0 if at 19, else increment
    node ZERO: Input(value=0)
    node next_counter: Mux
    connect counter_inc.sum -> next_counter.in0
    connect ZERO.out -> next_counter.in1
    connect is_nineteen.eq -> next_counter.sel

    connect next_counter.out -> cycle_counter.data
    node counter_we: Input(value=1)
    connect counter_we.out -> cycle_counter.we

    // ============================================================================
    // Cycle Position Detection
    // ============================================================================

    // Cycles 0-6: Preamble (0x55)
    node is_cycle_0: Comparator
    connect cycle_counter.q -> is_cycle_0.a
    connect ZERO.out -> is_cycle_0.b

    node is_cycle_1: Comparator
    connect cycle_counter.q -> is_cycle_1.a
    connect ONE.out -> is_cycle_1.b

    node is_cycle_2: Comparator
    connect cycle_counter.q -> is_cycle_2.a
    node TWO: Input(value=2)
    connect TWO.out -> is_cycle_2.b

    node is_cycle_3: Comparator
    connect cycle_counter.q -> is_cycle_3.a
    node THREE: Input(value=3)
    connect THREE.out -> is_cycle_3.b

    node is_cycle_4: Comparator
    connect cycle_counter.q -> is_cycle_4.a
    node FOUR: Input(value=4)
    connect FOUR.out -> is_cycle_4.b

    node is_cycle_5: Comparator
    connect cycle_counter.q -> is_cycle_5.a
    node FIVE: Input(value=5)
    connect FIVE.out -> is_cycle_5.b

    node is_cycle_6: Comparator
    connect cycle_counter.q -> is_cycle_6.a
    node SIX: Input(value=6)
    connect SIX.out -> is_cycle_6.b

    // Is preamble cycle?
    node is_preamble_0_1: Or
    connect is_cycle_0.eq -> is_preamble_0_1.a
    connect is_cycle_1.eq -> is_preamble_0_1.b

    node is_preamble_2_3: Or
    connect is_cycle_2.eq -> is_preamble_2_3.a
    connect is_cycle_3.eq -> is_preamble_2_3.b

    node is_preamble_4_5: Or
    connect is_cycle_4.eq -> is_preamble_4_5.a
    connect is_cycle_5.eq -> is_preamble_4_5.b

    node is_preamble_01_23: Or
    connect is_preamble_0_1.out -> is_preamble_01_23.a
    connect is_preamble_2_3.out -> is_preamble_01_23.b

    node is_preamble_45_6: Or
    connect is_preamble_4_5.out -> is_preamble_45_6.a
    connect is_cycle_6.eq -> is_preamble_45_6.b

    node is_preamble: Or
    connect is_preamble_01_23.out -> is_preamble.a
    connect is_preamble_45_6.out -> is_preamble.b

    // Cycle 7: SFD (0xD5)
    node is_cycle_7: Comparator
    connect cycle_counter.q -> is_cycle_7.a
    node SEVEN: Input(value=7)
    connect SEVEN.out -> is_cycle_7.b

    // Cycles 8-15: Packet data
    node is_cycle_8: Comparator
    connect cycle_counter.q -> is_cycle_8.a
    node EIGHT: Input(value=8)
    connect EIGHT.out -> is_cycle_8.b

    node is_cycle_9: Comparator
    connect cycle_counter.q -> is_cycle_9.a
    node NINE: Input(value=9)
    connect NINE.out -> is_cycle_9.b

    node is_cycle_10: Comparator
    connect cycle_counter.q -> is_cycle_10.a
    node TEN: Input(value=10)
    connect TEN.out -> is_cycle_10.b

    node is_cycle_11: Comparator
    connect cycle_counter.q -> is_cycle_11.a
    node ELEVEN: Input(value=11)
    connect ELEVEN.out -> is_cycle_11.b

    node is_cycle_12: Comparator
    connect cycle_counter.q -> is_cycle_12.a
    node TWELVE: Input(value=12)
    connect TWELVE.out -> is_cycle_12.b

    node is_cycle_13: Comparator
    connect cycle_counter.q -> is_cycle_13.a
    node THIRTEEN: Input(value=13)
    connect THIRTEEN.out -> is_cycle_13.b

    node is_cycle_14: Comparator
    connect cycle_counter.q -> is_cycle_14.a
    node FOURTEEN: Input(value=14)
    connect FOURTEEN.out -> is_cycle_14.b

    node is_cycle_15: Comparator
    connect cycle_counter.q -> is_cycle_15.a
    node FIFTEEN: Input(value=15)
    connect FIFTEEN.out -> is_cycle_15.b

    // Cycles 16-19: Idle gap
    // (valid will be 0, so no need to detect specifically)

    // ============================================================================
    // Valid Signal: 1 during cycles 0-15, 0 during 16-19
    // ============================================================================
    node is_lt_sixteen: Comparator
    connect cycle_counter.q -> is_lt_sixteen.a
    node SIXTEEN: Input(value=16)
    connect SIXTEEN.out -> is_lt_sixteen.b

    connect is_lt_sixteen.lt -> valid

    // ============================================================================
    // Byte Output Mux Chain
    // ============================================================================

    // Packet data values
    node DATA_0: Input(value=0xAA)  // Byte 0
    node DATA_1: Input(value=0xBB)  // Byte 1
    node DATA_2: Input(value=0xCC)  // Byte 2
    node DATA_3: Input(value=0xDD)  // Byte 3
    node DATA_4: Input(value=0xEE)  // Byte 4
    node DATA_5: Input(value=0xFF)  // Byte 5
    node DATA_6: Input(value=0x11)  // Byte 6
    node DATA_7: Input(value=0x22)  // Byte 7

    // Preamble and SFD constants
    node PREAMBLE_BYTE: Input(value=85)   // 0x55
    node SFD_BYTE: Input(value=213)       // 0xD5

    // Mux chain for packet data (cycles 8-15)
    node data_mux_7: Mux
    connect DATA_7.out -> data_mux_7.in0
    connect DATA_7.out -> data_mux_7.in1  // Default
    connect is_cycle_15.eq -> data_mux_7.sel

    node data_mux_6: Mux
    connect data_mux_7.out -> data_mux_6.in0
    connect DATA_6.out -> data_mux_6.in1
    connect is_cycle_14.eq -> data_mux_6.sel

    node data_mux_5: Mux
    connect data_mux_6.out -> data_mux_5.in0
    connect DATA_5.out -> data_mux_5.in1
    connect is_cycle_13.eq -> data_mux_5.sel

    node data_mux_4: Mux
    connect data_mux_5.out -> data_mux_4.in0
    connect DATA_4.out -> data_mux_4.in1
    connect is_cycle_12.eq -> data_mux_4.sel

    node data_mux_3: Mux
    connect data_mux_4.out -> data_mux_3.in0
    connect DATA_3.out -> data_mux_3.in1
    connect is_cycle_11.eq -> data_mux_3.sel

    node data_mux_2: Mux
    connect data_mux_3.out -> data_mux_2.in0
    connect DATA_2.out -> data_mux_2.in1
    connect is_cycle_10.eq -> data_mux_2.sel

    node data_mux_1: Mux
    connect data_mux_2.out -> data_mux_1.in0
    connect DATA_1.out -> data_mux_1.in1
    connect is_cycle_9.eq -> data_mux_1.sel

    node data_mux_0: Mux
    connect data_mux_1.out -> data_mux_0.in0
    connect DATA_0.out -> data_mux_0.in1
    connect is_cycle_8.eq -> data_mux_0.sel

    // Top-level mux: preamble, SFD, or data?
    node sfd_or_data: Mux
    connect data_mux_0.out -> sfd_or_data.in0
    connect SFD_BYTE.out -> sfd_or_data.in1
    connect is_cycle_7.eq -> sfd_or_data.sel

    node byte_out_mux: Mux
    connect sfd_or_data.out -> byte_out_mux.in0
    connect PREAMBLE_BYTE.out -> byte_out_mux.in1
    connect is_preamble.out -> byte_out_mux.sel

    connect byte_out_mux.out -> byte_out
  }
}
circuit MiniSwitch2Port_Demo {
  // ============================================================================
  // MiniSwitch2Port - AUTOMATIC DEMONSTRATION VERSION
  // ============================================================================
  // This version uses PacketGenerator to automatically send packets on port 0.
  // Just click "Run" and watch packets flow through the system!
  //
  // What to observe:
  // - debug_grant_valid LED: lights up when arbiter grants access
  // - debug_ingress0_ready LED: lights up when packet is buffered
  // - p1_valid_out LED: lights up when packet is transmitted to port 1
  // - p1_out HexDisplay: shows packet bytes being transmitted
  // ============================================================================

  impl {
    // ========================================================================
    // Automatic Packet Generator on Port 0
    // ========================================================================
    node packet_gen: PacketGenerator

    // Port 1 idle (no input)
    node p1_byte: Input(value=0)
    node p1_valid: Input(value=0)

    // Constants
    node ZERO: Input(value=0)
    node ONE: Input(value=1)
    node EIGHT: Input(value=8)

    // ========================================================================
    // Component Instantiation
    // ========================================================================

    // MAC RX Parsers
    node parser0: MacRxParser
    node parser1: MacRxParser

    // Ingress Controllers
    node ingress0: IngressController
    node ingress1: IngressController

    // Ingress Buffers (dual-port RAMs)
    node ram_ingress0: DualPortRAM
    node ram_ingress1: DualPortRAM

    // Arbiter
    node arbiter: SimpleArbiter2Port

    // Forwarder
    node forwarder: PacketForwarder2Port

    // Egress Buffers (dual-port RAMs)
    node ram_egress0: DualPortRAM
    node ram_egress1: DualPortRAM

    // Egress Controllers
    node egress0: EgressController
    node egress1: EgressController

    // ========================================================================
    // Port 0 Ingress Path: PacketGenerator → Parser → IngressController → RAM
    // ========================================================================

    connect packet_gen.byte_out -> parser0.byte_in
    connect packet_gen.valid -> parser0.valid

    connect parser0.data_out -> ingress0.data_in
    connect parser0.sof -> ingress0.sof
    connect parser0.eof -> ingress0.eof
    connect parser0.data_valid -> ingress0.data_valid

    // Ingress RAM0 Port A (write by IngressController0)
    connect ingress0.buf_addr -> ram_ingress0.addrA
    connect parser0.data_out -> ram_ingress0.dataA
    connect ingress0.buf_we -> ram_ingress0.weA

    // ========================================================================
    // Port 1 Ingress Path: External → Parser → IngressController → RAM
    // ========================================================================

    connect p1_byte.out -> parser1.byte_in
    connect p1_valid.out -> parser1.valid

    connect parser1.data_out -> ingress1.data_in
    connect parser1.sof -> ingress1.sof
    connect parser1.eof -> ingress1.eof
    connect parser1.data_valid -> ingress1.data_valid

    // Ingress RAM1 Port A (write by IngressController1)
    connect ingress1.buf_addr -> ram_ingress1.addrA
    connect parser1.data_out -> ram_ingress1.dataA
    connect ingress1.buf_we -> ram_ingress1.weA

    // ========================================================================
    // Arbiter Connections: IngressControllers → Arbiter → Forwarder
    // ========================================================================

    connect ingress0.pkt_ready -> arbiter.port0_ready
    connect ingress1.pkt_ready -> arbiter.port1_ready
    connect forwarder.done -> arbiter.forwarder_done

    connect arbiter.grant_port -> forwarder.grant_port
    connect arbiter.grant_valid -> forwarder.grant_valid

    // Grant signal demux: arbiter.grant_valid goes to the granted port only
    node grant_is_port0: Comparator
    connect arbiter.grant_port -> grant_is_port0.a
    connect ZERO.out -> grant_is_port0.b

    node grant_to_port0: And
    connect arbiter.grant_valid -> grant_to_port0.a
    connect grant_is_port0.eq -> grant_to_port0.b

    connect grant_to_port0.out -> ingress0.grant

    node grant_is_port1: Comparator
    connect arbiter.grant_port -> grant_is_port1.a
    connect ONE.out -> grant_is_port1.b

    node grant_to_port1: And
    connect arbiter.grant_valid -> grant_to_port1.a
    connect grant_is_port1.eq -> grant_to_port1.b

    connect grant_to_port1.out -> ingress1.grant

    // ========================================================================
    // Forwarder ↔ Ingress RAMs: Read from Port B
    // ========================================================================

    // Forwarder provides read pointers
    connect ZERO.out -> forwarder.port0_read_ptr
    connect ZERO.out -> forwarder.port1_read_ptr

    // Both ingress RAMs connected to same address
    connect forwarder.ingress_addr -> ram_ingress0.addrB
    connect forwarder.ingress_addr -> ram_ingress1.addrB

    // Mux RAM data outputs based on which port was granted
    node ingress_data_mux: Mux
    connect ram_ingress1.dataB -> ingress_data_mux.in0
    connect ram_ingress0.dataB -> ingress_data_mux.in1
    connect grant_is_port0.eq -> ingress_data_mux.sel

    // ========================================================================
    // Forwarder ↔ Egress RAMs: Write to Port A
    // ========================================================================

    // Both egress RAMs receive same address from forwarder
    connect forwarder.egress_addr -> ram_egress0.addrA
    connect forwarder.egress_addr -> ram_egress1.addrA

    // Both receive same data (from ingress_data_mux)
    connect ingress_data_mux.out -> ram_egress0.dataA
    connect ingress_data_mux.out -> ram_egress1.dataA

    // Write enable demux: write to the egress RAM matching output_port
    node output_is_port0: Comparator
    connect forwarder.output_port -> output_is_port0.a
    connect ZERO.out -> output_is_port0.b

    node egress0_we: And
    connect forwarder.egress_we -> egress0_we.a
    connect output_is_port0.eq -> egress0_we.b

    connect egress0_we.out -> ram_egress0.weA

    node output_is_port1: Comparator
    connect forwarder.output_port -> output_is_port1.a
    connect ONE.out -> output_is_port1.b

    node egress1_we: And
    connect forwarder.egress_we -> egress1_we.a
    connect output_is_port1.eq -> egress1_we.b

    connect egress1_we.out -> ram_egress1.weA

    // ========================================================================
    // Forwarder → Egress Controllers: Trigger demux
    // ========================================================================

    node egress0_trigger: And
    connect forwarder.done -> egress0_trigger.a
    connect output_is_port0.eq -> egress0_trigger.b

    connect egress0_trigger.out -> egress0.trigger

    node egress1_trigger: And
    connect forwarder.done -> egress1_trigger.a
    connect output_is_port1.eq -> egress1_trigger.b

    connect egress1_trigger.out -> egress1.trigger

    // pkt_ready for egress controllers (always ready)
    node always_ready: Input(value=1)
    connect always_ready.out -> egress0.pkt_ready
    connect always_ready.out -> egress1.pkt_ready

    // ========================================================================
    // Egress Controllers ↔ Egress RAMs: Read from Port B
    // ========================================================================

    connect egress0.egress_addr -> ram_egress0.addrB
    connect egress1.egress_addr -> ram_egress1.addrB

    // ========================================================================
    // Output Displays: Egress Controllers → HexDisplays and LEDs
    // ========================================================================

    node p0_out: HexDisplay
    connect ram_egress0.dataB -> p0_out.in

    node p0_valid_out: Led
    connect egress0.data_valid -> p0_valid_out.in

    node p0_sof: Led
    connect egress0.sof -> p0_sof.in

    node p0_eof: Led
    connect egress0.eof -> p0_eof.in

    node p1_out: HexDisplay
    connect ram_egress1.dataB -> p1_out.in

    node p1_valid_out: Led
    connect egress1.data_valid -> p1_valid_out.in

    node p1_sof: Led
    connect egress1.sof -> p1_sof.in

    node p1_eof: Led
    connect egress1.eof -> p1_eof.in

    // ========================================================================
    // Debug Displays - WATCH THESE!
    // ========================================================================

    node debug_grant_port: HexDisplay
    connect arbiter.grant_port -> debug_grant_port.in

    node debug_grant_valid: Led
    connect arbiter.grant_valid -> debug_grant_valid.in

    node debug_forwarder_ingress_port: HexDisplay
    connect forwarder.ingress_port -> debug_forwarder_ingress_port.in

    node debug_forwarder_output_port: HexDisplay
    connect forwarder.output_port -> debug_forwarder_output_port.in

    node debug_ingress0_ready: Led
    connect ingress0.pkt_ready -> debug_ingress0_ready.in

    node debug_ingress1_ready: Led
    connect ingress1.pkt_ready -> debug_ingress1_ready.in

    // Additional debug: Show packet generator activity
    node debug_gen_byte: HexDisplay
    connect packet_gen.byte_out -> debug_gen_byte.in

    node debug_gen_valid: Led
    connect packet_gen.valid -> debug_gen_valid.in
  }
}
