// Auto-generated from DSL

const PacketForwarder2Port = component('PacketForwarder2Port')
  .in('grant_port', bus(8))
  .in('grant_valid', bit)
  .in('port0_read_ptr', bus(8))
  .in('port1_read_ptr', bus(8))
  .out('ingress_addr', bus(8))
  .out('ingress_re', bit)
  .out('egress_addr', bus(8))
  .out('egress_we', bit)
  .out('done', bit)
  .out('output_port', bus(8))
  .out('ingress_port', bus(8))
  .node('fsm_state', Register)
  .node('byte_counter', Register)
  .node('output_port_reg', Register)
  .node('ingress_port_reg', Register)
  .node('done_reg', Register)
  .node('STATE_IDLE', Input, { value: 0 })
  .node('STATE_READ_HEADER', Input, { value: 1 })
  .node('STATE_WAIT_HEADER', Input, { value: 2 })
  .node('STATE_ROUTE', Input, { value: 3 })
  .node('STATE_COPY_PAYLOAD', Input, { value: 4 })
  .node('STATE_DONE', Input, { value: 5 })
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('SEVEN', Input, { value: 7 })
  .node('EIGHT', Input, { value: 8 })
  .node('DA_MASK', Input, { value: 240 })
  .node('DA_SHIFT', Input, { value: 4 })
  .node('isIDLE', Comparator)
  .node('isREAD_HEADER', Comparator)
  .node('isWAIT_HEADER', Comparator)
  .node('isROUTE', Comparator)
  .node('isCOPY_PAYLOAD', Comparator)
  .node('isDONE', Comparator)
  .node('idle_to_read', And)
  .node('read_to_wait', And)
  .node('wait_to_route', And)
  .node('byte_is_seven', Comparator)
  .node('copy_complete', And)
  .node('done_to_idle', And)
  .node('next_state_m5', Mux)
  .node('next_state_m4', Mux)
  .node('next_state_m3', Mux)
  .node('next_state_m2', Mux)
  .node('next_state_m1', Mux)
  .node('route_to_copy', And)
  .node('next_state', Mux)
  .node('fsm_state_we', Input, { value: 1 })
  .node('latch_ingress_port', And)
  .node('next_ingress_port_val', Mux)
  .node('ingress_port_reg_we', Input, { value: 1 })
  .node('byte_inc', Adder)
  .node('should_increment', And)
  .node('should_reset', And)
  .node('next_byte_counter_inc', Mux)
  .node('next_byte_counter', Mux)
  .node('byte_counter_we', Input, { value: 1 })
  .node('ingress_is_port0', Comparator)
  .node('selected_read_ptr', Mux)
  .node('ingress_addr_calc', Adder)
  .node('cross_route', Adder)
  .node('neg_ingress', Adder)
  .node('MINUS_ONE', Input, { value: 255 })
  .node('latch_output_port', And)
  .node('next_output_port_val', Mux)
  .node('output_port_reg_we', Input, { value: 1 })
  .node('port_offset', LeftShifter)
  .node('THREE', Input, { value: 3 })
  .node('egress_addr_calc', Adder)
  .node('ingress_re_signal', Or)
  .node('done_we', Input, { value: 1 })
  .node('fsm_state_display', HexDisplay)
  .node('byte_counter_display', HexDisplay)
  .node('output_port_debug', HexDisplay)
  .node('ingress_port_debug', HexDisplay)
  .connect(({ in: inp, out, fsm_state, byte_counter, output_port_reg, ingress_port_reg, done_reg, STATE_IDLE, STATE_READ_HEADER, STATE_WAIT_HEADER, STATE_ROUTE, STATE_COPY_PAYLOAD, STATE_DONE, ZERO, ONE, SEVEN, EIGHT, DA_MASK, DA_SHIFT, isIDLE, isREAD_HEADER, isWAIT_HEADER, isROUTE, isCOPY_PAYLOAD, isDONE, idle_to_read, read_to_wait, wait_to_route, byte_is_seven, copy_complete, done_to_idle, next_state_m5, next_state_m4, next_state_m3, next_state_m2, next_state_m1, route_to_copy, next_state, fsm_state_we, latch_ingress_port, next_ingress_port_val, ingress_port_reg_we, byte_inc, should_increment, should_reset, next_byte_counter_inc, next_byte_counter, byte_counter_we, ingress_is_port0, selected_read_ptr, ingress_addr_calc, cross_route, neg_ingress, MINUS_ONE, latch_output_port, next_output_port_val, output_port_reg_we, port_offset, THREE, egress_addr_calc, ingress_re_signal, done_we, fsm_state_display, byte_counter_display, output_port_debug, ingress_port_debug }) => [
    fsm_state.q.to(isIDLE.a, isREAD_HEADER.a, isWAIT_HEADER.a, isROUTE.a, isCOPY_PAYLOAD.a, isDONE.a, next_state_m5.in0, fsm_state_display.in),
    STATE_IDLE.out.to(isIDLE.b, next_state_m5.in1),
    STATE_READ_HEADER.out.to(isREAD_HEADER.b, next_state_m1.in1),
    STATE_WAIT_HEADER.out.to(isWAIT_HEADER.b, next_state_m2.in1),
    STATE_ROUTE.out.to(isROUTE.b, next_state_m3.in1),
    STATE_COPY_PAYLOAD.out.to(isCOPY_PAYLOAD.b, next_state.in1),
    STATE_DONE.out.to(isDONE.b, next_state_m4.in1),
    isIDLE.eq.to(idle_to_read.a),
    inp.grant_valid.to(idle_to_read.b),
    isREAD_HEADER.eq.to(read_to_wait.a, read_to_wait.b, ingress_re_signal.a),
    isWAIT_HEADER.eq.to(wait_to_route.a, wait_to_route.b),
    byte_counter.q.to(byte_is_seven.a, byte_inc.a, next_byte_counter_inc.in0, ingress_addr_calc.b, egress_addr_calc.b, byte_counter_display.in),
    SEVEN.out.to(byte_is_seven.b),
    isCOPY_PAYLOAD.eq.to(copy_complete.a, should_increment.a, should_increment.b, ingress_re_signal.b, out.egress_we),
    byte_is_seven.eq.to(copy_complete.b),
    isDONE.eq.to(done_to_idle.a, done_to_idle.b, done_reg.data),
    done_to_idle.out.to(next_state_m5.sel),
    next_state_m5.out.to(next_state_m4.in0),
    copy_complete.out.to(next_state_m4.sel),
    next_state_m4.out.to(next_state_m3.in0),
    wait_to_route.out.to(next_state_m3.sel, latch_output_port.a, latch_output_port.b),
    next_state_m3.out.to(next_state_m2.in0),
    read_to_wait.out.to(next_state_m2.sel),
    next_state_m2.out.to(next_state_m1.in0),
    idle_to_read.out.to(next_state_m1.sel, latch_ingress_port.a, latch_ingress_port.b, should_reset.a, should_reset.b),
    isROUTE.eq.to(route_to_copy.a, route_to_copy.b),
    next_state_m1.out.to(next_state.in0),
    route_to_copy.out.to(next_state.sel),
    next_state.out.to(fsm_state.data),
    fsm_state_we.out.to(fsm_state.we),
    ingress_port_reg.q.to(next_ingress_port_val.in0, ingress_is_port0.a, neg_ingress.a, out.ingress_port, ingress_port_debug.in),
    inp.grant_port.to(next_ingress_port_val.in1),
    latch_ingress_port.out.to(next_ingress_port_val.sel),
    next_ingress_port_val.out.to(ingress_port_reg.data),
    ingress_port_reg_we.out.to(ingress_port_reg.we),
    ONE.out.to(byte_inc.b, cross_route.a),
    byte_inc.sum.to(next_byte_counter_inc.in1),
    should_increment.out.to(next_byte_counter_inc.sel),
    next_byte_counter_inc.out.to(next_byte_counter.in0),
    ZERO.out.to(next_byte_counter.in1, ingress_is_port0.b),
    should_reset.out.to(next_byte_counter.sel),
    next_byte_counter.out.to(byte_counter.data),
    byte_counter_we.out.to(byte_counter.we),
    inp.port1_read_ptr.to(selected_read_ptr.in0),
    inp.port0_read_ptr.to(selected_read_ptr.in1),
    ingress_is_port0.eq.to(selected_read_ptr.sel),
    selected_read_ptr.out.to(ingress_addr_calc.a),
    MINUS_ONE.out.to(neg_ingress.b),
    neg_ingress.sum.to(cross_route.b),
    output_port_reg.q.to(next_output_port_val.in0, port_offset.value, out.output_port, output_port_debug.in),
    cross_route.sum.to(next_output_port_val.in1),
    latch_output_port.out.to(next_output_port_val.sel),
    next_output_port_val.out.to(output_port_reg.data),
    output_port_reg_we.out.to(output_port_reg.we),
    THREE.out.to(port_offset.shift),
    port_offset.result.to(egress_addr_calc.a),
    ingress_addr_calc.sum.to(out.ingress_addr),
    egress_addr_calc.sum.to(out.egress_addr),
    ingress_re_signal.out.to(out.ingress_re),
    done_we.out.to(done_reg.we),
    done_reg.q.to(out.done),
  ])
  .build()
