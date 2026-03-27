// ChaCha20 Quarter-Round — The Core of TLS Encryption
//
// Every HTTPS connection you make likely uses ChaCha20-Poly1305.
// Cloudflare serves over 20% of the internet's traffic through it.
//
// The entire cipher is built from just three operations on 32-bit words:
//   ADD   (modular addition)
//   XOR   (bitwise exclusive-or)
//   ROTL  (left bit-rotation)
//
// This "ARX" pattern repeats four times per quarter-round:
//
//   a += b;  d ^= a;  d <<<= 16;
//   c += d;  b ^= c;  b <<<= 12;
//   a += b;  d ^= a;  d <<<= 8;
//   c += d;  b ^= c;  b <<<= 7;
//
// A full ChaCha20 block is 80 quarter-rounds (20 rounds x 4 QRs each),
// applied to a 4x4 matrix of 32-bit words. This circuit implements one QR.
//
// Test vector from RFC 7539 section 2.1.1:
//   In:  a=0x11111111  b=0x01020304  c=0x9b8d6f43  d=0x01234567
//   Out: a=0xea2a92f4  b=0xcb1cf8ce  c=0x4581472e  d=0x5881c4bb

// Rotate left by N: (value << N) | (value >> (32-N))
// In real silicon this is pure rewiring — zero gate delay.
// Here we use shifters + OR to stay within 32-bit bus primitives.

circuit RotateLeft16 {
  description "32-bit left rotation by 16 bits"
  input x: Bus[32]
  output out: Bus[32]
  impl {
    node sh_left: LeftShifter(width=32)
    node sh_right: RightShifter(width=32)
    node c16: Constant(value=16, width=32)
    node combine: BusOr(width=32)

    connect x -> sh_left.value
    connect c16.out -> sh_left.shift
    connect x -> sh_right.value
    connect c16.out -> sh_right.shift

    connect sh_left.result -> combine.a
    connect sh_right.result -> combine.b
    connect combine.out -> out
  }
}

circuit RotateLeft12 {
  description "32-bit left rotation by 12 bits"
  input x: Bus[32]
  output out: Bus[32]
  impl {
    node sh_left: LeftShifter(width=32)
    node sh_right: RightShifter(width=32)
    node c12: Constant(value=12, width=32)
    node c20: Constant(value=20, width=32)
    node combine: BusOr(width=32)

    connect x -> sh_left.value
    connect c12.out -> sh_left.shift
    connect x -> sh_right.value
    connect c20.out -> sh_right.shift

    connect sh_left.result -> combine.a
    connect sh_right.result -> combine.b
    connect combine.out -> out
  }
}

circuit RotateLeft8 {
  description "32-bit left rotation by 8 bits"
  input x: Bus[32]
  output out: Bus[32]
  impl {
    node sh_left: LeftShifter(width=32)
    node sh_right: RightShifter(width=32)
    node c8: Constant(value=8, width=32)
    node c24: Constant(value=24, width=32)
    node combine: BusOr(width=32)

    connect x -> sh_left.value
    connect c8.out -> sh_left.shift
    connect x -> sh_right.value
    connect c24.out -> sh_right.shift

    connect sh_left.result -> combine.a
    connect sh_right.result -> combine.b
    connect combine.out -> out
  }
}

circuit RotateLeft7 {
  description "32-bit left rotation by 7 bits"
  input x: Bus[32]
  output out: Bus[32]
  impl {
    node sh_left: LeftShifter(width=32)
    node sh_right: RightShifter(width=32)
    node c7: Constant(value=7, width=32)
    node c25: Constant(value=25, width=32)
    node combine: BusOr(width=32)

    connect x -> sh_left.value
    connect c7.out -> sh_left.shift
    connect x -> sh_right.value
    connect c25.out -> sh_right.shift

    connect sh_left.result -> combine.a
    connect sh_right.result -> combine.b
    connect combine.out -> out
  }
}

