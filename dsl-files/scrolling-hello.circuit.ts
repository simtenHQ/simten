// Auto-generated from DSL

const ScrollingHello = component('ScrollingHello')
  .node('bitmap', ROM, { data: [1,0,1,0,1,1,1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,1,1,0,1,1,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] })
  .node('scrollOffset', Register)
  .node('debugScroll', HexDisplay)
  .node('renderAddr', Register)
  .node('renderInc', Incrementer)
  .node('sixtythree', Constant, { value: 63 })
  .node('renderDone', Comparator)
  .node('renderNext', Mux)
  .node('zero', Constant, { value: 0 })
  .node('renderX', BitSlice, { low: 0, high: 2 })
  .node('renderY', BitSlice, { low: 3, high: 5 })
  .node('scrollInc', Incrementer)
  .node('twentythree', Constant, { value: 23 })
  .node('scrollWrap', Comparator)
  .node('scrollWrapped', Mux)
  .node('twentyfour', Constant, { value: 24 })
  .node('yTimes24', Multiplier)
  .node('scrollPlusX', Adder)
  .node('xOffset', BitSlice, { low: 0, high: 4 })
  .node('bitmapAddr', Adder)
  .node('fb', DualPortRAM)
  .node('display', Screen)
  .node('enable', Constant, { value: 1 })
  .connect(({ in: inp, out, bitmap, scrollOffset, debugScroll, renderAddr, renderInc, sixtythree, renderDone, renderNext, zero, renderX, renderY, scrollInc, twentythree, scrollWrap, scrollWrapped, twentyfour, yTimes24, scrollPlusX, xOffset, bitmapAddr, fb, display, enable }) => [
    scrollOffset.q.to(scrollInc.in, debugScroll.in, scrollPlusX.a),
    scrollInc.out.to(scrollWrap.a, scrollWrapped.in0),
    twentythree.out.to(scrollWrap.b),
    scrollWrap.gt.to(scrollWrapped.sel),
    zero.out.to(scrollWrapped.in1, renderNext.in1),
    scrollWrapped.out.to(scrollOffset.data),
    renderDone.eq.to(scrollOffset.we, renderNext.sel),
    renderAddr.q.to(renderInc.in, renderDone.a, renderX.in, renderY.in, fb.addrA),
    sixtythree.out.to(renderDone.b),
    renderInc.out.to(renderNext.in0),
    renderNext.out.to(renderAddr.data),
    enable.out.to(renderAddr.we, fb.weA),
    renderY.out.to(yTimes24.a),
    twentyfour.out.to(yTimes24.b),
    renderX.out.to(scrollPlusX.b),
    scrollPlusX.sum.to(xOffset.in),
    yTimes24.product.to(bitmapAddr.a),
    xOffset.out.to(bitmapAddr.b),
    bitmapAddr.sum.to(bitmap.addr),
    bitmap.data_out.to(fb.dataA),
    display.addrB.to(fb.addrB),
    fb.outB.to(display.dataIn),
  ])
  .build()
