// Auto-generated from DSL

const FlagRegister = component('FlagRegister')
  .in('update_n', bit)
  .in('update_z', bit)
  .in('update_c', bit)
  .in('update_v', bit)
  .in('new_n', bit)
  .in('new_z', bit)
  .in('new_c', bit)
  .in('new_v', bit)
  .out('flag_n', bit)
  .out('flag_z', bit)
  .out('flag_c', bit)
  .out('flag_v', bit)
  .node('reg_n', Register, { initial: 0 })
  .node('reg_z', Register, { initial: 0 })
  .node('reg_c', Register, { initial: 0 })
  .node('reg_v', Register, { initial: 0 })
  .connect(({ in: inp, out, reg_n, reg_z, reg_c, reg_v }) => [
    inp.update_n.to(reg_n.we),
    inp.new_n.to(reg_n.data),
    reg_n.q.to(out.flag_n),
    inp.update_z.to(reg_z.we),
    inp.new_z.to(reg_z.data),
    reg_z.q.to(out.flag_z),
    inp.update_c.to(reg_c.we),
    inp.new_c.to(reg_c.data),
    reg_c.q.to(out.flag_c),
    inp.update_v.to(reg_v.we),
    inp.new_v.to(reg_v.data),
    reg_v.q.to(out.flag_v),
  ])
  .build()

const FlagCalculator = component('FlagCalculator')
  .in('result', bus(8))
  .in('carry_out', bit)
  .in('operand_a_bit7', bit)
  .in('operand_b_bit7', bit)
  .in('result_bit7', bit)
  .out('calc_n', bit)
  .out('calc_z', bit)
  .out('calc_c', bit)
  .out('calc_v', bit)
  .node('const_128', Constant, { value: 128 })
  .node('cmp_neg', Comparator)
  .node('n_flag', Or)
  .node('const_0', Constant, { value: 0 })
  .node('cmp_zero', Comparator)
  .node('xor_ab', Xor)
  .node('xor_ar', Xor)
  .node('not_xor_ab', Not)
  .node('v_flag', And)
  .connect(({ in: inp, out, const_128, cmp_neg, n_flag, const_0, cmp_zero, xor_ab, xor_ar, not_xor_ab, v_flag }) => [
    inp.result.to(cmp_neg.a, cmp_zero.a),
    const_128.out.to(cmp_neg.b),
    cmp_neg.gt.to(n_flag.a),
    cmp_neg.eq.to(n_flag.b),
    n_flag.out.to(out.calc_n),
    const_0.out.to(cmp_zero.b),
    cmp_zero.eq.to(out.calc_z),
    inp.carry_out.to(out.calc_c),
    inp.operand_a_bit7.to(xor_ab.a, xor_ar.a),
    inp.operand_b_bit7.to(xor_ab.b),
    inp.result_bit7.to(xor_ar.b),
    xor_ab.out.to(not_xor_ab.in),
    not_xor_ab.out.to(v_flag.a),
    xor_ar.out.to(v_flag.b),
    v_flag.out.to(out.calc_v),
  ])
  .build()

const Bit7Extractor = component('Bit7Extractor')
  .in('value', bus(8))
  .out('bit7', bit)
  .node('const_128', Constant, { value: 128 })
  .node('cmp', Comparator)
  .node('is_gte', Or)
  .connect(({ in: inp, out, const_128, cmp, is_gte }) => [
    inp.value.to(cmp.a),
    const_128.out.to(cmp.b),
    cmp.gt.to(is_gte.a),
    cmp.eq.to(is_gte.b),
    is_gte.out.to(out.bit7),
  ])
  .build()

