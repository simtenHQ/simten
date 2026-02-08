// Stage 5 Flag Components: Status Register and Flag Logic
// Implements N, Z, C, V flags for the 6502 processor status register
//
// N (Negative) - Set if result bit 7 is 1
// Z (Zero)     - Set if result is 0
// C (Carry)    - Set on unsigned overflow (ADC) or borrow (SBC/CMP)
// V (Overflow) - Set on signed overflow

// === Flag Register ===
// Holds the processor status flags
// Each flag can be individually updated or held
circuit FlagRegister {
  // Flag update enables
  input update_n: Bit
  input update_z: Bit
  input update_c: Bit
  input update_v: Bit

  // New flag values (when update is enabled)
  input new_n: Bit
  input new_z: Bit
  input new_c: Bit
  input new_v: Bit

  // Current flag outputs
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit

  clock clk

  impl {
    // N flag register
    node reg_n: Register(initial=0)
    connect clk -> reg_n.clk
    connect update_n -> reg_n.we
    connect new_n -> reg_n.data
    connect reg_n.q -> flag_n

    // Z flag register
    node reg_z: Register(initial=0)
    connect clk -> reg_z.clk
    connect update_z -> reg_z.we
    connect new_z -> reg_z.data
    connect reg_z.q -> flag_z

    // C flag register
    node reg_c: Register(initial=0)
    connect clk -> reg_c.clk
    connect update_c -> reg_c.we
    connect new_c -> reg_c.data
    connect reg_c.q -> flag_c

    // V flag register
    node reg_v: Register(initial=0)
    connect clk -> reg_v.clk
    connect update_v -> reg_v.we
    connect new_v -> reg_v.data
    connect reg_v.q -> flag_v
  }
}

// === Flag Calculator ===
// Calculates flag values from ALU result
// Used for LDA, LDX, LDY, TAX, etc. (N and Z only)
// Used for ADC, SBC (N, Z, C, V)
// Used for CMP, CPX, CPY (N, Z, C)
circuit FlagCalculator {
  input result: Bus[8]        // ALU result (for N, Z)
  input carry_out: Bit        // Carry from addition/subtraction
  input operand_a_bit7: Bit   // Bit 7 of first operand (for V calc)
  input operand_b_bit7: Bit   // Bit 7 of second operand (for V calc)
  input result_bit7: Bit      // Bit 7 of result (for V calc)

  output calc_n: Bit          // Calculated N flag
  output calc_z: Bit          // Calculated Z flag
  output calc_c: Bit          // Calculated C flag
  output calc_v: Bit          // Calculated V flag

  impl {
    // N flag: bit 7 of result
    // For 8-bit value, we need to extract bit 7
    // Using comparator: if result >= 128, N=1
    node const_128: Constant(value=128)
    node cmp_neg: Comparator
    connect result -> cmp_neg.a
    connect const_128.out -> cmp_neg.b
    // N = 1 if result >= 128 (i.e., bit 7 is set)
    // cmp_neg.gte gives us result >= 128
    node n_flag: Or
    connect cmp_neg.gt -> n_flag.a
    connect cmp_neg.eq -> n_flag.b
    connect n_flag.out -> calc_n

    // Z flag: result == 0
    node const_0: Constant(value=0)
    node cmp_zero: Comparator
    connect result -> cmp_zero.a
    connect const_0.out -> cmp_zero.b
    connect cmp_zero.eq -> calc_z

    // C flag: carry out from addition, or NOT borrow for subtraction
    // For CMP: C = 1 if A >= M (no borrow needed)
    connect carry_out -> calc_c

    // V flag: signed overflow
    // V = 1 if operands have same sign but result has different sign
    // V = (A[7] == B[7]) AND (A[7] != R[7])
    // Using XOR: V = NOT(A[7] XOR B[7]) AND (A[7] XOR R[7])
    node xor_ab: Xor
    connect operand_a_bit7 -> xor_ab.a
    connect operand_b_bit7 -> xor_ab.b

    node xor_ar: Xor
    connect operand_a_bit7 -> xor_ar.a
    connect result_bit7 -> xor_ar.b

    node not_xor_ab: Not
    connect xor_ab.out -> not_xor_ab.in

    node v_flag: And
    connect not_xor_ab.out -> v_flag.a
    connect xor_ar.out -> v_flag.b
    connect v_flag.out -> calc_v
  }
}

// === Bit 7 Extractor ===
// Extracts the high bit from an 8-bit value
// Returns 1 if value >= 128, 0 otherwise
circuit Bit7Extractor {
  input value: Bus[8]
  output bit7: Bit

  impl {
    node const_128: Constant(value=128)
    node cmp: Comparator
    connect value -> cmp.a
    connect const_128.out -> cmp.b

    // bit7 = 1 if value >= 128
    node is_gte: Or
    connect cmp.gt -> is_gte.a
    connect cmp.eq -> is_gte.b
    connect is_gte.out -> bit7
  }
}

