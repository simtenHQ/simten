// Simple 2-bit shift register with feedback
// Switch drives clock, LED shows output
circuit SimpleFlipFlopChain {
  impl {
    // Input: Switch for clock
    node sw: Switch(value=1)

    // Two D flip-flops
    node ff1: DFlipFlop
    node ff2: DFlipFlop

    // Output: LED
    node led: Led

    // Clock connections: Switch drives both flip-flops
    connect sw.out -> ff1.clk
    connect sw.out -> ff2.clk

    // Data path: feedback creates a toggle/counter
    // FF2.q feeds back to FF1.d (inverted creates toggle)
    // FF1.q feeds to FF2.d
    node inverter: Not
    connect ff2.q -> inverter.in
    connect inverter.out -> ff1.d
    connect ff1.q -> ff2.d

    // Output to LED
    connect ff2.q -> led.in
  }
}
