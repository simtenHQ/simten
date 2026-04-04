// Auto-generated from DSL

const Charlie = component('Charlie')
  .in('start', bus(8))
  .out('value', bus(8))
  .node('reg', Register)
  .node('loaded', DFlipFlop)
  .node('sub', Subtractor)
  .node('one', Constant, { value: 1 })
  .node('load_mux', Mux)
  .node('we', Constant, { value: 1 })
  .node('loaded_flag', Constant, { value: 1 })
  .connect(({ in: inp, out, reg, loaded, sub, one, load_mux, we, loaded_flag }) => [
    reg.q.to(sub.a, out.value),
    one.out.to(sub.b),
    loaded.q.to(load_mux.sel),
    inp.start.to(load_mux.in0),
    sub.difference.to(load_mux.in1),
    load_mux.out.to(reg.data),
    we.out.to(reg.we),
    loaded_flag.out.to(loaded.d),
  ])
  .build()
