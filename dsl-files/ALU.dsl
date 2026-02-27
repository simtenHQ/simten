// 8-Bit ALU — The Heart of Every CPU
//
// 8 operations selected by 3-bit opcode:
//   000: ADD    a + b
//   001: SUB    a - b
//   010: AND    a & b
//   011: OR     a | b
//   100: XOR    a ^ b
//   101: NOT    ~a
//   110: SHL    a << b
//   111: SHR    a >> b
//
// Status flags: Zero, Carry, Negative
// All 8 operations computed in parallel, mux tree selects result.

circuit ALU {
  description "8-bit ALU — 8 operations, 3 status flags, the heart of every CPU"
  input a: Bus[8]
  input b: Bus[8]
  input op0: Bit
  input op1: Bit
  input op2: Bit
  output result: Bus[8]
  output zero: Bit
  output carry: Bit
  output negative: Bit
  impl {
    node gnd: Constant(value=0)

    // All 8 arithmetic/logic units run in parallel
    node add: Adder
    node sub: Subtractor
    node band: BusAnd
    node bor: BusOr
    node bxor: BusXor
    node bnot: BusNot
    node shl: LeftShifter
    node shr: RightShifter

    connect a -> add.a
    connect b -> add.b
    connect gnd.out -> add.carry_in

    connect a -> sub.a
    connect b -> sub.b
    connect gnd.out -> sub.borrow_in

    connect a -> band.a
    connect b -> band.b

    connect a -> bor.a
    connect b -> bor.b

    connect a -> bxor.a
    connect b -> bxor.b

    connect a -> bnot.in

    connect a -> shl.value
    connect b -> shl.shift

    connect a -> shr.value
    connect b -> shr.shift

    // 3-level mux tree selects result from opcode
    // Level 1: op0 picks within pairs
    node m01: Mux(width=8)
    connect add.sum -> m01.in0
    connect sub.difference -> m01.in1
    connect op0 -> m01.sel

    node m23: Mux(width=8)
    connect band.out -> m23.in0
    connect bor.out -> m23.in1
    connect op0 -> m23.sel

    node m45: Mux(width=8)
    connect bxor.out -> m45.in0
    connect bnot.out -> m45.in1
    connect op0 -> m45.sel

    node m67: Mux(width=8)
    connect shl.result -> m67.in0
    connect shr.result -> m67.in1
    connect op0 -> m67.sel

    // Level 2: op1 picks between pairs
    node m03: Mux(width=8)
    connect m01.out -> m03.in0
    connect m23.out -> m03.in1
    connect op1 -> m03.sel

    node m47: Mux(width=8)
    connect m45.out -> m47.in0
    connect m67.out -> m47.in1
    connect op1 -> m47.sel

    // Level 3: op2 picks final result
    node mfinal: Mux(width=8)
    connect m03.out -> mfinal.in0
    connect m47.out -> mfinal.in1
    connect op2 -> mfinal.sel

    connect mfinal.out -> result

    // --- Flags ---

    // Carry from adder
    connect add.carry_out -> carry

    // Negative = MSB of result
    node split_r: Splitter8to8
    connect mfinal.out -> split_r.in
    connect split_r.bit7 -> negative

    // Zero = NOR tree (result == 0)
    node or01: Or
    node or23: Or
    node or45: Or
    node or67: Or
    connect split_r.bit0 -> or01.a
    connect split_r.bit1 -> or01.b
    connect split_r.bit2 -> or23.a
    connect split_r.bit3 -> or23.b
    connect split_r.bit4 -> or45.a
    connect split_r.bit5 -> or45.b
    connect split_r.bit6 -> or67.a
    connect split_r.bit7 -> or67.b

    node or_lo: Or
    node or_hi: Or
    connect or01.out -> or_lo.a
    connect or23.out -> or_lo.b
    connect or45.out -> or_hi.a
    connect or67.out -> or_hi.b

    node or_all: Or
    connect or_lo.out -> or_all.a
    connect or_hi.out -> or_all.b

    node inv_z: Not
    connect or_all.out -> inv_z.in
    connect inv_z.out -> zero
  }
}

circuit ALUDemo {
  description "Interactive ALU — toggle opcode switches to change operations in real time"
  impl {
    node a: Input(value=42)
    node b: Input(value=13)

    // Opcode switches (toggle to select operation)
    node op0: Switch
    node op1: Switch
    node op2: Switch

    node alu: ALU
    connect a.out -> alu.a
    connect b.out -> alu.b
    connect op0.out -> alu.op0
    connect op1.out -> alu.op1
    connect op2.out -> alu.op2

    // Hex displays for inputs and result
    node disp_a: HexDisplay
    node disp_b: HexDisplay
    node disp_result: HexDisplay
    connect a.out -> disp_a.in
    connect b.out -> disp_b.in
    connect alu.result -> disp_result.in

    // Flag LEDs
    node led_zero: Led
    node led_carry: Led
    node led_neg: Led
    connect alu.zero -> led_zero.in
    connect alu.carry -> led_carry.in
    connect alu.negative -> led_neg.in
  }
}
