// Stage 9: Console Output Device
// Memory-mapped console at $F000
//
// Write a byte to $F000 -> character appended to console buffer
// Console is write-only (reads return 0x00)

// === ConsoleOutput: Memory-mapped console device ===
// Responds to address $F000 (addr_hi=$F0, addr_lo=$00)
circuit ConsoleOutput {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]
  input data_in: Bus[8]
  input we: Bit

  output responds: Bit
  output data_out: Bus[8]

  clock clk

  impl {
    // Console at $F000: addr_hi = $F0 (240), addr_lo = $00
    node f0: Constant(value=240)
    node zero: Constant(value=0)

    // Check if address matches $F000
    node hi_match: Comparator
    connect addr_hi -> hi_match.a
    connect f0.out -> hi_match.b

    node lo_match: Comparator
    connect addr_lo -> lo_match.a
    connect zero.out -> lo_match.b

    // responds = (addr_hi == $F0) AND (addr_lo == $00)
    node addr_match: And
    connect hi_match.eq -> addr_match.a
    connect lo_match.eq -> addr_match.b
    connect addr_match.out -> responds

    // Console write enable: responds AND we
    node console_we: And
    connect addr_match.out -> console_we.a
    connect we -> console_we.b

    // Console primitive - accumulates characters
    node console: Console
    connect clk -> console.clk
    connect data_in -> console.data
    connect console_we.out -> console.we

    // Read returns 0x00 (write-only device)
    connect zero.out -> data_out
  }
}

// === ConsoleOutputTest: Test harness for console ===
circuit ConsoleOutputTest {
  clock clk

  impl {
    node console_dev: ConsoleOutput
    connect clk -> console_dev.clk

    // Test inputs
    node addr_lo_in: Input
    node addr_hi_in: Input
    node data_in: Input
    node we_in: Switch

    connect addr_lo_in.out -> console_dev.addr_lo
    connect addr_hi_in.out -> console_dev.addr_hi
    connect data_in.out -> console_dev.data_in
    connect we_in.out -> console_dev.we

    // Outputs
    node d_responds: Led
    node d_data_out: HexDisplay

    connect console_dev.responds -> d_responds.in
    connect console_dev.data_out -> d_data_out.in
  }
}
