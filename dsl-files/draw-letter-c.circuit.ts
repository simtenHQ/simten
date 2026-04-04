// Auto-generated from DSL

const DrawLetterC = component('DrawLetterC')
  .node('fb1', DualPortRAM)
  .node('fb2', DualPortRAM)
  .node('display', Screen)
  .node('bufferSelect', DFlipFlop)
  .node('readDataMux', Mux)
  .node('pixelIndex', Register, { initial: 0 })
  .node('drawing', DFlipFlop, { initial: 1 })
  .node('done', DFlipFlop, { initial: 0 })
  .node('addr0', Constant, { value: 10 })
  .node('addr1', Constant, { value: 11 })
  .node('addr2', Constant, { value: 12 })
  .node('addr3', Constant, { value: 13 })
  .node('addr4', Constant, { value: 17 })
  .node('addr5', Constant, { value: 22 })
  .node('addr6', Constant, { value: 24 })
  .node('addr7', Constant, { value: 32 })
  .node('addr8', Constant, { value: 41 })
  .node('addr9', Constant, { value: 46 })
  .node('addr10', Constant, { value: 50 })
  .node('addr11', Constant, { value: 51 })
  .node('zero', Constant, { value: 0 })
  .node('one', Constant, { value: 1 })
  .node('twelve', Constant, { value: 12 })
  .node('mux0', Mux)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('mux8', Mux)
  .node('mux9', Mux)
  .node('mux10', Mux)
  .node('bit0', BitSlice, { low: 0, high: 0 })
  .node('bit1', BitSlice, { low: 1, high: 1 })
  .node('bit2', BitSlice, { low: 2, high: 2 })
  .node('bit3', BitSlice, { low: 3, high: 3 })
  .node('checkDone', Comparator)
  .node('isDone', Not)
  .node('shouldSetDone', And)
  .node('notDone', Not)
  .node('keepDrawing', And)
  .node('indexInc', Incrementer)
  .node('shouldIncrement', And)
  .node('swapBuffers', Xor)
  .node('writeEnable1', Mux)
  .node('writeEnable2', Mux)
  .node('statusDisplay', HexDisplay)
  .node('doneLed', Led)
  .connect(({ in: inp, out, fb1, fb2, display, bufferSelect, readDataMux, pixelIndex, drawing, done, addr0, addr1, addr2, addr3, addr4, addr5, addr6, addr7, addr8, addr9, addr10, addr11, zero, one, twelve, mux0, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, bit0, bit1, bit2, bit3, checkDone, isDone, shouldSetDone, notDone, keepDrawing, indexInc, shouldIncrement, swapBuffers, writeEnable1, writeEnable2, statusDisplay, doneLed }) => [
    pixelIndex.q.to(bit0.in, bit1.in, bit2.in, bit3.in, checkDone.a, indexInc.in, statusDisplay.in),
    bit0.out.to(mux0.sel, mux1.sel, mux2.sel, mux3.sel, mux4.sel, mux5.sel),
    addr0.out.to(mux0.in0),
    addr1.out.to(mux0.in1),
    addr2.out.to(mux1.in0),
    addr3.out.to(mux1.in1),
    addr4.out.to(mux2.in0),
    addr5.out.to(mux2.in1),
    addr6.out.to(mux3.in0),
    addr7.out.to(mux3.in1),
    addr8.out.to(mux4.in0),
    addr9.out.to(mux4.in1),
    addr10.out.to(mux5.in0),
    addr11.out.to(mux5.in1),
    bit1.out.to(mux6.sel, mux7.sel, mux8.sel),
    mux0.out.to(mux6.in0),
    mux1.out.to(mux6.in1),
    mux2.out.to(mux7.in0),
    mux3.out.to(mux7.in1),
    mux4.out.to(mux8.in0),
    mux5.out.to(mux8.in1),
    bit2.out.to(mux9.sel),
    mux6.out.to(mux9.in0),
    mux7.out.to(mux9.in1),
    bit3.out.to(mux10.sel),
    mux9.out.to(mux10.in0),
    mux8.out.to(mux10.in1),
    twelve.out.to(checkDone.b),
    checkDone.lt.to(isDone.in),
    isDone.out.to(shouldSetDone.a),
    drawing.q.to(shouldSetDone.b, keepDrawing.a, shouldIncrement.a),
    shouldSetDone.out.to(done.d, swapBuffers.b),
    done.q.to(notDone.in, doneLed.in),
    notDone.out.to(keepDrawing.b, shouldIncrement.b),
    keepDrawing.out.to(drawing.d),
    indexInc.out.to(pixelIndex.data),
    shouldIncrement.out.to(pixelIndex.we, writeEnable1.in1, writeEnable2.in0),
    bufferSelect.q.to(swapBuffers.a, writeEnable1.sel, writeEnable2.sel, readDataMux.sel),
    swapBuffers.out.to(bufferSelect.d),
    mux10.out.to(fb1.addrA, fb2.addrA),
    one.out.to(fb1.dataA, fb2.dataA),
    zero.out.to(writeEnable1.in0, writeEnable2.in1),
    writeEnable1.out.to(fb1.weA),
    writeEnable2.out.to(fb2.weA),
    display.addrB.to(fb1.addrB, fb2.addrB),
    fb1.outB.to(readDataMux.in0),
    fb2.outB.to(readDataMux.in1),
    readDataMux.out.to(display.dataIn),
  ])
  .build()
