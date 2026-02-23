// Test if half adder works with direct primitives first
circuit DirectTest {
  impl {
    node sw1: Switch
    node sw2: Switch
    node xor1: Xor
    node and1: And
    node led1: Led
    node led2: Led

    // Direct connections - no composite
    connect sw1.out -> xor1.a
    connect sw2.out -> xor1.b
    connect xor1.out -> led1.in

    connect sw1.out -> and1.a
    connect sw2.out -> and1.b
    connect and1.out -> led2.in
  }
}

// Half adder as composite
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}

// Test with composite
circuit CompositeTest {
  impl {
    node sw1: Switch
    node sw2: Switch
    node ha: HalfAdder
    node led1: Led
    node led2: Led

    connect sw1.out -> ha.a
    connect sw2.out -> ha.b
    connect ha.sum -> led1.in
    connect ha.carry -> led2.in
  }
}
