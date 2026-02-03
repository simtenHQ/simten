// Minimal hierarchical test

circuit SimpleChild {
  input a: Bit
  clock clk
  output b: Bit

  impl {
    node reg1: Register
    connect a -> reg1.data
    node we: Switch
    connect we.out -> reg1.we
    connect reg1.q -> b
  }
}

circuit Parent {
  impl {
    node in1: Input
    node child: SimpleChild
    connect in1.out -> child.a

    node led: Led
    connect child.b -> led.in
  }
}
