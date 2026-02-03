// ============================================================================
// MiniSwitch2Port - SIMPLE SWITCHING DEMO
// ============================================================================
// This demo clearly shows SWITCHING BEHAVIOR:
// - Two input ports (both sending packets)
// - Arbiter chooses which port gets access
// - Packets routed to destination ports
//
// Watch these indicators:
// 🔵 Port 0 Input Active - Receiving packet on Port 0
// 🟢 Port 1 Input Active - Receiving packet on Port 1
// ⚡ Arbiter Grant 0    - Port 0 won arbitration
// ⚡ Arbiter Grant 1    - Port 1 won arbitration
// 📤 Port 0 Transmit    - Packet going out Port 0
// 📤 Port 1 Transmit    - Packet going out Port 1
// ============================================================================

circuit MiniSwitch2Port_SimpleDemo {
  clock clk

  impl {
    // ========================================================================
    // Two Packet Generators (alternating timing to show switching)
    // ========================================================================

    // Generator 0: Sends packet every 20 cycles starting at cycle 0
    node gen0: PacketGenerator

    // Generator 1: Offset by 10 cycles to create contention
    node gen1: PacketGenerator
    // TODO: Need to add phase offset parameter to PacketGenerator

    // ========================================================================
    // Switching Core (same as before)
    // ========================================================================

    node parser0: MacRxParser
    connect gen0.byte_out -> parser0.byte_in
    connect gen0.valid -> parser0.valid

    node parser1: MacRxParser
    connect gen1.byte_out -> parser1.byte_in
    connect gen1.valid -> parser1.valid

    node ingress0: IngressController
    connect parser0.data_out -> ingress0.data_in
    connect parser0.sof -> ingress0.sof
    connect parser0.eof -> ingress0.eof
    connect parser0.data_valid -> ingress0.valid

    node ingress1: IngressController
    connect parser1.data_out -> ingress1.data_in
    connect parser1.sof -> ingress1.sof
    connect parser1.eof -> ingress1.eof
    connect parser1.data_valid -> ingress1.valid

    node arbiter: SimpleArbiter2Port
    connect ingress0.pkt_ready -> arbiter.req0
    connect ingress1.pkt_ready -> arbiter.req1

    node forwarder: PacketForwarder2Port
    connect arbiter.grant_port -> forwarder.ingress_port
    connect arbiter.grant_valid -> forwarder.start

    // Read from ingress RAMs
    connect forwarder.read_addr -> ingress0.read_addr
    connect ingress0.read_data -> forwarder.data_from_port0
    connect forwarder.read_addr -> ingress1.read_addr
    connect ingress1.read_data -> forwarder.data_from_port1

    // Write to egress RAMs
    node egress0: EgressController
    connect forwarder.write_addr -> egress0.write_addr
    connect forwarder.write_data -> egress0.write_data
    connect forwarder.write_en_port0 -> egress0.write_en
    connect forwarder.pkt_ready -> egress0.pkt_ready

    node egress1: EgressController
    connect forwarder.write_addr -> egress1.write_addr
    connect forwarder.write_data -> egress1.write_data
    connect forwarder.write_en_port1 -> egress1.write_en
    connect forwarder.pkt_ready -> egress1.pkt_ready

    // ========================================================================
    // SIMPLIFIED VISUAL INDICATORS (only the essential ones)
    // ========================================================================

    // INPUT ACTIVITY
    node indicator_p0_input: Led
    connect gen0.valid -> indicator_p0_input.in
    // Label: "🔵 Port 0 Input"

    node indicator_p1_input: Led
    connect gen1.valid -> indicator_p1_input.in
    // Label: "🟢 Port 1 Input"

    // BUFFERING (packets waiting)
    node indicator_p0_buffered: Led
    connect ingress0.pkt_ready -> indicator_p0_buffered.in
    // Label: "📦 Port 0 Buffered"

    node indicator_p1_buffered: Led
    connect ingress1.pkt_ready -> indicator_p1_buffered.in
    // Label: "📦 Port 1 Buffered"

    // ARBITRATION (who wins?)
    node grant_is_port0: Comparator
    connect arbiter.grant_port -> grant_is_port0.a
    node ZERO: Input(value=0)
    connect ZERO.out -> grant_is_port0.b

    node indicator_grant0: And
    connect grant_is_port0.eq -> indicator_grant0.a
    connect arbiter.grant_valid -> indicator_grant0.b
    node grant0_led: Led
    connect indicator_grant0.out -> grant0_led.in
    // Label: "⚡ Port 0 Wins"

    node grant_is_port1: Comparator
    connect arbiter.grant_port -> grant_is_port1.a
    node ONE: Input(value=1)
    connect ONE.out -> grant_is_port1.b

    node indicator_grant1: And
    connect grant_is_port1.eq -> indicator_grant1.a
    connect arbiter.grant_valid -> indicator_grant1.b
    node grant1_led: Led
    connect indicator_grant1.out -> grant1_led.in
    // Label: "⚡ Port 1 Wins"

    // OUTPUT ACTIVITY (transmitting)
    node indicator_p0_output: Led
    connect egress0.valid -> indicator_p0_output.in
    // Label: "📤 Port 0 Output"

    node indicator_p1_output: Led
    connect egress1.valid -> indicator_p1_output.in
    // Label: "📤 Port 1 Output"

    // Optional: Show which bytes
    node p0_data: HexDisplay
    connect egress0.data_out -> p0_data.in

    node p1_data: HexDisplay
    connect egress1.data_out -> p1_data.in
  }
}
