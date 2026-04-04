// Auto-generated from DSL

const InstructionDecoder = component('InstructionDecoder')
  .in('opcode', bus(8))
  .out('is_LDA_imm', bit)
  .out('is_ADC_imm', bit)
  .out('is_STA_abs', bit)
  .out('is_JMP_abs', bit)
  .out('is_BRK', bit)
  .out('addr_mode', bus(2))
  .out('cycles', bus(3))
  .node('val_LDA', Constant, { value: 169 })
  .node('val_ADC', Constant, { value: 105 })
  .node('val_STA', Constant, { value: 141 })
  .node('val_JMP', Constant, { value: 76 })
  .node('val_BRK', Constant, { value: 0 })
  .node('cmp_LDA', Comparator)
  .node('cmp_ADC', Comparator)
  .node('cmp_STA', Comparator)
  .node('cmp_JMP', Comparator)
  .node('cmp_BRK', Comparator)
  .node('mode_implied', Constant, { value: 0 })
  .node('mode_immediate', Constant, { value: 1 })
  .node('mode_absolute', Constant, { value: 2 })
  .node('is_immediate', Or)
  .node('is_absolute', Or)
  .node('mode_mux1', Mux)
  .node('mode_mux2', Mux)
  .node('cycles_1', Constant, { value: 1 })
  .node('cycles_2', Constant, { value: 2 })
  .node('cycles_3', Constant, { value: 3 })
  .node('cycles_4', Constant, { value: 4 })
  .node('cycle_mux1', Mux)
  .node('cycle_mux2', Mux)
  .node('cycle_mux3', Mux)
  .connect(({ in: inp, out, val_LDA, val_ADC, val_STA, val_JMP, val_BRK, cmp_LDA, cmp_ADC, cmp_STA, cmp_JMP, cmp_BRK, mode_implied, mode_immediate, mode_absolute, is_immediate, is_absolute, mode_mux1, mode_mux2, cycles_1, cycles_2, cycles_3, cycles_4, cycle_mux1, cycle_mux2, cycle_mux3 }) => [
    inp.opcode.to(cmp_LDA.a, cmp_ADC.a, cmp_STA.a, cmp_JMP.a, cmp_BRK.a),
    val_LDA.out.to(cmp_LDA.b),
    cmp_LDA.eq.to(out.is_LDA_imm),
    val_ADC.out.to(cmp_ADC.b),
    cmp_ADC.eq.to(out.is_ADC_imm),
    val_STA.out.to(cmp_STA.b),
    cmp_STA.eq.to(out.is_STA_abs),
    val_JMP.out.to(cmp_JMP.b),
    cmp_JMP.eq.to(out.is_JMP_abs),
    val_BRK.out.to(cmp_BRK.b),
    cmp_BRK.eq.to(out.is_BRK),
    out.is_LDA_imm.to(is_immediate.a),
    out.is_ADC_imm.to(is_immediate.b),
    out.is_STA_abs.to(is_absolute.a, cycle_mux3.sel),
    out.is_JMP_abs.to(is_absolute.b, cycle_mux2.sel),
    is_absolute.out.to(mode_mux1.sel),
    mode_implied.out.to(mode_mux1.in0),
    mode_absolute.out.to(mode_mux1.in1),
    is_immediate.out.to(mode_mux2.sel, cycle_mux1.sel),
    mode_mux1.out.to(mode_mux2.in0),
    mode_immediate.out.to(mode_mux2.in1),
    mode_mux2.out.to(out.addr_mode),
    cycles_1.out.to(cycle_mux1.in0),
    cycles_2.out.to(cycle_mux1.in1),
    cycle_mux1.out.to(cycle_mux2.in0),
    cycles_3.out.to(cycle_mux2.in1),
    cycle_mux2.out.to(cycle_mux3.in0),
    cycles_4.out.to(cycle_mux3.in1),
    cycle_mux3.out.to(out.cycles),
  ])
  .build()

const InstructionDecoderTest = component('InstructionDecoderTest')
  .out('is_LDA', bit)
  .out('is_ADC', bit)
  .out('is_STA', bit)
  .out('is_JMP', bit)
  .out('is_BRK', bit)
  .out('mode', bus(2))
  .out('cycles', bus(3))
  .node('decoder', InstructionDecoder)
  .node('opcode_input', Input)
  .node('d_mode', HexDisplay)
  .node('d_cycles', HexDisplay)
  .connect(({ in: inp, out, decoder, opcode_input, d_mode, d_cycles }) => [
    opcode_input.out.to(decoder.opcode),
    decoder.is_LDA_imm.to(out.is_LDA),
    decoder.is_ADC_imm.to(out.is_ADC),
    decoder.is_STA_abs.to(out.is_STA),
    decoder.is_JMP_abs.to(out.is_JMP),
    decoder.is_BRK.to(out.is_BRK),
    decoder.addr_mode.to(out.mode),
    decoder.cycles.to(out.cycles),
    out.mode.to(d_mode.in),
    out.cycles.to(d_cycles.in),
  ])
  .build()
