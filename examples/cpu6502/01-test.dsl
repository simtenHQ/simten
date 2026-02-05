// 6502 CPU Stage 1: Test Circuit
// Tests ALU and register operations

circuit Stage1Test {
  output result: Bus[8]
  output zero_flag: Bit
  output negative_flag: Bit
  output carry_flag: Bit
  output reg_a_out: Bus[8]
  output reg_x_out: Bus[8]

  clock clk

  impl {
    // === Components ===
    node alu: ALU
    node registers: RegisterFile
    registers.clk = clk

    // === Test Scenario: Addition ===
    // Cycle 0: Load 0x42 into register A
    // Cycle 1: Add 0x08 to A (result = 0x4A)
    // Cycle 2: Load result into register X

    // Counter to track clock cycles
    node counter: Register
    counter.clk = clk
    counter.width = Input(value=3)
    counter.load = Input(value=1)

    node inc: Incrementer
    inc.input = counter.q
    counter.data = inc.output

    // === Control Logic Based on Cycle Count ===

    // Cycle 0: write_sel=00 (A), write_data=0x42
    // Cycle 1: write_sel=00 (A), write_data=ALU result
    // Cycle 2: write_sel=01 (X), write_data=ALU result

    node cycle_is_0: Comparator
    cycle_is_0.a = counter.q
    cycle_is_0.b = Input(value=0)

    node cycle_is_1: Comparator
    cycle_is_1.a = counter.q
    cycle_is_1.b = Input(value=1)

    node cycle_is_2: Comparator
    cycle_is_2.a = counter.q
    cycle_is_2.b = Input(value=2)

    // === ALU Configuration ===

    // ALU operand A: always read from register A
    node reg_sel_A: Bus[2]
    reg_sel_A = Input(value=0b00)
    registers.read_sel = reg_sel_A
    alu.a = registers.read_data

    // ALU operand B: 0x42 on cycle 0, 0x08 on cycle 1+
    node val_42: Bus[\1]
    val_42 = Input(value=0x42)

    node val_08: Bus[\1]
    val_08 = Input(value=0x08)

    node operand_b_mux: Mux
    operand_b_mux.sel = cycle_is_0.eq
    operand_b_mux.a = val_08
    operand_b_mux.b = val_42
    alu.b = operand_b_mux.out

    // ALU operation: ADD (000)
    node add_op: Bus[\1]
    add_op = Input(value=0b000)
    alu.op = add_op

    // Carry in: 0
    node zero_carry: Bit
    zero_carry = Input(value=0)
    alu.carry_in = zero_carry

    // === Register Write Control ===

    // Write enable: always enabled for this test
    node write_en: Bit
    write_en = Input(value=1)
    registers.write_enable = write_en

    // Write selector: A on cycles 0-1, X on cycle 2
    node write_sel_A: Bus[\1]
    write_sel_A = Input(value=0b00)

    node write_sel_X: Bus[\1]
    write_sel_X = Input(value=0b01)

    node write_sel_mux: Mux
    write_sel_mux.sel = cycle_is_2.eq
    write_sel_mux.a = write_sel_A
    write_sel_mux.b = write_sel_X
    registers.write_sel = write_sel_mux.out

    // Write data: ALU result
    registers.write_data = alu.result

    // === Outputs ===

    result = alu.result
    zero_flag = alu.zero
    negative_flag = alu.negative
    carry_flag = alu.carry_out

    // Read register A
    node reg_a_reader: Mux
    reg_a_reader.sel = Input(value=0)
    reg_a_reader.a = registers.read_data
    reg_a_reader.b = Input(value=0)
    reg_a_out = reg_a_reader.a

    // Read register X (need to change read_sel)
    // For simplicity, just output the write_data when writing to X
    node x_out_mux: Mux
    x_out_mux.sel = cycle_is_2.eq
    x_out_mux.a = Input(value=0)
    x_out_mux.b = registers.write_data
    reg_x_out = x_out_mux.out
  }
}
