// Auto-generated from DSL

const SimpleArbiter2Port = component('SimpleArbiter2Port')
  .in('port0_ready', bit)
  .in('port1_ready', bit)
  .in('forwarder_done', bit)
  .out('grant_port', bus(8))
  .out('grant_valid', bit)
  .node('last_port', Register)
  .node('grant_port_reg', Register)
  .node('grant_valid_reg', Register)
  .node('ZERO', Input, { value: 0 })
  .node('ONE', Input, { value: 1 })
  .node('last_was_port0', Comparator)
  .node('last_was_port1', Comparator)
  .node('prefer_port1', And)
  .node('not_port1_ready', Not)
  .node('fallback_port0', And)
  .node('fallback_port0_ready', And)
  .node('prefer_port0', And)
  .node('not_port0_ready', Not)
  .node('fallback_port1', And)
  .node('fallback_port1_ready', And)
  .node('grant_port0_signal', Or)
  .node('grant_port1_signal', Or)
  .node('grant_valid_signal', Or)
  .node('grant_port_mux', Mux)
  .node('grant_valid_we', Input, { value: 1 })
  .node('grant_port_we', Input, { value: 1 })
  .node('next_last_port', Mux)
  .node('last_port_we', Input, { value: 1 })
  .node('last_port_display', HexDisplay)
  .connect(({ in: inp, out, last_port, grant_port_reg, grant_valid_reg, ZERO, ONE, last_was_port0, last_was_port1, prefer_port1, not_port1_ready, fallback_port0, fallback_port0_ready, prefer_port0, not_port0_ready, fallback_port1, fallback_port1_ready, grant_port0_signal, grant_port1_signal, grant_valid_signal, grant_port_mux, grant_valid_we, grant_port_we, next_last_port, last_port_we, last_port_display }) => [
    last_port.q.to(last_was_port0.a, last_was_port1.a, next_last_port.in0, last_port_display.in),
    ZERO.out.to(last_was_port0.b, grant_port_mux.in0),
    ONE.out.to(last_was_port1.b, grant_port_mux.in1),
    last_was_port0.eq.to(prefer_port1.a, fallback_port0.a),
    inp.port1_ready.to(prefer_port1.b, not_port1_ready.in, fallback_port1_ready.b),
    not_port1_ready.out.to(fallback_port0.b),
    fallback_port0.out.to(fallback_port0_ready.a),
    inp.port0_ready.to(fallback_port0_ready.b, prefer_port0.b, not_port0_ready.in),
    last_was_port1.eq.to(prefer_port0.a, fallback_port1.a),
    not_port0_ready.out.to(fallback_port1.b),
    fallback_port1.out.to(fallback_port1_ready.a),
    prefer_port0.out.to(grant_port0_signal.a),
    fallback_port0_ready.out.to(grant_port0_signal.b),
    prefer_port1.out.to(grant_port1_signal.a),
    fallback_port1_ready.out.to(grant_port1_signal.b),
    grant_port0_signal.out.to(grant_valid_signal.a),
    grant_port1_signal.out.to(grant_valid_signal.b, grant_port_mux.sel),
    grant_valid_signal.out.to(grant_valid_reg.data),
    grant_valid_we.out.to(grant_valid_reg.we),
    grant_port_mux.out.to(grant_port_reg.data),
    grant_port_we.out.to(grant_port_reg.we),
    grant_valid_reg.q.to(out.grant_valid),
    grant_port_reg.q.to(out.grant_port, next_last_port.in1),
    inp.forwarder_done.to(next_last_port.sel),
    next_last_port.out.to(last_port.data),
    last_port_we.out.to(last_port.we),
  ])
  .build()
