// Auto-generated from DSL

const RoundRobinLoadBalancer = component('RoundRobinLoadBalancer')
  .out('server0', bit)
  .out('server1', bit)
  .out('server2', bit)
  .out('server3', bit)
  .out('server4', bit)
  .out('server5', bit)
  .out('server6', bit)
  .out('server7', bit)
  .node('counter', Register)
  .node('always_write', Constant, { value: 1 })
  .node('adder', Adder)
  .node('one', Constant, { value: 1 })
  .node('at_eight', Comparator)
  .node('eight', Constant, { value: 8 })
  .node('zero', Constant, { value: 0 })
  .node('wrap_mux', Mux)
  .node('cmp0', Comparator)
  .node('cmp1', Comparator)
  .node('cmp2', Comparator)
  .node('two', Constant, { value: 2 })
  .node('cmp3', Comparator)
  .node('three', Constant, { value: 3 })
  .node('cmp4', Comparator)
  .node('four', Constant, { value: 4 })
  .node('cmp5', Comparator)
  .node('five', Constant, { value: 5 })
  .node('cmp6', Comparator)
  .node('six', Constant, { value: 6 })
  .node('cmp7', Comparator)
  .node('seven', Constant, { value: 7 })
  .connect(({ in: inp, out, counter, always_write, adder, one, at_eight, eight, zero, wrap_mux, cmp0, cmp1, cmp2, two, cmp3, three, cmp4, four, cmp5, five, cmp6, six, cmp7, seven }) => [
    counter.q.to(adder.a, cmp0.a, cmp1.a, cmp2.a, cmp3.a, cmp4.a, cmp5.a, cmp6.a, cmp7.a),
    one.out.to(adder.b, cmp1.b),
    adder.sum.to(at_eight.a, wrap_mux.in0),
    eight.out.to(at_eight.b),
    at_eight.eq.to(wrap_mux.sel),
    zero.out.to(wrap_mux.in1, cmp0.b),
    wrap_mux.out.to(counter.data),
    always_write.out.to(counter.we),
    cmp0.eq.to(out.server0),
    cmp1.eq.to(out.server1),
    two.out.to(cmp2.b),
    cmp2.eq.to(out.server2),
    three.out.to(cmp3.b),
    cmp3.eq.to(out.server3),
    four.out.to(cmp4.b),
    cmp4.eq.to(out.server4),
    five.out.to(cmp5.b),
    cmp5.eq.to(out.server5),
    six.out.to(cmp6.b),
    cmp6.eq.to(out.server6),
    seven.out.to(cmp7.b),
    cmp7.eq.to(out.server7),
  ])
  .build()

const RoundRobinDemo = component('RoundRobinDemo')
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('led4', Led)
  .node('led5', Led)
  .node('led6', Led)
  .node('led7', Led)
  .node('balancer', RoundRobinLoadBalancer)
  .connect(({ in: inp, out, led0, led1, led2, led3, led4, led5, led6, led7, balancer }) => [
    balancer.server0.to(led0.in),
    balancer.server1.to(led1.in),
    balancer.server2.to(led2.in),
    balancer.server3.to(led3.in),
    balancer.server4.to(led4.in),
    balancer.server5.to(led5.in),
    balancer.server6.to(led6.in),
    balancer.server7.to(led7.in),
  ])
  .build()
