// Auto-generated from DSL

const BouncingBall1D = component('BouncingBall1D')
  .node('position', Register)
  .node('direction', DFlipFlop)
  .node('posInc', Incrementer)
  .node('posDec', Adder)
  .node('negOne', Constant, { value: 255 })
  .node('posNext', Mux)
  .node('zero', Constant, { value: 0 })
  .node('three', Constant, { value: 3 })
  .node('cmpZero', Comparator)
  .node('cmpThree', Comparator)
  .node('dirInv', Not)
  .node('hitLeft', And)
  .node('hitRight', And)
  .node('shouldFlip', Or)
  .node('flipDir', Xor)
  .node('pos2bit', BitSlice, { low: 0, high: 1 })
  .node('decoder', Decoder)
  .node('led0', Led)
  .node('led1', Led)
  .node('led2', Led)
  .node('led3', Led)
  .node('enable', Constant, { value: 1 })
  .connect(({ in: inp, out, position, direction, posInc, posDec, negOne, posNext, zero, three, cmpZero, cmpThree, dirInv, hitLeft, hitRight, shouldFlip, flipDir, pos2bit, decoder, led0, led1, led2, led3, enable }) => [
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
  ])
  .build()
