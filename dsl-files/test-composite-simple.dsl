// Simplest possible composite test
circuit PassThrough {
  input x: Bit
  output y: Bit

  impl {
    node n: Not
    connect x -> n.in
    connect n.out -> y
  }
}

circuit TestPassThrough {
  impl {
    node sw: Switch
    node pt: PassThrough
    node led: Led

    connect sw.out -> pt.x
    connect pt.y -> led.in
  }
}
