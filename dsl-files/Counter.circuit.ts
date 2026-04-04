// Auto-generated from DSL

const Counter = component('Counter', {
  in: { reset: bit, enable: bit },
  out: { count: bus(8) },
  nodes: { counter_reg: Register, next_val: Adder, one: Constant, reset_mux: Mux, enable_mux: Mux, zero: Constant, write_enable: Constant },
  nodeArgs: { one: { value: 1 }, zero: { value: 0 }, write_enable: { value: 1 } },
  connect: ({ in: inp, out, counter_reg, next_val, one, reset_mux, enable_mux, zero, write_enable }) => [
    counter_reg.q.to(next_val.a, enable_mux.in0, out.count),
    one.out.to(next_val.b),
    inp.enable.to(enable_mux.sel),
    next_val.sum.to(enable_mux.in1),
    inp.reset.to(reset_mux.sel),
    enable_mux.out.to(reset_mux.in0),
    zero.out.to(reset_mux.in1),
    reset_mux.out.to(counter_reg.data),
    write_enable.out.to(counter_reg.we),
  ],
})
