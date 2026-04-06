// Auto-generated from DSL

const Decounter = circuit('Decounter', {
  in: { load_val: bus(8), load: bit, enable: bit },
  out: { count: bus(8) },
  nodes: { counter_reg: Register, prev_val: Subtractor, one: Constant, zero: Constant, enable_mux: Mux, load_mux: Mux, write_enable: Constant },
  nodeArgs: { one: { value: 1 }, zero: { value: 0 }, write_enable: { value: 1 } },
  connect: ({ in: inp, out, counter_reg, prev_val, one, zero, enable_mux, load_mux, write_enable }) => [
    counter_reg.q.to(prev_val.a, enable_mux.in0, out.count),
    one.out.to(prev_val.b),
    zero.out.to(prev_val.borrow_in),
    inp.enable.to(enable_mux.sel),
    prev_val.difference.to(enable_mux.in1),
    inp.load.to(load_mux.sel),
    enable_mux.out.to(load_mux.in0),
    inp.load_val.to(load_mux.in1),
    load_mux.out.to(counter_reg.data),
    write_enable.out.to(counter_reg.we),
  ],
})