circuit ChaCha20QuarterRound {
  description "ChaCha20 quarter-round: 4 ARX steps on 32-bit words (ADD, XOR, ROTL)"
  input a: Bus[32]
  input b: Bus[32]
  input c: Bus[32]
  input d: Bus[32]
  output a_out: Bus[32]
  output b_out: Bus[32]
  output c_out: Bus[32]
  output d_out: Bus[32]
  impl {
    node gnd: Constant(value=0)

    // =====================================================================
    // Step 1:  a += b;  d ^= a;  d <<<= 16
    // =====================================================================

    node add1: Adder(width=32)
    connect a -> add1.a
    connect b -> add1.b
    connect gnd.out -> add1.carry_in

    node xor1: BusXor(width=32)
    connect d -> xor1.a
    connect add1.sum -> xor1.b

    node rot16: RotateLeft16
    connect xor1.out -> rot16.x

    // =====================================================================
    // Step 2:  c += d;  b ^= c;  b <<<= 12
    // =====================================================================

    node add2: Adder(width=32)
    connect c -> add2.a
    connect rot16.out -> add2.b
    connect gnd.out -> add2.carry_in

    node xor2: BusXor(width=32)
    connect b -> xor2.a
    connect add2.sum -> xor2.b

    node rot12: RotateLeft12
    connect xor2.out -> rot12.x

    // =====================================================================
    // Step 3:  a += b;  d ^= a;  d <<<= 8
    // =====================================================================

    node add3: Adder(width=32)
    connect add1.sum -> add3.a
    connect rot12.out -> add3.b
    connect gnd.out -> add3.carry_in

    node xor3: BusXor(width=32)
    connect rot16.out -> xor3.a
    connect add3.sum -> xor3.b

    node rot8: RotateLeft8
    connect xor3.out -> rot8.x

    // =====================================================================
    // Step 4:  c += d;  b ^= c;  b <<<= 7
    // =====================================================================

    node add4: Adder(width=32)
    connect add2.sum -> add4.a
    connect rot8.out -> add4.b
    connect gnd.out -> add4.carry_in

    node xor4: BusXor(width=32)
    connect rot12.out -> xor4.a
    connect add4.sum -> xor4.b

    node rot7: RotateLeft7
    connect xor4.out -> rot7.x

    // =====================================================================
    // Outputs
    // =====================================================================

    connect add3.sum -> a_out
    connect rot7.out -> b_out
    connect add4.sum -> c_out
    connect rot8.out -> d_out
  }
}

// Interactive demo with RFC 7539 test vector.
// Change the inputs and watch the quarter-round transform them in real time.

circuit ChaCha20Demo {
  description "Interactive ChaCha20 quarter-round — RFC 7539 test vector, live hex display"
  impl {
    // --- Inputs (RFC 7539 section 2.1.1 test vector) ---
    node in_a: Input(value=0x11111111, width=32)
    node in_b: Input(value=0x01020304, width=32)
    node in_c: Input(value=0x9b8d6f43, width=32)
    node in_d: Input(value=0x01234567, width=32)

    // --- Quarter-round ---
    node qr: ChaCha20QuarterRound
    connect in_a.out -> qr.a
    connect in_b.out -> qr.b
    connect in_c.out -> qr.c
    connect in_d.out -> qr.d

    // --- Input displays ---
    node disp_in_a: HexDisplay(width=32)
    node disp_in_b: HexDisplay(width=32)
    node disp_in_c: HexDisplay(width=32)
    node disp_in_d: HexDisplay(width=32)
    connect in_a.out -> disp_in_a.in
    connect in_b.out -> disp_in_b.in
    connect in_c.out -> disp_in_c.in
    connect in_d.out -> disp_in_d.in

    // --- Output displays ---
    // Expected: a=0xea2a92f4, b=0xcb1cf8ce, c=0x4581472e, d=0x5881c4bb
    node disp_out_a: HexDisplay(width=32)
    node disp_out_b: HexDisplay(width=32)
    node disp_out_c: HexDisplay(width=32)
    node disp_out_d: HexDisplay(width=32)
    connect qr.a_out -> disp_out_a.in
    connect qr.b_out -> disp_out_b.in
    connect qr.c_out -> disp_out_c.in
    connect qr.d_out -> disp_out_d.in
  }
}