// === Branch Condition Checker ===
// Evaluates branch conditions based on flags
circuit BranchCondition {
  input flag_n: Bit
  input flag_z: Bit
  input flag_c: Bit
  input flag_v: Bit

  // Branch type selectors (one-hot)
  input is_beq: Bit   // Branch if Z=1
  input is_bne: Bit   // Branch if Z=0
  input is_bcc: Bit   // Branch if C=0
  input is_bcs: Bit   // Branch if C=1
  input is_bmi: Bit   // Branch if N=1
  input is_bpl: Bit   // Branch if N=0
  input is_bvc: Bit   // Branch if V=0
  input is_bvs: Bit   // Branch if V=1

  output branch_taken: Bit

  impl {
    // BEQ: Z=1
    node beq_cond: And
    connect is_beq -> beq_cond.a
    connect flag_z -> beq_cond.b

    // BNE: Z=0
    node not_z: Not
    connect flag_z -> not_z.in
    node bne_cond: And
    connect is_bne -> bne_cond.a
    connect not_z.out -> bne_cond.b

    // BCC: C=0
    node not_c: Not
    connect flag_c -> not_c.in
    node bcc_cond: And
    connect is_bcc -> bcc_cond.a
    connect not_c.out -> bcc_cond.b

    // BCS: C=1
    node bcs_cond: And
    connect is_bcs -> bcs_cond.a
    connect flag_c -> bcs_cond.b

    // BMI: N=1
    node bmi_cond: And
    connect is_bmi -> bmi_cond.a
    connect flag_n -> bmi_cond.b

    // BPL: N=0
    node not_n: Not
    connect flag_n -> not_n.in
    node bpl_cond: And
    connect is_bpl -> bpl_cond.a
    connect not_n.out -> bpl_cond.b

    // BVC: V=0
    node not_v: Not
    connect flag_v -> not_v.in
    node bvc_cond: And
    connect is_bvc -> bvc_cond.a
    connect not_v.out -> bvc_cond.b

    // BVS: V=1
    node bvs_cond: And
    connect is_bvs -> bvs_cond.a
    connect flag_v -> bvs_cond.b

    // OR all conditions together
    node or1: Or
    connect beq_cond.out -> or1.a
    connect bne_cond.out -> or1.b

    node or2: Or
    connect or1.out -> or2.a
    connect bcc_cond.out -> or2.b

    node or3: Or
    connect or2.out -> or3.a
    connect bcs_cond.out -> or3.b

    node or4: Or
    connect or3.out -> or4.a
    connect bmi_cond.out -> or4.b

    node or5: Or
    connect or4.out -> or5.a
    connect bpl_cond.out -> or5.b

    node or6: Or
    connect or5.out -> or6.a
    connect bvc_cond.out -> or6.b

    node or7: Or
    connect or6.out -> or7.a
    connect bvs_cond.out -> or7.b

    connect or7.out -> branch_taken
  }
}

// === Signed Adder for Branch Offset ===
// Adds a signed 8-bit offset to an 8-bit PC
// The offset is sign-extended and added
circuit SignedBranchAdder {
  input pc: Bus[8]
  input offset: Bus[8]   // Signed offset (-128 to +127)

  output result: Bus[8]  // PC + offset

  impl {
    // For simplicity, we just add them as unsigned
    // The wrap-around behavior handles signed arithmetic correctly
    // because (PC + negative_offset) mod 256 = correct result
    node adder: Adder
    connect pc -> adder.a
    connect offset -> adder.b
    node zero: Constant(value=0)
    connect zero.out -> adder.carry_in

    connect adder.sum -> result
  }
}

// === Test Circuit for Flag Components ===
circuit FlagTest {
  clock clk

  impl {
    // Flag Register
    node flags: FlagRegister
    connect clk -> flags.clk

    // Flag Calculator
    node calc: FlagCalculator

    // Bit 7 extractors for operands
    node bit7_a: Bit7Extractor
    node bit7_b: Bit7Extractor
    node bit7_r: Bit7Extractor

    // Branch Condition Checker
    node branch: BranchCondition
    connect flags.flag_n -> branch.flag_n
    connect flags.flag_z -> branch.flag_z
    connect flags.flag_c -> branch.flag_c
    connect flags.flag_v -> branch.flag_v

    // Test inputs
    node result_input: Input
    connect result_input.out -> calc.result
    connect result_input.out -> bit7_r.value
    connect bit7_r.bit7 -> calc.result_bit7

    node operand_a_input: Input
    connect operand_a_input.out -> bit7_a.value
    connect bit7_a.bit7 -> calc.operand_a_bit7

    node operand_b_input: Input
    connect operand_b_input.out -> bit7_b.value
    connect bit7_b.bit7 -> calc.operand_b_bit7

    node carry_input: Input
    connect carry_input.out -> calc.carry_out

    // Update flags from calculator
    node update_input: Input
    connect update_input.out -> flags.update_n
    connect update_input.out -> flags.update_z
    connect update_input.out -> flags.update_c
    connect update_input.out -> flags.update_v

    connect calc.calc_n -> flags.new_n
    connect calc.calc_z -> flags.new_z
    connect calc.calc_c -> flags.new_c
    connect calc.calc_v -> flags.new_v

    // Branch inputs
    node beq_input: Input
    connect beq_input.out -> branch.is_beq

    node bne_input: Input
    connect bne_input.out -> branch.is_bne

    node bcc_input: Input
    connect bcc_input.out -> branch.is_bcc

    node bcs_input: Input
    connect bcs_input.out -> branch.is_bcs

    node bmi_input: Input
    connect bmi_input.out -> branch.is_bmi

    node bpl_input: Input
    connect bpl_input.out -> branch.is_bpl

    node bvc_input: Input
    connect bvc_input.out -> branch.is_bvc

    node bvs_input: Input
    connect bvs_input.out -> branch.is_bvs

    // Displays
    node d_n: HexDisplay
    connect flags.flag_n -> d_n.in

    node d_z: HexDisplay
    connect flags.flag_z -> d_z.in

    node d_c: HexDisplay
    connect flags.flag_c -> d_c.in

    node d_v: HexDisplay
    connect flags.flag_v -> d_v.in

    node d_branch: HexDisplay
    connect branch.branch_taken -> d_branch.in
  }
}
