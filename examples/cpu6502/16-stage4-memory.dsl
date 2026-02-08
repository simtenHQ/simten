// Stage 4 Memory Components: Stack Pointer and Stack Memory
// Adds stack operations for subroutine calls (JSR/RTS) and push/pull (PHA/PLA)

// === Stack Pointer ===
// 8-bit register with increment/decrement logic
// Starts at 0xFF (top of stack page)
// Decrement: SP-- before push (pre-decrement)
// Increment: SP++ after pop (post-increment)
circuit StackPointer {
  input decrement: Bit      // Push operation (SP--)
  input increment: Bit      // Pop operation (SP++)
  input load: Bit           // Initialize SP
  input load_value: Bus[8]  // Value to load

  output sp: Bus[8]         // Current SP value

  clock clk

  impl {
    // SP register - initialized to 0xFF (top of stack)
    node sp_reg: Register(initial=255)
    connect clk -> sp_reg.clk

    // Always enabled (we'll select the right value via mux)
    node always_on: Constant(value=1)
    connect always_on.out -> sp_reg.we

    // Constants
    node one: Constant(value=1)
    node init_value: Constant(value=255)  // 0xFF - top of stack

    // Decrementer: SP - 1
    node dec: Subtractor
    connect sp_reg.q -> dec.a
    connect one.out -> dec.b
    node zero_bit: Constant(value=0)
    connect zero_bit.out -> dec.borrow_in

    // Incrementer: SP + 1
    node inc: Adder
    connect sp_reg.q -> inc.a
    connect one.out -> inc.b
    connect zero_bit.out -> inc.carry_in

    // Select next SP value:
    // Priority: load > decrement > increment > hold
    // (decrement and increment are mutually exclusive per invariant)

    // Step 1: Select between hold and increment
    node mux_inc: Mux
    connect increment -> mux_inc.sel
    connect sp_reg.q -> mux_inc.in0     // Hold current value
    connect inc.sum -> mux_inc.in1      // Increment

    // Step 2: Select between previous result and decrement
    node mux_dec: Mux
    connect decrement -> mux_dec.sel
    connect mux_inc.out -> mux_dec.in0  // Hold or increment
    connect dec.difference -> mux_dec.in1     // Decrement

    // Step 3: Select between previous result and load value
    node mux_load: Mux
    connect load -> mux_load.sel
    connect mux_dec.out -> mux_load.in0 // Normal operation
    connect load_value -> mux_load.in1  // Load explicit value

    connect mux_load.out -> sp_reg.data
    connect sp_reg.q -> sp
  }
}

