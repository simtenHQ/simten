// Auto-generated from DSL

const MinimalFSM = circuit('MinimalFSM', {
  in: { reset: bit },
  out: { current_state: bus(3) },
  nodes: { state_reg: Register, zero: Constant, always_on: Constant },
  nodeArgs: { zero: { value: 0 }, always_on: { value: 1 } },
  connect: ({ in: inp, out, state_reg, zero, always_on }) => [
    zero.out.to(state_reg.data),
    always_on.out.to(state_reg.we),
    state_reg.q.to(out.current_state),
  ],
})
