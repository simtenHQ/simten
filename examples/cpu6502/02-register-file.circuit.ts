// Auto-generated from DSL

const RegisterFile = circuit('RegisterFile', {
  in: { write_sel: bus(2), write_data: bus(8), write_enable: bit, read_sel: bus(2) },
  out: { read_data: bus(8) },
  nodes: { regA: Register, regX: Register, regY: Register, sel_0: Constant, sel_1: Constant, sel_2: Constant, is_sel_A: Comparator, is_sel_X: Comparator, is_sel_Y: Comparator, write_A: And, write_X: And, write_Y: And, is_read_X: Comparator, is_read_Y: Comparator, read_mux1: Mux, read_mux2: Mux },
  nodeArgs: { sel_0: { value: 0 }, sel_1: { value: 1 }, sel_2: { value: 2 } },
  connect: ({ in: inp, out, regA, regX, regY, sel_0, sel_1, sel_2, is_sel_A, is_sel_X, is_sel_Y, write_A, write_X, write_Y, is_read_X, is_read_Y, read_mux1, read_mux2 }) => [
    inp.write_data.to(regA.data, regX.data, regY.data),
    inp.write_sel.to(is_sel_A.a, is_sel_X.a, is_sel_Y.a),
    sel_0.out.to(is_sel_A.b),
    sel_1.out.to(is_sel_X.b, is_read_X.b),
    sel_2.out.to(is_sel_Y.b, is_read_Y.b),
    is_sel_A.eq.to(write_A.a),
    inp.write_enable.to(write_A.b, write_X.b, write_Y.b),
    write_A.out.to(regA.we),
    is_sel_X.eq.to(write_X.a),
    write_X.out.to(regX.we),
    is_sel_Y.eq.to(write_Y.a),
    write_Y.out.to(regY.we),
    inp.read_sel.to(is_read_X.a, is_read_Y.a),
    is_read_X.eq.to(read_mux1.sel),
    regA.q.to(read_mux1.in0),
    regX.q.to(read_mux1.in1),
    is_read_Y.eq.to(read_mux2.sel),
    read_mux1.out.to(read_mux2.in0),
    regY.q.to(read_mux2.in1),
    read_mux2.out.to(out.read_data),
  ],
})

const RegisterFileTest = circuit('RegisterFileTest', {
  out: { reg_a: bus(8), reg_x: bus(8), reg_y: bus(8) },
  nodes: { regfile: RegisterFile, write_sel_input: Input, write_data_input: Input, write_enable_input: Input, read_sel_input: Input, sel_0: Constant, sel_1: Constant, sel_2: Constant, reader_A: RegisterFile, reader_X: RegisterFile, reader_Y: RegisterFile },
  nodeArgs: { sel_0: { value: 0 }, sel_1: { value: 1 }, sel_2: { value: 2 } },
  connect: ({ in: inp, out, regfile, write_sel_input, write_data_input, write_enable_input, read_sel_input, sel_0, sel_1, sel_2, reader_A, reader_X, reader_Y }) => [
    write_sel_input.out.to(regfile.write_sel, reader_A.write_sel, reader_X.write_sel, reader_Y.write_sel),
    write_data_input.out.to(regfile.write_data, reader_A.write_data, reader_X.write_data, reader_Y.write_data),
    write_enable_input.out.to(regfile.write_enable, reader_A.write_enable, reader_X.write_enable, reader_Y.write_enable),
    read_sel_input.out.to(regfile.read_sel),
    sel_0.out.to(reader_A.read_sel),
    reader_A.read_data.to(out.reg_a),
    sel_1.out.to(reader_X.read_sel),
    reader_X.read_data.to(out.reg_x),
    sel_2.out.to(reader_Y.read_sel),
    reader_Y.read_data.to(out.reg_y),
  ],
})