// === Stack Memory ===
// 16 stack locations initially ($01F0-$01FF)
// Full stack page would be $0100-$01FF (256 bytes)
// Design is parameterizable - expanding to full page is straightforward
//
// Address mapping:
//   SP = $F0 -> memory cell 0
//   SP = $F1 -> memory cell 1
//   ...
//   SP = $FF -> memory cell 15
circuit StackMemory {
  input addr: Bus[8]        // Low byte of address (high byte implied as $01)
  input data_in: Bus[8]     // Data to write
  input write_enable: Bit   // Write enable

  output data_out: Bus[8]   // Data read from addressed location

  clock clk

  impl {
    // Default output for unmapped addresses
    node zero: Constant(value=0)

    // Address constants for $F0-$FF (stack page high addresses)
    node addr_f0: Constant(value=240)  // 0xF0
    node addr_f1: Constant(value=241)  // 0xF1
    node addr_f2: Constant(value=242)  // 0xF2
    node addr_f3: Constant(value=243)  // 0xF3
    node addr_f4: Constant(value=244)  // 0xF4
    node addr_f5: Constant(value=245)  // 0xF5
    node addr_f6: Constant(value=246)  // 0xF6
    node addr_f7: Constant(value=247)  // 0xF7
    node addr_f8: Constant(value=248)  // 0xF8
    node addr_f9: Constant(value=249)  // 0xF9
    node addr_fa: Constant(value=250)  // 0xFA
    node addr_fb: Constant(value=251)  // 0xFB
    node addr_fc: Constant(value=252)  // 0xFC
    node addr_fd: Constant(value=253)  // 0xFD
    node addr_fe: Constant(value=254)  // 0xFE
    node addr_ff: Constant(value=255)  // 0xFF

    // Address comparators
    node at_f0: Comparator
    connect addr -> at_f0.a
    connect addr_f0.out -> at_f0.b

    node at_f1: Comparator
    connect addr -> at_f1.a
    connect addr_f1.out -> at_f1.b

    node at_f2: Comparator
    connect addr -> at_f2.a
    connect addr_f2.out -> at_f2.b

    node at_f3: Comparator
    connect addr -> at_f3.a
    connect addr_f3.out -> at_f3.b

    node at_f4: Comparator
    connect addr -> at_f4.a
    connect addr_f4.out -> at_f4.b

    node at_f5: Comparator
    connect addr -> at_f5.a
    connect addr_f5.out -> at_f5.b

    node at_f6: Comparator
    connect addr -> at_f6.a
    connect addr_f6.out -> at_f6.b

    node at_f7: Comparator
    connect addr -> at_f7.a
    connect addr_f7.out -> at_f7.b

    node at_f8: Comparator
    connect addr -> at_f8.a
    connect addr_f8.out -> at_f8.b

    node at_f9: Comparator
    connect addr -> at_f9.a
    connect addr_f9.out -> at_f9.b

    node at_fa: Comparator
    connect addr -> at_fa.a
    connect addr_fa.out -> at_fa.b

    node at_fb: Comparator
    connect addr -> at_fb.a
    connect addr_fb.out -> at_fb.b

    node at_fc: Comparator
    connect addr -> at_fc.a
    connect addr_fc.out -> at_fc.b

    node at_fd: Comparator
    connect addr -> at_fd.a
    connect addr_fd.out -> at_fd.b

    node at_fe: Comparator
    connect addr -> at_fe.a
    connect addr_fe.out -> at_fe.b

    node at_ff: Comparator
    connect addr -> at_ff.a
    connect addr_ff.out -> at_ff.b

    // Memory cell registers
    node mem_f0: Register
    node mem_f1: Register
    node mem_f2: Register
    node mem_f3: Register
    node mem_f4: Register
    node mem_f5: Register
    node mem_f6: Register
    node mem_f7: Register
    node mem_f8: Register
    node mem_f9: Register
    node mem_fa: Register
    node mem_fb: Register
    node mem_fc: Register
    node mem_fd: Register
    node mem_fe: Register
    node mem_ff: Register

    // Clock connections
    connect clk -> mem_f0.clk
    connect clk -> mem_f1.clk
    connect clk -> mem_f2.clk
    connect clk -> mem_f3.clk
    connect clk -> mem_f4.clk
    connect clk -> mem_f5.clk
    connect clk -> mem_f6.clk
    connect clk -> mem_f7.clk
    connect clk -> mem_f8.clk
    connect clk -> mem_f9.clk
    connect clk -> mem_fa.clk
    connect clk -> mem_fb.clk
    connect clk -> mem_fc.clk
    connect clk -> mem_fd.clk
    connect clk -> mem_fe.clk
    connect clk -> mem_ff.clk

    // Data input connections
    connect data_in -> mem_f0.data
    connect data_in -> mem_f1.data
    connect data_in -> mem_f2.data
    connect data_in -> mem_f3.data
    connect data_in -> mem_f4.data
    connect data_in -> mem_f5.data
    connect data_in -> mem_f6.data
    connect data_in -> mem_f7.data
    connect data_in -> mem_f8.data
    connect data_in -> mem_f9.data
    connect data_in -> mem_fa.data
    connect data_in -> mem_fb.data
    connect data_in -> mem_fc.data
    connect data_in -> mem_fd.data
    connect data_in -> mem_fe.data
    connect data_in -> mem_ff.data

    // Write enable: AND of global write_enable with address match
    node we_f0: And
    connect write_enable -> we_f0.a
    connect at_f0.eq -> we_f0.b
    connect we_f0.out -> mem_f0.we

    node we_f1: And
    connect write_enable -> we_f1.a
    connect at_f1.eq -> we_f1.b
    connect we_f1.out -> mem_f1.we

    node we_f2: And
    connect write_enable -> we_f2.a
    connect at_f2.eq -> we_f2.b
    connect we_f2.out -> mem_f2.we

    node we_f3: And
    connect write_enable -> we_f3.a
    connect at_f3.eq -> we_f3.b
    connect we_f3.out -> mem_f3.we

    node we_f4: And
    connect write_enable -> we_f4.a
    connect at_f4.eq -> we_f4.b
    connect we_f4.out -> mem_f4.we

    node we_f5: And
    connect write_enable -> we_f5.a
    connect at_f5.eq -> we_f5.b
    connect we_f5.out -> mem_f5.we

    node we_f6: And
    connect write_enable -> we_f6.a
    connect at_f6.eq -> we_f6.b
    connect we_f6.out -> mem_f6.we

    node we_f7: And
    connect write_enable -> we_f7.a
    connect at_f7.eq -> we_f7.b
    connect we_f7.out -> mem_f7.we

    node we_f8: And
    connect write_enable -> we_f8.a
    connect at_f8.eq -> we_f8.b
    connect we_f8.out -> mem_f8.we

    node we_f9: And
    connect write_enable -> we_f9.a
    connect at_f9.eq -> we_f9.b
    connect we_f9.out -> mem_f9.we

    node we_fa: And
    connect write_enable -> we_fa.a
    connect at_fa.eq -> we_fa.b
    connect we_fa.out -> mem_fa.we

    node we_fb: And
    connect write_enable -> we_fb.a
    connect at_fb.eq -> we_fb.b
    connect we_fb.out -> mem_fb.we

    node we_fc: And
    connect write_enable -> we_fc.a
    connect at_fc.eq -> we_fc.b
    connect we_fc.out -> mem_fc.we

    node we_fd: And
    connect write_enable -> we_fd.a
    connect at_fd.eq -> we_fd.b
    connect we_fd.out -> mem_fd.we

    node we_fe: And
    connect write_enable -> we_fe.a
    connect at_fe.eq -> we_fe.b
    connect we_fe.out -> mem_fe.we

    node we_ff: And
    connect write_enable -> we_ff.a
    connect at_ff.eq -> we_ff.b
    connect we_ff.out -> mem_ff.we

    // Read mux cascade (priority chain from $F0 to $FF)
    node mux1: Mux
    connect at_f0.eq -> mux1.sel
    connect zero.out -> mux1.in0
    connect mem_f0.q -> mux1.in1

    node mux2: Mux
    connect at_f1.eq -> mux2.sel
    connect mux1.out -> mux2.in0
    connect mem_f1.q -> mux2.in1

    node mux3: Mux
    connect at_f2.eq -> mux3.sel
    connect mux2.out -> mux3.in0
    connect mem_f2.q -> mux3.in1

    node mux4: Mux
    connect at_f3.eq -> mux4.sel
    connect mux3.out -> mux4.in0
    connect mem_f3.q -> mux4.in1

    node mux5: Mux
    connect at_f4.eq -> mux5.sel
    connect mux4.out -> mux5.in0
    connect mem_f4.q -> mux5.in1

    node mux6: Mux
    connect at_f5.eq -> mux6.sel
    connect mux5.out -> mux6.in0
    connect mem_f5.q -> mux6.in1

    node mux7: Mux
    connect at_f6.eq -> mux7.sel
    connect mux6.out -> mux7.in0
    connect mem_f6.q -> mux7.in1

    node mux8: Mux
    connect at_f7.eq -> mux8.sel
    connect mux7.out -> mux8.in0
    connect mem_f7.q -> mux8.in1

    node mux9: Mux
    connect at_f8.eq -> mux9.sel
    connect mux8.out -> mux9.in0
    connect mem_f8.q -> mux9.in1

    node mux10: Mux
    connect at_f9.eq -> mux10.sel
    connect mux9.out -> mux10.in0
    connect mem_f9.q -> mux10.in1

    node mux11: Mux
    connect at_fa.eq -> mux11.sel
    connect mux10.out -> mux11.in0
    connect mem_fa.q -> mux11.in1

    node mux12: Mux
    connect at_fb.eq -> mux12.sel
    connect mux11.out -> mux12.in0
    connect mem_fb.q -> mux12.in1

    node mux13: Mux
    connect at_fc.eq -> mux13.sel
    connect mux12.out -> mux13.in0
    connect mem_fc.q -> mux13.in1

    node mux14: Mux
    connect at_fd.eq -> mux14.sel
    connect mux13.out -> mux14.in0
    connect mem_fd.q -> mux14.in1

    node mux15: Mux
    connect at_fe.eq -> mux15.sel
    connect mux14.out -> mux15.in0
    connect mem_fe.q -> mux15.in1

    node mux16: Mux
    connect at_ff.eq -> mux16.sel
    connect mux15.out -> mux16.in0
    connect mem_ff.q -> mux16.in1

    connect mux16.out -> data_out
  }
}

// === Test Circuit for Stack Components ===
// Tests StackPointer increment/decrement and StackMemory read/write
circuit StackTest {
  clock clk

  impl {
    // Stack Pointer
    node sp: StackPointer
    connect clk -> sp.clk

    // Stack Memory
    node stack_mem: StackMemory
    connect clk -> stack_mem.clk

    // Connect SP to stack memory address
    connect sp.sp -> stack_mem.addr

    // Control inputs
    node dec_input: Input
    connect dec_input.out -> sp.decrement

    node inc_input: Input
    connect inc_input.out -> sp.increment

    node load_input: Input
    connect load_input.out -> sp.load

    node load_val_input: Input
    connect load_val_input.out -> sp.load_value

    node data_input: Input
    connect data_input.out -> stack_mem.data_in

    node write_input: Input
    connect write_input.out -> stack_mem.write_enable

    // Displays
    node d_sp: HexDisplay
    connect sp.sp -> d_sp.in

    node d_data_out: HexDisplay
    connect stack_mem.data_out -> d_data_out.in
  }
}
