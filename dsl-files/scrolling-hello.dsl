circuit ScrollingHello {
  impl {
    // Bitmap ROM containing "HELLO " with gaps
    // Each letter is 3px wide with 1px gap = 4px per letter × 5 = 20px
    node bitmap: ROM(data=[
      // Row 0 - Top of letters
      1,0,1,0, 1,1,1,0, 1,0,0,0, 1,0,0,0, 0,1,0,0, 0,0,0,0,
      // Row 1
      1,0,1,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,0,0,
      // Row 2 - Middle crossbar
      1,1,1,0, 1,1,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,0,0,
      // Row 3
      1,0,1,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0, 0,0,0,0,
      // Row 4 - Bottom
      1,0,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0, 0,1,0,0, 0,0,0,0,
      // Rows 5-7 (blank)
      0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
      0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
      0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0
    ])

    // Scroll offset (0-23, wraps around)
    node scrollOffset: Register

    // DEBUG: Display scroll offset
    node debugScroll: HexDisplay

    // Render position
    node renderAddr: Register
    node renderInc: Incrementer
    node sixtythree: Constant(value=63)
    node renderDone: Comparator
    node renderNext: Mux
    node zero: Constant(value=0)

    // Extract X and Y
    node renderX: BitSlice(low=0, high=2)
    node renderY: BitSlice(low=3, high=5)

    // Scroll increment and wrap
    node scrollInc: Incrementer
    node twentythree: Constant(value=23)
    node scrollWrap: Comparator
    node scrollWrapped: Mux

    // Calculate bitmap address: Y * 24 + (scrollOffset + X) % 24
    node twentyfour: Constant(value=24)
    node yTimes24: Multiplier
    node scrollPlusX: Adder
    node xOffset: BitSlice(low=0, high=4)  // Lower 5 bits
    node bitmapAddr: Adder

    // Framebuffer
    node fb: DualPortRAM
    node display: Screen

    // Write enable
    node enable: Constant(value=1)

    // ==== Scroll offset (increment every 64 cycles = once per frame) ====
    connect scrollOffset.q -> scrollInc.in
    connect scrollInc.out -> scrollWrap.a
    connect twentythree.out -> scrollWrap.b

    // Wrap to 0 when scrollInc > 23
    connect scrollWrap.gt -> scrollWrapped.sel
    connect scrollInc.out -> scrollWrapped.in0
    connect zero.out -> scrollWrapped.in1

    connect scrollWrapped.out -> scrollOffset.data
    connect renderDone.eq -> scrollOffset.we  // Update at end of each frame

    // ==== Debug display ====
    connect scrollOffset.q -> debugScroll.in

    // ==== Render counter ====
    connect renderAddr.q -> renderInc.in
    connect renderAddr.q -> renderDone.a
    connect sixtythree.out -> renderDone.b

    connect renderDone.eq -> renderNext.sel
    connect renderInc.out -> renderNext.in0
    connect zero.out -> renderNext.in1

    connect renderNext.out -> renderAddr.data
    connect enable.out -> renderAddr.we

    // ==== Extract X and Y ====
    connect renderAddr.q -> renderX.in
    connect renderAddr.q -> renderY.in

    // ==== Calculate bitmap address ====
    connect renderY.out -> yTimes24.a
    connect twentyfour.out -> yTimes24.b

    connect scrollOffset.q -> scrollPlusX.a
    connect renderX.out -> scrollPlusX.b
    connect scrollPlusX.sum -> xOffset.in

    connect yTimes24.product -> bitmapAddr.a
    connect xOffset.out -> bitmapAddr.b

    // ==== Read pixel from bitmap ====
    connect bitmapAddr.sum -> bitmap.addr

    // ==== Write to framebuffer ====
    connect renderAddr.q -> fb.addrA
    connect bitmap.data_out -> fb.dataA
    connect enable.out -> fb.weA

    // ==== Display ====
    connect display.addrB -> fb.addrB
    connect fb.outB -> display.dataIn
  }
}
