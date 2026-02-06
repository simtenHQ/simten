// Inner composite - two D flip-flops in series (2-stage delay)
circuit BitRegister {
  input data: Bit
  output q: Bit

  impl {
    node ff1: DFlipFlop
    node ff2: DFlipFlop
    connect data -> ff1.d
    connect ff1.q -> ff2.d
    connect ff2.q -> q
  }
}

// Outer composite - wraps the flip-flop
circuit WrappedRegister {
  input data: Bit
  output q: Bit

  impl {
    node inner: BitRegister
    connect data -> inner.data
    connect inner.q -> q
  }
}

// Test circuit
circuit TestNestedSequential {
  impl {
    node data_sw: Switch
    node wrapped: WrappedRegister
    node led: Led

    connect data_sw.out -> wrapped.data
    connect wrapped.q -> led.in
  }
}
