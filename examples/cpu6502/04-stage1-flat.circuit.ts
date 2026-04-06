// Auto-generated from DSL

const Stage1Flat = circuit('Stage1Flat', {
  out: { cycle: bus(8), reg_a: bus(8), reg_x: bus(8) },
  nodes: { counter: Register, always_on: Constant, inc: Incrementer, c0: Constant, c1: Constant, c2: Constant, c3: Constant, is_c0: Comparator, is_c2: Comparator, is_c3: Comparator, regA: Register, regX: Register, adder: Adder, v66: Constant, v8: Constant, v10: Constant, alu_a_mux: Mux, alu_b_mux1: Mux, alu_b_mux2: Mux, alu_b_mux3: Mux, write_a_mux1: Mux, write_a_mux2: Mux, write_x_mux1: Mux, write_x_mux2: Mux },
  nodeArgs: { always_on: { value: 1 }, c0: { value: 0 }, c1: { value: 1 }, c2: { value: 2 }, c3: { value: 3 }, v66: { value: 66 }, v8: { value: 8 }, v10: { value: 10 } },
  connect: ({ in: inp, out, counter, always_on, inc, c0, c1, c2, c3, is_c0, is_c2, is_c3, regA, regX, adder, v66, v8, v10, alu_a_mux, alu_b_mux1, alu_b_mux2, alu_b_mux3, write_a_mux1, write_a_mux2, write_x_mux1, write_x_mux2 }) => [
    always_on.out.to(counter.we, write_a_mux1.in0, write_x_mux1.in1, write_x_mux2.in1),
    counter.q.to(inc.in, out.cycle, is_c0.a, is_c2.a, is_c3.a),
    inc.out.to(counter.data),
    c0.out.to(is_c0.b, adder.carry_in, alu_b_mux2.in1, write_a_mux1.in1, write_a_mux2.in1, write_x_mux1.in0),
    c2.out.to(is_c2.b),
    c3.out.to(is_c3.b),
    regA.q.to(out.reg_a, alu_a_mux.in0),
    regX.q.to(out.reg_x, alu_a_mux.in1),
    is_c3.eq.to(alu_a_mux.sel, alu_b_mux3.sel, write_a_mux2.sel, write_x_mux2.sel),
    alu_a_mux.out.to(adder.a),
    is_c0.eq.to(alu_b_mux1.sel),
    v8.out.to(alu_b_mux1.in0),
    v66.out.to(alu_b_mux1.in1),
    is_c2.eq.to(alu_b_mux2.sel, write_a_mux1.sel, write_x_mux1.sel),
    alu_b_mux1.out.to(alu_b_mux2.in0),
    alu_b_mux2.out.to(alu_b_mux3.in0),
    v10.out.to(alu_b_mux3.in1),
    alu_b_mux3.out.to(adder.b),
    write_a_mux1.out.to(write_a_mux2.in0),
    write_a_mux2.out.to(regA.we),
    adder.sum.to(regA.data, regX.data),
    write_x_mux1.out.to(write_x_mux2.in0),
    write_x_mux2.out.to(regX.we),
  ],
})

const Stage1FlatDemo = circuit('Stage1FlatDemo', {
  nodes: { cpu: Stage1Flat, d_cycle: HexDisplay, d_a: HexDisplay, d_x: HexDisplay },
  connect: ({ in: inp, out, cpu, d_cycle, d_a, d_x }) => [
    cpu.cycle.to(d_cycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
  ],
})
