// Auto-generated from DSL

const Decounter = component('Decounter')
  .in('load_val', bus(8))
  .in('load', bit)
  .in('enable', bit)
  .out('count', bus(8))
  .node('counter_reg', Register)
  .node('prev_val', Subtractor)
  .node('one', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('enable_mux', Mux)
  .node('load_mux', Mux)
  .node('write_enable', Constant, { value: 1 })
  .connect(({ in: inp, out, counter_reg, prev_val, one, zero, enable_mux, load_mux, write_enable }) => [
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
  ])
  .build()
