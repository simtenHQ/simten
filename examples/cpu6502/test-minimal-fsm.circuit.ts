// Auto-generated from DSL

const MinimalFSM = component('MinimalFSM')
  .in('reset', bit)
  .out('current_state', bus(3))
  .node('state_reg', Register)
  .node('zero', Constant, { value: 0 })
  .node('always_on', Constant, { value: 1 })
  .connect(({ in: inp, out, state_reg, zero, always_on }) => [
    zero.out.to(state_reg.data),
    always_on.out.to(state_reg.we),
    state_reg.q.to(out.current_state),
  ])
  .build()