const BranchCondition = component('BranchCondition')
  .in('flag_n', bit)
  .in('flag_z', bit)
  .in('flag_c', bit)
  .in('flag_v', bit)
  .in('is_beq', bit)
  .in('is_bne', bit)
  .in('is_bcc', bit)
  .in('is_bcs', bit)
  .in('is_bmi', bit)
  .in('is_bpl', bit)
  .in('is_bvc', bit)
  .in('is_bvs', bit)
  .out('branch_taken', bit)
  .node('beq_cond', And)
  .node('not_z', Not)
  .node('bne_cond', And)
  .node('not_c', Not)
  .node('bcc_cond', And)
  .node('bcs_cond', And)
  .node('bmi_cond', And)
  .node('not_n', Not)
  .node('bpl_cond', And)
  .node('not_v', Not)
  .node('bvc_cond', And)
  .node('bvs_cond', And)
  .node('or1', Or)
  .node('or2', Or)
  .node('or3', Or)
  .node('or4', Or)
  .node('or5', Or)
  .node('or6', Or)
  .node('or7', Or)
  .connect(({ in: inp, out, beq_cond, not_z, bne_cond, not_c, bcc_cond, bcs_cond, bmi_cond, not_n, bpl_cond, not_v, bvc_cond, bvs_cond, or1, or2, or3, or4, or5, or6, or7 }) => [
    inp.is_beq.to(beq_cond.a),
    inp.flag_z.to(beq_cond.b, not_z.in),
    inp.is_bne.to(bne_cond.a),
    not_z.out.to(bne_cond.b),
    inp.flag_c.to(not_c.in, bcs_cond.b),
    inp.is_bcc.to(bcc_cond.a),
    not_c.out.to(bcc_cond.b),
    inp.is_bcs.to(bcs_cond.a),
    inp.is_bmi.to(bmi_cond.a),
    inp.flag_n.to(bmi_cond.b, not_n.in),
    inp.is_bpl.to(bpl_cond.a),
    not_n.out.to(bpl_cond.b),
    inp.flag_v.to(not_v.in, bvs_cond.b),
    inp.is_bvc.to(bvc_cond.a),
    not_v.out.to(bvc_cond.b),
    inp.is_bvs.to(bvs_cond.a),
    beq_cond.out.to(or1.a),
    bne_cond.out.to(or1.b),
    or1.out.to(or2.a),
    bcc_cond.out.to(or2.b),
    or2.out.to(or3.a),
    bcs_cond.out.to(or3.b),
    or3.out.to(or4.a),
    bmi_cond.out.to(or4.b),
    or4.out.to(or5.a),
    bpl_cond.out.to(or5.b),
    or5.out.to(or6.a),
    bvc_cond.out.to(or6.b),
    or6.out.to(or7.a),
    bvs_cond.out.to(or7.b),
    or7.out.to(out.branch_taken),
  ])
  .build()

const SignedBranchAdder = component('SignedBranchAdder')
  .in('pc', bus(8))
  .in('offset', bus(8))
  .out('result', bus(8))
  .node('adder', Adder)
  .node('zero', Constant, { value: 0 })
  .connect(({ in: inp, out, adder, zero }) => [
    inp.pc.to(adder.a),
    inp.offset.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(out.result),
  ])
  .build()

const FlagTest = component('FlagTest')
  .node('flags', FlagRegister)
  .node('calc', FlagCalculator)
  .node('bit7_a', Bit7Extractor)
  .node('bit7_b', Bit7Extractor)
  .node('bit7_r', Bit7Extractor)
  .node('branch', BranchCondition)
  .node('result_input', Input)
  .node('operand_a_input', Input)
  .node('operand_b_input', Input)
  .node('carry_input', Input)
  .node('update_input', Input)
  .node('beq_input', Input)
  .node('bne_input', Input)
  .node('bcc_input', Input)
  .node('bcs_input', Input)
  .node('bmi_input', Input)
  .node('bpl_input', Input)
  .node('bvc_input', Input)
  .node('bvs_input', Input)
  .node('d_n', HexDisplay)
  .node('d_z', HexDisplay)
  .node('d_c', HexDisplay)
  .node('d_v', HexDisplay)
  .node('d_branch', HexDisplay)
  .connect(({ in: inp, out, flags, calc, bit7_a, bit7_b, bit7_r, branch, result_input, operand_a_input, operand_b_input, carry_input, update_input, beq_input, bne_input, bcc_input, bcs_input, bmi_input, bpl_input, bvc_input, bvs_input, d_n, d_z, d_c, d_v, d_branch }) => [
    flags.flag_n.to(branch.flag_n, d_n.in),
    flags.flag_z.to(branch.flag_z, d_z.in),
    flags.flag_c.to(branch.flag_c, d_c.in),
    flags.flag_v.to(branch.flag_v, d_v.in),
    result_input.out.to(calc.result, bit7_r.value),
    bit7_r.bit7.to(calc.result_bit7),
    operand_a_input.out.to(bit7_a.value),
    bit7_a.bit7.to(calc.operand_a_bit7),
    operand_b_input.out.to(bit7_b.value),
    bit7_b.bit7.to(calc.operand_b_bit7),
    carry_input.out.to(calc.carry_out),
    update_input.out.to(flags.update_n, flags.update_z, flags.update_c, flags.update_v),
    calc.calc_n.to(flags.new_n),
    calc.calc_z.to(flags.new_z),
    calc.calc_c.to(flags.new_c),
    calc.calc_v.to(flags.new_v),
    beq_input.out.to(branch.is_beq),
    bne_input.out.to(branch.is_bne),
    bcc_input.out.to(branch.is_bcc),
    bcs_input.out.to(branch.is_bcs),
    bmi_input.out.to(branch.is_bmi),
    bpl_input.out.to(branch.is_bpl),
    bvc_input.out.to(branch.is_bvc),
    bvs_input.out.to(branch.is_bvs),
    branch.branch_taken.to(d_branch.in),
  ])
  .build()
