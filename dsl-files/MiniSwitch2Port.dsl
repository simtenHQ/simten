circuit MiniSwitch2Port {
  impl {
    // ============================================================================
    // Mini-Packet Switch - 2-Port Complete System
    // ============================================================================
    // End-to-end packet switching from raw bytes through forwarding
    // - 2× MacRxParser (preamble/SFD detection)
    // - 2× IngressController (packet buffering)
    // - 1× SimpleArbiter2Port (fair port selection)
    // - 1× PacketForwarder2Port (static cross-over routing)
    // - 2× EgressController (packet serialization)
    // ============================================================================

    // ========================================================================
    // External Inputs/Outputs
    // ========================================================================

    // Port 0 inputs
    node p0_byte: Input
    node p0_valid: Input

    // Port 1 inputs
    node p1_byte: Input
    node p1_valid: Input

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

    // Ingress Buffers (dual-port RAMs: Port A = write by ingress, Port B = read by forwarder)
    node ram_ingress0: DualPortRAM
    node ram_ingress1: DualPortRAM

    // Arbiter
    node arbiter: SimpleArbiter2Port

    // Forwarder
    node forwarder: PacketForwarder2Port

    // Egress Buffers (dual-port RAMs: Port A = write by forwarder, Port B = read by egress)
    node ram_egress0: DualPortRAM
    node ram_egress1: DualPortRAM

    // Egress Controllers
    node egress0: EgressController
    node egress1: EgressController

    // ========================================================================
    // Port 0 Ingress Path: External → Parser → IngressController → RAM
    // ========================================================================

    connect p0_byte.out -> parser0.byte_in
    connect p0_valid.out -> parser0.valid

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

    // Forwarder provides read pointers (simplified: read from start of buffer)
    connect ZERO.out -> forwarder.port0_read_ptr
    connect ZERO.out -> forwarder.port1_read_ptr

    // Both ingress RAMs connected to same address (forwarder reads from one based on ingress_port)
    connect forwarder.ingress_addr -> ram_ingress0.addrB
    connect forwarder.ingress_addr -> ram_ingress1.addrB

    // Mux RAM data outputs based on which port was granted
    node ingress_data_mux: Mux
    connect ram_ingress1.outB -> ingress_data_mux.in0
    connect ram_ingress0.outB -> ingress_data_mux.in1
    connect grant_is_port0.eq -> ingress_data_mux.sel

    // Note: ingress_data_mux.out will be used for egress RAM writes

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

    // pkt_ready for egress controllers (simplified: always ready)
    node always_ready: Switch
    connect always_ready.out -> egress0.pkt_ready
    connect always_ready.out -> egress1.pkt_ready

    // ========================================================================
    // Egress Controllers ↔ Egress RAMs: Read from Port B
    // ========================================================================

    connect egress0.egress_addr -> ram_egress0.addrB
    connect egress1.egress_addr -> ram_egress1.addrB

    // ========================================================================
    // Output Connections: Egress Controllers → External
    // ========================================================================

    node p0_out: HexDisplay
    connect ram_egress0.outB -> p0_out.in

    node p0_valid_out: Led
    connect egress0.data_valid -> p0_valid_out.in

    node p0_sof: Led
    connect egress0.sof -> p0_sof.in

    node p0_eof: Led
    connect egress0.eof -> p0_eof.in

    node p1_out: HexDisplay
    connect ram_egress1.outB -> p1_out.in

    node p1_valid_out: Led
    connect egress1.data_valid -> p1_valid_out.in

    node p1_sof: Led
    connect egress1.sof -> p1_sof.in

    node p1_eof: Led
    connect egress1.eof -> p1_eof.in

    // ========================================================================
    // Debug Displays
    // ========================================================================

    node debug_grant_port: HexDisplay
    connect arbiter.grant_port -> debug_grant_port.in

    node debug_grant_valid: Led
    connect arbiter.grant_valid -> debug_grant_valid.in

    // Note: Cannot access forwarder.fsm_state (internal register, not exposed as output)
    // For debugging forwarder state, use exposed outputs: ingress_port, output_port, done

    node debug_forwarder_ingress_port: HexDisplay
    connect forwarder.ingress_port -> debug_forwarder_ingress_port.in

    node debug_forwarder_output_port: HexDisplay
    connect forwarder.output_port -> debug_forwarder_output_port.in

    node debug_ingress0_ready: Led
    connect ingress0.pkt_ready -> debug_ingress0_ready.in

    node debug_ingress1_ready: Led
    connect ingress1.pkt_ready -> debug_ingress1_ready.in
  }
}
