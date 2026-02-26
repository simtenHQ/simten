// 16-bit ALU with 8 operations selected by 3-bit opcode
// 000=ADD  001=SUB  010=AND  011=OR  100=XOR  101=NOT  110=SHL  111=SHR
circuit ALU16 {
  description "16-bit ALU with 8 operations"
  input a: Bus[16]
  input b: Bus[16]
  input op0: Bit
  input op1: Bit
  input op2: Bit
  output result: Bus[16]
  output carry: Bit
  impl {
    // All 8 operations computed in parallel
    node adder: Adder(width=16)
    node sub: Subtractor(width=16)
    node band: BusAnd(width=16)
    node bor: BusOr(width=16)
    node bxor: BusXor(width=16)
    node bnot: BusNot(width=16)
    node shl: LeftShifter(width=16)
    node shr: RightShifter(width=16)

    connect a -> adder.a
    connect b -> adder.b
    connect a -> sub.a
    connect b -> sub.b
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

    // 8:1 mux tree from seven 2:1 muxes (3 levels)
    // Level 1: op0 selects within pairs
    node mux_01: Mux(width=16)
    node mux_23: Mux(width=16)
    node mux_45: Mux(width=16)
    node mux_67: Mux(width=16)

    connect adder.sum -> mux_01.in0
    connect sub.difference -> mux_01.in1
    connect op0 -> mux_01.sel

    connect band.out -> mux_23.in0
    connect bor.out -> mux_23.in1
    connect op0 -> mux_23.sel

    connect bxor.out -> mux_45.in0
    connect bnot.out -> mux_45.in1
    connect op0 -> mux_45.sel

    connect shl.result -> mux_67.in0
    connect shr.result -> mux_67.in1
    connect op0 -> mux_67.sel

    // Level 2: op1 selects between pairs
    node mux_0123: Mux(width=16)
    node mux_4567: Mux(width=16)

    connect mux_01.out -> mux_0123.in0
    connect mux_23.out -> mux_0123.in1
    connect op1 -> mux_0123.sel

    connect mux_45.out -> mux_4567.in0
    connect mux_67.out -> mux_4567.in1
    connect op1 -> mux_4567.sel

    // Level 3: op2 selects final result
    node mux_final: Mux(width=16)

    connect mux_0123.out -> mux_final.in0
    connect mux_4567.out -> mux_final.in1
    connect op2 -> mux_final.sel

    connect mux_final.out -> result
    connect adder.carry_out -> carry
  }
}

// 16-bit accumulator CPU
circuit CPU16 {
  description "16-bit accumulator CPU with 8-operation ALU"
  input data_in: Bus[16]
  input op0: Bit
  input op1: Bit
  input op2: Bit
  input load: Bit
  input we: Bit
  output acc_out: Bus[16]
  output carry: Bit
  clock clk
  impl {
    node acc: Register(width=16)
    node alu: ALU16
    node load_mux: Mux(width=16)

    connect acc.q -> alu.a
    connect data_in -> alu.b
    connect op0 -> alu.op0
    connect op1 -> alu.op1
    connect op2 -> alu.op2

    connect alu.result -> load_mux.in0
    connect data_in -> load_mux.in1
    connect load -> load_mux.sel

    connect load_mux.out -> acc.data
    connect we -> acc.we
    connect clk -> acc.clk

    connect acc.q -> acc_out
    connect alu.carry -> carry
  }
}

// Interactive top-level with controls and display
// Op switches: op2 op1 op0
//   000=ADD  001=SUB  010=AND  011=OR
//   100=XOR  101=NOT  110=SHL  111=SHR
// Steps:
//   1. Set data value, turn LOAD + WE on, Tick → loads value
//   2. Turn LOAD off, set op switches, set data, Tick → ALU result
circuit CPU16_Interactive {
  description "Interactive 16-bit CPU"
  impl {
    node data: Input(value=1000)

    // Control switches
    node op0_sw: Switch
    node op1_sw: Switch
    node op2_sw: Switch
    node load_sw: Switch
    node we_sw: Switch

    node cpu: CPU16

    // Output display
    node display: HexDisplay
    node carry_led: Led

    connect data.out -> cpu.data_in
    connect op0_sw.out -> cpu.op0
    connect op1_sw.out -> cpu.op1
    connect op2_sw.out -> cpu.op2
    connect load_sw.out -> cpu.load
    connect we_sw.out -> cpu.we

    connect cpu.acc_out -> display.in
    connect cpu.carry -> carry_led.in
  }
}
