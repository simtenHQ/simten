// 6502 CPU Stage 2: Program Counter (16-bit)
// Supports: increment, load (for jumps)

circuit ProgramCounter {
  input load: Bit             // 1 = load new address
  input load_addr_low: Bus[8]   // Low byte of address to load
  input load_addr_high: Bus[8]  // High byte of address to load
  input increment: Bit        // 1 = increment PC

  output pc_low: Bus[8]       // Low byte of PC
  output pc_high: Bus[8]      // High byte of PC

  clock clk

  impl {
    // === Two 8-bit registers for low and high bytes ===
    node pcl_reg: Register
    connect clk -> pcl_reg.clk

    node pch_reg: Register
    connect clk -> pch_reg.clk

    // === Increment Logic ===
    node inc_low: Incrementer
    connect pcl_reg.q -> inc_low.in

    // Check if low byte will overflow (255 -> 0)
    node max_byte: Constant(value=255)
    node will_overflow: Comparator
    connect pcl_reg.q -> will_overflow.a
    connect max_byte.out -> will_overflow.b
    // will_overflow.eq = 1 when pcl_reg == 255

    // High byte increment (only when low byte overflows)
    node inc_high: Incrementer
    connect pch_reg.q -> inc_high.in

    node high_inc_mux: Mux
    connect will_overflow.eq -> high_inc_mux.sel
    connect pch_reg.q -> high_inc_mux.in0     // no overflow: keep same
    connect inc_high.out -> high_inc_mux.in1  // overflow: increment

    // === Load vs Increment Selection ===
    // Priority: load > increment > hold

    // Low byte: load_addr[7:0] or inc_low or pcl_reg
    node low_load_or_inc: Mux
    connect increment -> low_load_or_inc.sel
    connect pcl_reg.q -> low_load_or_inc.in0       // no increment: hold
    connect inc_low.out -> low_load_or_inc.in1    // increment: inc_low

    node low_final: Mux
    connect load -> low_final.sel
    connect low_load_or_inc.out -> low_final.in0  // no load: inc or hold
    connect load_addr_low -> low_final.in1        // load: load_addr low

    connect low_final.out -> pcl_reg.data

    // High byte: load_addr_high or inc_high or pch_reg
    node high_load_or_inc: Mux
    connect increment -> high_load_or_inc.sel
    connect pch_reg.q -> high_load_or_inc.in0     // no increment: hold
    connect high_inc_mux.out -> high_load_or_inc.in1  // increment: inc or same

    node high_final: Mux
    connect load -> high_final.sel
    connect high_load_or_inc.out -> high_final.in0  // no load: inc or hold
    connect load_addr_high -> high_final.in1        // load: load_addr high

    connect high_final.out -> pch_reg.data

    // === Write Enable (always on) ===
    node always_on: Constant(value=1)
    connect always_on.out -> pcl_reg.we
    connect always_on.out -> pch_reg.we

    // === Connect outputs ===
    connect pcl_reg.q -> pc_low
    connect pch_reg.q -> pc_high
  }
}

// === Test Circuit ===
circuit ProgramCounterTest {
  output pc_low: Bus[8]
  output pc_high: Bus[8]

  clock clk

  impl {
    node pc_reg: ProgramCounter
    connect clk -> pc_reg.clk

    // Manual inputs for testing
    node load_input: Input          // 1 to load new address
    node addr_low_input: Input      // Low byte of address to load
    node addr_high_input: Input     // High byte of address to load
    node inc_input: Input           // 1 to increment

    connect load_input.out -> pc_reg.load
    connect addr_low_input.out -> pc_reg.load_addr_low
    connect addr_high_input.out -> pc_reg.load_addr_high
    connect inc_input.out -> pc_reg.increment

    connect pc_reg.pc_low -> pc_low
    connect pc_reg.pc_high -> pc_high

    // Add displays
    node display_low: HexDisplay
    connect pc_low -> display_low.in

    node display_high: HexDisplay
    connect pc_high -> display_high.in
  }
}
