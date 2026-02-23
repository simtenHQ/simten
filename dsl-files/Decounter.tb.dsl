// Decounter Testbench
// Tests loading, decrementing, and holding

testbench DecounterTest {
  use circuit Decounter as dut

  input load_val: Bus[8]
  input load: Bit
  input enable: Bit
  output count: Bus[8]

  clock clk

  impl {
    // Instantiate DUT
    node decounter: Decounter

    // Wire up ports
    connect load_val -> decounter.load_val
    connect load -> decounter.load
    connect enable -> decounter.enable
    connect decounter.count -> count

    // Stimulus: Load initial value, decrement, hold, reload
    stimulus on clk {
      // Load initial value of 10
      at 0: load_val = 10, load = 1, enable = 0

      // Start decrementing (should go 10 -> 9 -> 8 -> 7...)
      at 1..5: load = 0, enable = 1

      // Hold for 3 cycles (count should stay at 5)
      at 6..8: enable = 0

      // Continue decrementing (5 -> 4 -> 3 -> 2 -> 1 -> 0)
      at 9..14: enable = 1

      // Load new value of 20
      at 15: load_val = 20, load = 1, enable = 0

      // Decrement from 20
      at 16..20: load = 0, enable = 1
    }

    // Capture waveforms
    capture {
      signals: [load_val, load, enable, count]
      format: vcd
      filename: "decounter_test.vcd"
    }

    // Assertions: verify count values at known cycles
    assert on clk {
      at 0: count == 10, "count should be loaded value"
      at 3: count == 7, "should decrement by 3 after 3 ticks"
    }
  }
}
