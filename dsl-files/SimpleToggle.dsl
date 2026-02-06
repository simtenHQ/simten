// Simple T flip-flop (toggle) using a D flip-flop with feedback
// Each clock tick should toggle the output
circuit SimpleToggle {
  impl {
    // D flip-flop
    node ff: DFlipFlop

    // Inverter for feedback (creates toggle behavior)
    node inverter: Not

    // LED to show output
    node led: Led

    // Feedback connection: ff.q -> NOT -> ff.d
    // This creates a toggle: each clock edge inverts the output
    connect ff.q -> inverter.in
    connect inverter.out -> ff.d

    // Show output on LED
    connect ff.q -> led.in
  }
}
