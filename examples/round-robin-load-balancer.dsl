// Round-Robin Load Balancer Demo
// Shows the load balancer distributing to 8 LEDs in sequence



// Round-Robin Load Balancer - 8 Servers
// Cycles through servers: 0->1->2->3->4->5->6->7->0

circuit RoundRobinLoadBalancer {
  output server0: Bit
  output server1: Bit
  output server2: Bit
  output server3: Bit
  output server4: Bit
  output server5: Bit
  output server6: Bit
  output server7: Bit

  clock clk

  impl {
    // 3-bit counter (counts 0-7)
    node counter: Register
    node always_write: Constant(value=1)

    // Increment logic
    node adder: Adder
    node one: Constant(value=1)
    connect counter.q -> adder.a
    connect one.out -> adder.b

    // Wrap at 8
    node at_eight: Comparator
    node eight: Constant(value=8)
    node zero: Constant(value=0)
    connect adder.sum -> at_eight.a
    connect eight.out -> at_eight.b

    node wrap_mux: Mux
    connect at_eight.eq -> wrap_mux.sel
    connect adder.sum -> wrap_mux.in0
    connect zero.out -> wrap_mux.in1

    connect wrap_mux.out -> counter.data
    connect always_write.out -> counter.we
    connect clk -> counter.clk

    // Decode counter to 8 outputs
    node cmp0: Comparator
    connect counter.q -> cmp0.a
    connect zero.out -> cmp0.b
    connect cmp0.eq -> server0

    node cmp1: Comparator
    connect counter.q -> cmp1.a
    connect one.out -> cmp1.b
    connect cmp1.eq -> server1

    node cmp2: Comparator
    node two: Constant(value=2)
    connect counter.q -> cmp2.a
    connect two.out -> cmp2.b
    connect cmp2.eq -> server2

    node cmp3: Comparator
    node three: Constant(value=3)
    connect counter.q -> cmp3.a
    connect three.out -> cmp3.b
    connect cmp3.eq -> server3

    node cmp4: Comparator
    node four: Constant(value=4)
    connect counter.q -> cmp4.a
    connect four.out -> cmp4.b
    connect cmp4.eq -> server4

    node cmp5: Comparator
    node five: Constant(value=5)
    connect counter.q -> cmp5.a
    connect five.out -> cmp5.b
    connect cmp5.eq -> server5

    node cmp6: Comparator
    node six: Constant(value=6)
    connect counter.q -> cmp6.a
    connect six.out -> cmp6.b
    connect cmp6.eq -> server6

    node cmp7: Comparator
    node seven: Constant(value=7)
    connect counter.q -> cmp7.a
    connect seven.out -> cmp7.b
    connect cmp7.eq -> server7
  }
}

circuit RoundRobinDemo {


  clock clk

  impl {

  node led0: Led
  node led1: Led
  node led2: Led
  node led3: Led
  node led4: Led
  node led5: Led
  node led6: Led
  node led7: Led

    // The load balancer
    node balancer: RoundRobinLoadBalancer
    connect clk -> balancer.clk

    // Connect load balancer outputs to LEDs
    connect balancer.server0 -> led0.in
    connect balancer.server1 -> led1.in
    connect balancer.server2 -> led2.in
    connect balancer.server3 -> led3.in
    connect balancer.server4 -> led4.in
    connect balancer.server5 -> led5.in
    connect balancer.server6 -> led6.in
    connect balancer.server7 -> led7.in
  }
}