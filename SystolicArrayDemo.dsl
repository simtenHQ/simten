// Systolic Array Matrix Multiplication Demo
// Computes: [1 2; 3 4] × [5 6; 7 8] = [19 22; 43 50]

circuit SystolicArrayDemo {
  clock clk

  impl {
    // === Systolic Array ===
    node matmul: SystolicArray2x2

    // === Matrix A Inputs (data) ===
    node a00: Input(value=1)
    node a01: Input(value=2)
    node a10: Input(value=3)
    node a11: Input(value=4)

    // === Matrix B Inputs (weights) ===
    node b00: Input(value=5)
    node b01: Input(value=6)
    node b10: Input(value=7)
    node b11: Input(value=8)

    // === Control ===
    node loadWeights: Switch  // Use Switch so you can toggle it

    // === Connect Matrix A ===
    connect a00.out -> matmul.a00
    connect a01.out -> matmul.a01
    connect a10.out -> matmul.a10
    connect a11.out -> matmul.a11

    // === Connect Matrix B ===
    connect b00.out -> matmul.b00
    connect b01.out -> matmul.b01
    connect b10.out -> matmul.b10
    connect b11.out -> matmul.b11

    // === Connect Control ===
    connect loadWeights.out -> matmul.loadWeights
    connect clk -> matmul.clk

    // === Output Displays (to observe results) ===
    // HexDisplay shows the actual numeric value in hexadecimal
    node display_c00: HexDisplay
    node display_c01: HexDisplay
    node display_c10: HexDisplay
    node display_c11: HexDisplay

    connect matmul.c00 -> display_c00.in
    connect matmul.c01 -> display_c01.in
    connect matmul.c10 -> display_c10.in
    connect matmul.c11 -> display_c11.in
  }
}
