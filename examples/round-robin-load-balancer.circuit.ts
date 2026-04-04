// Auto-generated from DSL

const RoundRobinLoadBalancer = component('RoundRobinLoadBalancer', {
  out: { server0: bit, server1: bit, server2: bit, server3: bit, server4: bit, server5: bit, server6: bit, server7: bit },
  nodes: { counter: Register, always_write: Constant, adder: Adder, one: Constant, at_eight: Comparator, eight: Constant, zero: Constant, wrap_mux: Mux, cmp0: Comparator, cmp1: Comparator, cmp2: Comparator, two: Constant, cmp3: Comparator, three: Constant, cmp4: Comparator, four: Constant, cmp5: Comparator, five: Constant, cmp6: Comparator, six: Constant, cmp7: Comparator, seven: Constant },
  nodeArgs: { always_write: { value: 1 }, one: { value: 1 }, eight: { value: 8 }, zero: { value: 0 }, two: { value: 2 }, three: { value: 3 }, four: { value: 4 }, five: { value: 5 }, six: { value: 6 }, seven: { value: 7 } },
  connect: ({ in: inp, out, counter, always_write, adder, one, at_eight, eight, zero, wrap_mux, cmp0, cmp1, cmp2, two, cmp3, three, cmp4, four, cmp5, five, cmp6, six, cmp7, seven }) => [
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
  ],
})

const RoundRobinDemo = component('RoundRobinDemo', {
  nodes: { led0: Led, led1: Led, led2: Led, led3: Led, led4: Led, led5: Led, led6: Led, led7: Led, balancer: RoundRobinLoadBalancer },
  connect: ({ in: inp, out, led0, led1, led2, led3, led4, led5, led6, led7, balancer }) => [
    balancer.server0.to(led0.in),
    balancer.server1.to(led1.in),
    balancer.server2.to(led2.in),
    balancer.server3.to(led3.in),
    balancer.server4.to(led4.in),
    balancer.server5.to(led5.in),
    balancer.server6.to(led6.in),
    balancer.server7.to(led7.in),
  ],
})
