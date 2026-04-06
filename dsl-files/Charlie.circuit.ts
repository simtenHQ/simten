// Auto-generated from DSL

const Charlie = circuit('Charlie', {
  in: { start: bus(8) },
  out: { value: bus(8) },
  nodes: { reg: Register, loaded: DFlipFlop, sub: Subtractor, one: Constant, load_mux: Mux, we: Constant, loaded_flag: Constant },
  nodeArgs: { one: { value: 1 }, we: { value: 1 }, loaded_flag: { value: 1 } },
  connect: ({ in: inp, out, reg, loaded, sub, one, load_mux, we, loaded_flag }) => [
    reg.q.to(sub.a, out.value),
    one.out.to(sub.b),
    loaded.q.to(load_mux.sel),
    inp.start.to(load_mux.in0),
    sub.difference.to(load_mux.in1),
    load_mux.out.to(reg.data),
    we.out.to(reg.we),
    loaded_flag.out.to(loaded.d),
  ],
})
