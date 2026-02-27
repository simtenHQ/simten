// Rule 30 Cellular Automaton
//
// Stephen Wolfram's famous Rule 30 — the simplest known source of
// cryptographic-grade pseudorandomness. One rule applied to 8 cells
// in a ring produces chaotic, non-repeating patterns.
//
// The rule: next = left XOR (center OR right)
// That's it. Two gates per cell. Turing complete.
//
// Seed one cell in the middle, watch chaos emerge.

circuit Rule30Cell {
  description "Single Rule 30 cell: next = left XOR (center OR right)"
  input left: Bit
  input center: Bit
  input right: Bit
  output next: Bit
  impl {
    node or1: Or
    node xor1: Xor
    connect center -> or1.a
    connect right -> or1.b
    connect left -> xor1.a
    connect or1.out -> xor1.b
    connect xor1.out -> next
  }
}

circuit Rule30 {
  description "Rule 30 cellular automaton — 8 cells in a ring, chaos from a single seed"
  clock clk
  impl {
    // 8 cells, each a D flip-flop
    node c0: DFlipFlop
    node c1: DFlipFlop
    node c2: DFlipFlop
    node c3: DFlipFlop
    node c4: DFlipFlop
    node c5: DFlipFlop
    node c6: DFlipFlop
    node c7: DFlipFlop

    // Rule 30 logic for each cell
    node r0: Rule30Cell
    node r1: Rule30Cell
    node r2: Rule30Cell
    node r3: Rule30Cell
    node r4: Rule30Cell
    node r5: Rule30Cell
    node r6: Rule30Cell
    node r7: Rule30Cell

    // Seed trick: cell 4 starts ON, all others OFF
    node one: Constant(value=1)
    node init: DFlipFlop
    connect one.out -> init.d

    // First tick: mux selects seed (1). After: mux selects rule output.
    node mux4: Mux
    connect one.out -> mux4.in0
    connect r4.next -> mux4.in1
    connect init.q -> mux4.sel
    connect mux4.out -> c4.d

    // Toroidal connections — each cell sees its neighbors, wrapping at edges
    connect c7.q -> r0.left
    connect c0.q -> r0.center
    connect c1.q -> r0.right
    connect r0.next -> c0.d

    connect c0.q -> r1.left
    connect c1.q -> r1.center
    connect c2.q -> r1.right
    connect r1.next -> c1.d

    connect c1.q -> r2.left
    connect c2.q -> r2.center
    connect c3.q -> r2.right
    connect r2.next -> c2.d

    connect c2.q -> r3.left
    connect c3.q -> r3.center
    connect c4.q -> r3.right
    connect r3.next -> c3.d

    connect c3.q -> r4.left
    connect c4.q -> r4.center
    connect c5.q -> r4.right
    // r4.next routed through mux4 above

    connect c4.q -> r5.left
    connect c5.q -> r5.center
    connect c6.q -> r5.right
    connect r5.next -> c5.d

    connect c5.q -> r6.left
    connect c6.q -> r6.center
    connect c7.q -> r6.right
    connect r6.next -> c6.d

    connect c6.q -> r7.left
    connect c7.q -> r7.center
    connect c0.q -> r7.right
    connect r7.next -> c7.d

    // 8 LEDs showing the current state
    node led0: Led
    node led1: Led
    node led2: Led
    node led3: Led
    node led4: Led
    node led5: Led
    node led6: Led
    node led7: Led
    connect c0.q -> led0.in
    connect c1.q -> led1.in
    connect c2.q -> led2.in
    connect c3.q -> led3.in
    connect c4.q -> led4.in
    connect c5.q -> led5.in
    connect c6.q -> led6.in
    connect c7.q -> led7.in

    // Hex display of the pattern as a number
    node combine: Combiner8to8
    connect c0.q -> combine.bit0
    connect c1.q -> combine.bit1
    connect c2.q -> combine.bit2
    connect c3.q -> combine.bit3
    connect c4.q -> combine.bit4
    connect c5.q -> combine.bit5
    connect c6.q -> combine.bit6
    connect c7.q -> combine.bit7

    node display: HexDisplay
    connect combine.out -> display.in
  }
}
