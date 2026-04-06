// Auto-generated from DSL

const BouncingBall1D = circuit('BouncingBall1D', {
  nodes: { position: Register, direction: DFlipFlop, posInc: Incrementer, posDec: Adder, negOne: Constant, posNext: Mux, zero: Constant, three: Constant, cmpZero: Comparator, cmpThree: Comparator, dirInv: Not, hitLeft: And, hitRight: And, shouldFlip: Or, flipDir: Xor, pos2bit: BitSlice, decoder: Decoder, led0: Led, led1: Led, led2: Led, led3: Led, enable: Constant },
  nodeArgs: { negOne: { value: 255 }, zero: { value: 0 }, three: { value: 3 }, pos2bit: { low: 0, high: 1 }, enable: { value: 1 } },
  connect: ({ in: inp, out, position, direction, posInc, posDec, negOne, posNext, zero, three, cmpZero, cmpThree, dirInv, hitLeft, hitRight, shouldFlip, flipDir, pos2bit, decoder, led0, led1, led2, led3, enable }) => [
    position.q.to(posInc.in, posDec.a, pos2bit.in),
    negOne.out.to(posDec.b),
    flipDir.out.to(posNext.sel, direction.d),
    posInc.out.to(posNext.in1),
    posDec.sum.to(posNext.in0),
    posNext.out.to(position.data),
    enable.out.to(position.we),
    pos2bit.out.to(cmpZero.a, cmpThree.a, decoder.in),
    zero.out.to(cmpZero.b),
    three.out.to(cmpThree.b),
    direction.q.to(dirInv.in, hitRight.b, flipDir.a),
    cmpZero.eq.to(hitLeft.a),
    dirInv.out.to(hitLeft.b),
    cmpThree.eq.to(hitRight.a),
    hitLeft.out.to(shouldFlip.a),
    hitRight.out.to(shouldFlip.b),
    shouldFlip.out.to(flipDir.b),
    decoder.out0.to(led0.in),
    decoder.out1.to(led1.in),
    decoder.out2.to(led2.in),
    decoder.out3.to(led3.in),
  ],
})
