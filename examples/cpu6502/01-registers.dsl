// 6502 CPU Stage 1: Register File
// Contains A, X, Y registers with write and read ports

circuit RegisterFile {
  input write_sel: Bus[2]    // 00=A, 01=X, 10=Y, 11=none
  input write_data: Bus[8]
  input write_enable: Bit

  input read_sel: Bus[2]     // 00=A, 01=X, 10=Y
  output read_data: Bus[8]

  clock clk

  impl {
    // === Three 8-bit registers ===

    node regA: Register
    regA.clk = clk
    regA.width = Input(value=8)

    node regX: Register
    regX.clk = clk
    regX.width = Input(value=8)

    node regY: Register
    regY.clk = clk
    regY.width = Input(value=8)

    // === Write Demultiplexer ===
    // Enable write to specific register based on write_sel

    // Check if write_sel == 00 (A)
    node sel_is_A: Comparator
    sel_is_A.a = write_sel
    sel_is_A.b = Input(value=0b00)
    node write_A_gate: And
    write_A_gate.a = sel_is_A.eq
    write_A_gate.b = write_enable
    regA.load = write_A_gate.out

    // Check if write_sel == 01 (X)
    node sel_is_X: Comparator
    sel_is_X.a = write_sel
    sel_is_X.b = Input(value=0b01)
    node write_X_gate: And
    write_X_gate.a = sel_is_X.eq
    write_X_gate.b = write_enable
    regX.load = write_X_gate.out

    // Check if write_sel == 10 (Y)
    node sel_is_Y: Comparator
    sel_is_Y.a = write_sel
    sel_is_Y.b = Input(value=0b10)
    node write_Y_gate: And
    write_Y_gate.a = sel_is_Y.eq
    write_Y_gate.b = write_enable
    regY.load = write_Y_gate.out

    // Connect write data to all registers
    regA.data = write_data
    regX.data = write_data
    regY.data = write_data

    // === Read Multiplexer ===
    // Select which register to read based on read_sel

    // Extract bits for mux selection
    node read_sel_bit0: Bit
    read_sel_bit0 = BitSlice(input=read_sel, bit=0)

    node read_sel_bit1: Bit
    read_sel_bit1 = BitSlice(input=read_sel, bit=1)

    // Level 1: Select between A and X
    node read_mux1: Mux
    read_mux1.sel = read_sel_bit0
    read_mux1.a = regA.q
    read_mux1.b = regX.q

    // Level 2: Select between result of mux1 and Y
    node read_mux2: Mux
    read_mux2.sel = read_sel_bit1
    read_mux2.a = read_mux1.out
    read_mux2.b = regY.q

    read_data = read_mux2.out
  }
}
