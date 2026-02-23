// Simple Counter Testbench
// Demonstrates basic testbench syntax and VCD generation

testbench CounterTest {
  use circuit Counter as dut

  input reset: Bit
  input enable: Bit
  output count: Bus[8]

  clock clk

  impl {
    // Instantiate DUT
    node counter: Counter

    // Wire up ports
    connect reset -> counter.reset
    connect enable -> counter.enable
    connect counter.count -> count

    // Stimulus: Reset then count
    stimulus on clk {
      // Reset for 2 cycles
      at 0..1: reset = 1, enable = 0

      // Enable and count for 10 cycles
      at 2..11: reset = 0, enable = 1

      // Disable for 5 cycles (count should hold)
      at 12..16: enable = 0

      // Re-enable for final cycles
      at 17..20: enable = 1
    }

    // Capture waveforms
    capture {
      signals: [reset, enable, count]
      format: vcd
      filename: "counter_test.vcd"
    }

    // Assertions: verify count values at known cycles
    assert on clk {
      at 0: count == 0, "count should be 0 during reset"
      at 4: count == 3, "count should be 3 after 3 enabled ticks"
    }
  }
}
