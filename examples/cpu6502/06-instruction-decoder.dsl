// 6502 CPU Stage 2: Instruction Decoder
// Decodes 5 basic instructions:
//   LDA #imm (0xA9 / 169) - Load accumulator immediate
//   ADC #imm (0x69 / 105) - Add with carry immediate
//   STA abs  (0x8D / 141) - Store accumulator absolute
//   JMP abs  (0x4C / 76)  - Jump absolute
//   BRK      (0x00 / 0)   - Break

circuit InstructionDecoder {
  input opcode: Bus[8]

  output is_LDA_imm: Bit    // 0xA9
  output is_ADC_imm: Bit    // 0x69
  output is_STA_abs: Bit    // 0x8D
  output is_JMP_abs: Bit    // 0x4C
  output is_BRK: Bit        // 0x00

  output addr_mode: Bus[2]  // 00=implied, 01=immediate, 10=absolute
  output cycles: Bus[3]     // Number of cycles for instruction

  impl {
    // === Opcode Constants ===
    node val_LDA: Constant(value=169)  // 0xA9
    node val_ADC: Constant(value=105)  // 0x69
    node val_STA: Constant(value=141)  // 0x8D
    node val_JMP: Constant(value=76)   // 0x4C
    node val_BRK: Constant(value=0)    // 0x00

    // === Opcode Comparators ===
    node cmp_LDA: Comparator
    connect opcode -> cmp_LDA.a
    connect val_LDA.out -> cmp_LDA.b
    connect cmp_LDA.eq -> is_LDA_imm

    node cmp_ADC: Comparator
    connect opcode -> cmp_ADC.a
    connect val_ADC.out -> cmp_ADC.b
    connect cmp_ADC.eq -> is_ADC_imm

    node cmp_STA: Comparator
    connect opcode -> cmp_STA.a
    connect val_STA.out -> cmp_STA.b
    connect cmp_STA.eq -> is_STA_abs

    node cmp_JMP: Comparator
    connect opcode -> cmp_JMP.a
    connect val_JMP.out -> cmp_JMP.b
    connect cmp_JMP.eq -> is_JMP_abs

    node cmp_BRK: Comparator
    connect opcode -> cmp_BRK.a
    connect val_BRK.out -> cmp_BRK.b
    connect cmp_BRK.eq -> is_BRK

    // === Addressing Mode Logic ===
    // 00=implied (BRK), 01=immediate (LDA, ADC), 10=absolute (STA, JMP)

    node mode_implied: Constant(value=0)
    node mode_immediate: Constant(value=1)
    node mode_absolute: Constant(value=2)

    // Is it LDA or ADC? (immediate mode)
    node is_immediate: Or
    connect is_LDA_imm -> is_immediate.a
    connect is_ADC_imm -> is_immediate.b

    // Is it STA or JMP? (absolute mode)
    node is_absolute: Or
    connect is_STA_abs -> is_absolute.a
    connect is_JMP_abs -> is_absolute.b

    // Select mode: immediate > absolute > implied
    node mode_mux1: Mux
    connect is_absolute.out -> mode_mux1.sel
    connect mode_implied.out -> mode_mux1.in0      // default: implied
    connect mode_absolute.out -> mode_mux1.in1     // if absolute

    node mode_mux2: Mux
    connect is_immediate.out -> mode_mux2.sel
    connect mode_mux1.out -> mode_mux2.in0         // implied or absolute
    connect mode_immediate.out -> mode_mux2.in1    // if immediate

    connect mode_mux2.out -> addr_mode

    // === Cycle Count Logic ===
    // LDA #imm: 2 cycles
    // ADC #imm: 2 cycles
    // STA abs:  4 cycles
    // JMP abs:  3 cycles
    // BRK:      7 cycles (we'll simplify to 1 for now)

    node cycles_1: Constant(value=1)  // BRK (simplified)
    node cycles_2: Constant(value=2)  // LDA, ADC
    node cycles_3: Constant(value=3)  // JMP
    node cycles_4: Constant(value=4)  // STA

    // Build cycle count using cascaded muxes
    // Priority: STA (4) > JMP (3) > immediate (2) > BRK (1)

    node cycle_mux1: Mux
    connect is_immediate.out -> cycle_mux1.sel
    connect cycles_1.out -> cycle_mux1.in0         // default: 1
    connect cycles_2.out -> cycle_mux1.in1         // if immediate: 2

    node cycle_mux2: Mux
    connect is_JMP_abs -> cycle_mux2.sel
    connect cycle_mux1.out -> cycle_mux2.in0       // BRK or immediate
    connect cycles_3.out -> cycle_mux2.in1         // if JMP: 3

    node cycle_mux3: Mux
    connect is_STA_abs -> cycle_mux3.sel
    connect cycle_mux2.out -> cycle_mux3.in0       // BRK, immediate, or JMP
    connect cycles_4.out -> cycle_mux3.in1         // if STA: 4

    connect cycle_mux3.out -> cycles
  }
}

// === Test Circuit ===
circuit InstructionDecoderTest {
  output is_LDA: Bit
  output is_ADC: Bit
  output is_STA: Bit
  output is_JMP: Bit
  output is_BRK: Bit
  output mode: Bus[2]
  output cycles: Bus[3]

  impl {
    node decoder: InstructionDecoder

    // Manual opcode input for testing
    node opcode_input: Input  // Try: 169 (LDA), 105 (ADC), 141 (STA), 76 (JMP), 0 (BRK)

    connect opcode_input.out -> decoder.opcode

    connect decoder.is_LDA_imm -> is_LDA
    connect decoder.is_ADC_imm -> is_ADC
    connect decoder.is_STA_abs -> is_STA
    connect decoder.is_JMP_abs -> is_JMP
    connect decoder.is_BRK -> is_BRK
    connect decoder.addr_mode -> mode
    connect decoder.cycles -> cycles

    // Add displays
    node d_mode: HexDisplay
    connect mode -> d_mode.in

    node d_cycles: HexDisplay
    connect cycles -> d_cycles.in
  }
}
