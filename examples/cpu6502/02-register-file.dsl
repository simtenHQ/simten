// 6502 CPU Stage 1: Register File
// Three 8-bit registers: A (00), X (01), Y (10)
// Write port: write_sel, write_data, write_enable
// Read port: read_sel, read_data

circuit RegisterFile {
  input write_sel: Bus[2]    // 00=A, 01=X, 10=Y
  input write_data: Bus[8]
  input write_enable: Bit
  input read_sel: Bus[2]     // 00=A, 01=X, 10=Y

  output read_data: Bus[8]

  clock clk

  impl {
    // === Three 8-bit registers ===
    node regA: Register
    connect clk -> regA.clk
    connect write_data -> regA.data

    node regX: Register
    connect clk -> regX.clk
    connect write_data -> regX.data

    node regY: Register
    connect clk -> regY.clk
    connect write_data -> regY.data

    // === Write Enable Logic ===
    // Decode write_sel to enable the correct register

    node sel_0: Constant(value=0)
    node sel_1: Constant(value=1)
    node sel_2: Constant(value=2)

    // Is write_sel == 0? (Register A)
    node is_sel_A: Comparator
    connect write_sel -> is_sel_A.a
    connect sel_0.out -> is_sel_A.b

    // Is write_sel == 1? (Register X)
    node is_sel_X: Comparator
    connect write_sel -> is_sel_X.a
    connect sel_1.out -> is_sel_X.b

    // Is write_sel == 2? (Register Y)
    node is_sel_Y: Comparator
    connect write_sel -> is_sel_Y.a
    connect sel_2.out -> is_sel_Y.b

    // AND with write_enable to get final write signals
    node write_A: And
    connect is_sel_A.eq -> write_A.a
    connect write_enable -> write_A.b
    connect write_A.out -> regA.we

    node write_X: And
    connect is_sel_X.eq -> write_X.a
    connect write_enable -> write_X.b
    connect write_X.out -> regX.we

    node write_Y: And
    connect is_sel_Y.eq -> write_Y.a
    connect write_enable -> write_Y.b
    connect write_Y.out -> regY.we

    // === Read Mux Logic ===
    // Select which register to read based on read_sel

    node is_read_X: Comparator
    connect read_sel -> is_read_X.a
    connect sel_1.out -> is_read_X.b

    node is_read_Y: Comparator
    connect read_sel -> is_read_Y.a
    connect sel_2.out -> is_read_Y.b

    // Level 1: Select between A and X
    node read_mux1: Mux
    connect is_read_X.eq -> read_mux1.sel
    connect regA.q -> read_mux1.in0    // read_sel=0: A
    connect regX.q -> read_mux1.in1    // read_sel=1: X

    // Level 2: Select between mux1 and Y
    node read_mux2: Mux
    connect is_read_Y.eq -> read_mux2.sel
    connect read_mux1.out -> read_mux2.in0   // read_sel=0 or 1
    connect regY.q -> read_mux2.in1          // read_sel=2: Y

    connect read_mux2.out -> read_data
  }
}

// === Test Circuit ===
// Tests reading and writing to registers

circuit RegisterFileTest {
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]

  clock clk

  impl {
    node regfile: RegisterFile
    connect clk -> regfile.clk

    // Manual inputs for testing
    node write_sel_input: Input     // 0=A, 1=X, 2=Y
    node write_data_input: Input    // Value to write
    node write_enable_input: Input  // 1 to write
    node read_sel_input: Input      // 0=A, 1=X, 2=Y

    connect write_sel_input.out -> regfile.write_sel
    connect write_data_input.out -> regfile.write_data
    connect write_enable_input.out -> regfile.write_enable
    connect read_sel_input.out -> regfile.read_sel

    // Read each register separately (for display)
    node sel_0: Constant(value=0)
    node sel_1: Constant(value=1)
    node sel_2: Constant(value=2)

    // Create 3 more RegisterFile instances to read each register
    // (This is a hack for testing - normally you'd read one at a time)
    node reader_A: RegisterFile
    connect clk -> reader_A.clk
    connect write_sel_input.out -> reader_A.write_sel
    connect write_data_input.out -> reader_A.write_data
    connect write_enable_input.out -> reader_A.write_enable
    connect sel_0.out -> reader_A.read_sel
    connect reader_A.read_data -> reg_a

    node reader_X: RegisterFile
    connect clk -> reader_X.clk
    connect write_sel_input.out -> reader_X.write_sel
    connect write_data_input.out -> reader_X.write_data
    connect write_enable_input.out -> reader_X.write_enable
    connect sel_1.out -> reader_X.read_sel
    connect reader_X.read_data -> reg_x

    node reader_Y: RegisterFile
    connect clk -> reader_Y.clk
    connect write_sel_input.out -> reader_Y.write_sel
    connect write_data_input.out -> reader_Y.write_data
    connect write_enable_input.out -> reader_Y.write_enable
    connect sel_2.out -> reader_Y.read_sel
    connect reader_Y.read_data -> reg_y
  }
}
