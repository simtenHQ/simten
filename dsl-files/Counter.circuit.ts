// Auto-generated from DSL

const Counter = component('Counter')
  .in('reset', bit)
  .in('enable', bit)
  .out('count', bus(8))
  .node('counter_reg', Register)
  .node('next_val', Adder)
  .node('one', Constant, { value: 1 })
  .node('reset_mux', Mux)
  .node('enable_mux', Mux)
  .node('zero', Constant, { value: 0 })
  .node('write_enable', Constant, { value: 1 })
  .connect(({ in: inp, out, counter_reg, next_val, one, reset_mux, enable_mux, zero, write_enable }) => [
    counter_reg.q.to(next_val.a, enable_mux.in0, out.count),
    one.out.to(next_val.b),
    inp.enable.to(enable_mux.sel),
    next_val.sum.to(enable_mux.in1),
    inp.reset.to(reset_mux.sel),
    enable_mux.out.to(reset_mux.in0),
    zero.out.to(reset_mux.in1),
    reset_mux.out.to(counter_reg.data),
    write_enable.out.to(counter_reg.we),
  ])
  .build()
