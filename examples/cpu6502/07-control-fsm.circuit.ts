// Auto-generated from DSL

const CPUControl = component('CPUControl')
  .in('reset', bit)
  .in('instr_cycles', bus(3))
  .in('is_BRK', bit)
  .out('current_state', bus(3))
  .out('cycle_num', bus(3))
  .out('pc_increment', bit)
  .out('mem_read', bit)
  .out('mem_write', bit)
  .out('alu_enable', bit)
  .out('reg_write', bit)
  .out('halted', bit)
  .node('state_reg', Register)
  .node('cycle_reg', Register)
  .node('halt_reg', Register)
  .node('STATE_FETCH', Constant, { value: 0 })
  .node('STATE_DECODE', Constant, { value: 1 })
  .node('STATE_EXECUTE', Constant, { value: 2 })
  .node('STATE_WRITEBACK', Constant, { value: 3 })
  .node('is_fetch', Comparator)
  .node('is_decode', Comparator)
  .node('is_execute', Comparator)
  .node('is_writeback', Comparator)
  .node('inc_cycle', Incrementer)
  .node('cycle_done', Comparator)
  .node('cycle_reset_or_inc', Mux)
  .node('always_on', Constant, { value: 1 })
  .node('zero', Constant, { value: 0 })
  .node('exec_done', And)
  .node('next_if_fetch', Mux)
  .node('next_if_decode', Mux)
  .node('next_if_execute', Mux)
  .node('handle_reset', Mux)
  .node('set_halt', Or)
  .node('halt_value', Mux)
  .node('mem_read_sig', Or)
  .connect(({ in: inp, out, state_reg, cycle_reg, halt_reg, STATE_FETCH, STATE_DECODE, STATE_EXECUTE, STATE_WRITEBACK, is_fetch, is_decode, is_execute, is_writeback, inc_cycle, cycle_done, cycle_reset_or_inc, always_on, zero, exec_done, next_if_fetch, next_if_decode, next_if_execute, handle_reset, set_halt, halt_value, mem_read_sig }) => [
    state_reg.q.to(is_fetch.a, is_decode.a, is_execute.a, is_writeback.a, next_if_fetch.in0, out.current_state),
    STATE_FETCH.out.to(is_fetch.b, cycle_reset_or_inc.in1, next_if_execute.in1, handle_reset.in1),
    STATE_DECODE.out.to(is_decode.b, next_if_fetch.in1),
    STATE_EXECUTE.out.to(is_execute.b, next_if_decode.in1),
    STATE_WRITEBACK.out.to(is_writeback.b),
    cycle_reg.q.to(inc_cycle.in, cycle_done.a, out.cycle_num),
    inp.instr_cycles.to(cycle_done.b),
    is_fetch.eq.to(cycle_reset_or_inc.sel, next_if_fetch.sel, out.pc_increment, mem_read_sig.a),
    inc_cycle.out.to(cycle_reset_or_inc.in0),
    cycle_reset_or_inc.out.to(cycle_reg.data),
    always_on.out.to(cycle_reg.we, state_reg.we, halt_reg.we),
    is_execute.eq.to(exec_done.a, out.mem_write, out.alu_enable, out.reg_write),
    cycle_done.eq.to(exec_done.b),
    is_decode.eq.to(next_if_decode.sel, mem_read_sig.b),
    next_if_fetch.out.to(next_if_decode.in0),
    exec_done.out.to(next_if_execute.sel),
    next_if_decode.out.to(next_if_execute.in0),
    inp.reset.to(handle_reset.sel, halt_value.sel),
    next_if_execute.out.to(handle_reset.in0),
    handle_reset.out.to(state_reg.data),
    halt_reg.q.to(set_halt.a, out.halted),
    inp.is_BRK.to(set_halt.b),
    set_halt.out.to(halt_value.in0),
    zero.out.to(halt_value.in1),
    halt_value.out.to(halt_reg.data),
    mem_read_sig.out.to(out.mem_read),
  ])
  .build()

const CPUControlTest = component('CPUControlTest')
  .out('current_state', bus(3))
  .out('cycle', bus(3))
  .out('pc_inc', bit)
  .out('mem_rd', bit)
  .out('mem_wr', bit)
  .out('alu_en', bit)
  .out('halted', bit)
  .node('fsm', CPUControl)
  .node('reset_input', Input)
  .node('cycles_input', Input)
  .node('brk_input', Input)
  .node('d_state', HexDisplay)
  .node('d_cycle', HexDisplay)
  .connect(({ in: inp, out, fsm, reset_input, cycles_input, brk_input, d_state, d_cycle }) => [
    reset_input.out.to(fsm.reset),
    cycles_input.out.to(fsm.instr_cycles),
    brk_input.out.to(fsm.is_BRK),
    fsm.current_state.to(out.current_state),
    fsm.cycle_num.to(out.cycle),
    fsm.pc_increment.to(out.pc_inc),
    fsm.mem_read.to(out.mem_rd),
    fsm.mem_write.to(out.mem_wr),
    fsm.alu_enable.to(out.alu_en),
    fsm.halted.to(out.halted),
    out.current_state.to(d_state.in),
    out.cycle.to(d_cycle.in),
  ])
  .build()
