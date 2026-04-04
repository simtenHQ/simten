// Auto-generated from DSL

const Stage1Flat = component('Stage1Flat')
  .out('cycle', bus(8))
  .out('reg_a', bus(8))
  .out('reg_x', bus(8))
  .node('counter', Register)
  .node('always_on', Constant, { value: 1 })
  .node('inc', Incrementer)
  .node('c0', Constant, { value: 0 })
  .node('c1', Constant, { value: 1 })
  .node('c2', Constant, { value: 2 })
  .node('c3', Constant, { value: 3 })
  .node('is_c0', Comparator)
  .node('is_c2', Comparator)
  .node('is_c3', Comparator)
  .node('regA', Register)
  .node('regX', Register)
  .node('adder', Adder)
  .node('v66', Constant, { value: 66 })
  .node('v8', Constant, { value: 8 })
  .node('v10', Constant, { value: 10 })
  .node('alu_a_mux', Mux)
  .node('alu_b_mux1', Mux)
  .node('alu_b_mux2', Mux)
  .node('alu_b_mux3', Mux)
  .node('write_a_mux1', Mux)
  .node('write_a_mux2', Mux)
  .node('write_x_mux1', Mux)
  .node('write_x_mux2', Mux)
  .connect(({ in: inp, out, counter, always_on, inc, c0, c1, c2, c3, is_c0, is_c2, is_c3, regA, regX, adder, v66, v8, v10, alu_a_mux, alu_b_mux1, alu_b_mux2, alu_b_mux3, write_a_mux1, write_a_mux2, write_x_mux1, write_x_mux2 }) => [
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
  ])
  .build()

const Stage1FlatDemo = component('Stage1FlatDemo')
  .node('cpu', Stage1Flat)
  .node('d_cycle', HexDisplay)
  .node('d_a', HexDisplay)
  .node('d_x', HexDisplay)
  .connect(({ in: inp, out, cpu, d_cycle, d_a, d_x }) => [
    cpu.cycle.to(d_cycle.in),
    cpu.reg_a.to(d_a.in),
    cpu.reg_x.to(d_x.in),
  ])
  .build()
