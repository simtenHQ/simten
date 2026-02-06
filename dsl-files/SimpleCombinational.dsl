// Simple combinational logic test
// Switch -> Not -> And -> LED
circuit SimpleCombinational {
  impl {
    // Inputs: Two switches
    node sw1: Switch(value=1)
    node sw2: Switch(value=0)

    // Logic gates
    node inverter: Not
    node andGate: And

    // Output: LED
    node led: Led

    // Connections
    connect sw1.out -> inverter.in
    connect inverter.out -> andGate.a
    connect sw2.out -> andGate.b
    connect andGate.out -> led.in
  }
}
