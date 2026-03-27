/**
 * Circuit definitions for the "ChaCha20 in Hardware" blog post.
 *
 * Builds from the three ARX primitives (ADD, XOR, ROTL) up to the
 * full quarter-round that powers TLS encryption across the internet.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

// Shared rotation sub-circuits used by the quarter-round and step demos
const ROTATE_CIRCUITS = `
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
}`;

const QUARTER_ROUND_CIRCUIT = `
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

    // Step 1:  a += b;  d ^= a;  d <<<= 16
    node add1: Adder(width=32)
    connect a -> add1.a
    connect b -> add1.b
    connect gnd.out -> add1.carry_in

    node xor1: BusXor(width=32)
    connect d -> xor1.a
    connect add1.sum -> xor1.b

    node rot16: RotateLeft16
    connect xor1.out -> rot16.x

    // Step 2:  c += d;  b ^= c;  b <<<= 12
    node add2: Adder(width=32)
    connect c -> add2.a
    connect rot16.out -> add2.b
    connect gnd.out -> add2.carry_in

    node xor2: BusXor(width=32)
    connect b -> xor2.a
    connect add2.sum -> xor2.b

    node rot12: RotateLeft12
    connect xor2.out -> rot12.x

    // Step 3:  a += b;  d ^= a;  d <<<= 8
    node add3: Adder(width=32)
    connect add1.sum -> add3.a
    connect rot12.out -> add3.b
    connect gnd.out -> add3.carry_in

    node xor3: BusXor(width=32)
    connect rot16.out -> xor3.a
    connect add3.sum -> xor3.b

    node rot8: RotateLeft8
    connect xor3.out -> rot8.x

    // Step 4:  c += d;  b ^= c;  b <<<= 7
    node add4: Adder(width=32)
    connect add2.sum -> add4.a
    connect rot8.out -> add4.b
    connect gnd.out -> add4.carry_in

    node xor4: BusXor(width=32)
    connect rot12.out -> xor4.a
    connect add4.sum -> xor4.b

    node rot7: RotateLeft7
    connect xor4.out -> rot7.x

    // Outputs
    connect add3.sum -> a_out
    connect rot7.out -> b_out
    connect add4.sum -> c_out
    connect rot8.out -> d_out
  }
}`;

export const CHACHA20_CIRCUITS: Record<string, BlogCircuit> = {
  // Demo 1: The three ARX operations side by side
  arxDemo: {
    name: "The Three Operations: ADD, XOR, ROTL",
    description:
      "The entire ChaCha20 cipher is built from just these three operations on 32-bit words. Try changing a and b.",
    displayDsl: `circuit ARXDemo {
  impl {
    node a: Input(value=100, width=32)
    node b: Input(value=42, width=32)

    // ADD: modular addition
    node gnd: Constant(value=0)
    node add: Adder(width=32)
    connect a.out -> add.a
    connect b.out -> add.b
    connect gnd.out -> add.carry_in
    node sum: HexDisplay(width=32)
    connect add.sum -> sum.in

    // XOR: bitwise exclusive-or
    node xor: BusXor(width=32)
    connect a.out -> xor.a
    connect b.out -> xor.b
    node xor_out: HexDisplay(width=32)
    connect xor.out -> xor_out.in
  }
}`,
    dsl: `circuit ARXDemo {
  impl {
    node a: Input(value=100, width=32)
    node b: Input(value=42, width=32)

    // ADD: modular addition
    node gnd: Constant(value=0)
    node add: Adder(width=32)
    connect a.out -> add.a
    connect b.out -> add.b
    connect gnd.out -> add.carry_in
    node sum: HexDisplay(width=32)
    connect add.sum -> sum.in

    // XOR: bitwise exclusive-or
    node xor: BusXor(width=32)
    connect a.out -> xor.a
    connect b.out -> xor.b
    node xor_out: HexDisplay(width=32)
    connect xor.out -> xor_out.in
  }
}`,
  },

  // Demo 2: Rotation — the "free" operation
  rotateDemo: {
    name: "Rotation: The Free Operation",
    description:
      "Left rotation rearranges bits with zero gate delay. In silicon, it's just rewiring.",
    displayDsl: `circuit RotateDemo {
  impl {
    // Try val=1 to watch a single bit travel through positions
    node val: Input(value=1, width=32)

    node rot16: RotateLeft16
    connect val.out -> rot16.x
    node disp16: HexDisplay(width=32)
    connect rot16.out -> disp16.in

    node rot7: RotateLeft7
    connect val.out -> rot7.x
    node disp7: HexDisplay(width=32)
    connect rot7.out -> disp7.in
  }
}`,
    dsl: `${ROTATE_CIRCUITS}
circuit RotateDemo {
  impl {
    // Try val=1 to watch a single bit travel through positions
    node val: Input(value=1, width=32)

    node rot16: RotateLeft16
    connect val.out -> rot16.x
    node disp16: HexDisplay(width=32)
    connect rot16.out -> disp16.in

    node rot7: RotateLeft7
    connect val.out -> rot7.x
    node disp7: HexDisplay(width=32)
    connect rot7.out -> disp7.in
  }
}`,
  },

  // Demo 3: One ARX step (a += b; d ^= a; d <<<= 16)
  arxStep: {
    name: "One ARX Step: ADD, XOR, Rotate",
    description:
      "Each of the 4 steps in a quarter-round chains ADD → XOR → ROTL.",
    displayDsl: `circuit ARXStep {
  impl {
    node a: Input(value=100, width=32)
    node b: Input(value=42, width=32)
    node d: Input(value=255, width=32)

    // a += b
    node gnd: Constant(value=0)
    node add: Adder(width=32)
    connect a.out -> add.a
    connect b.out -> add.b
    connect gnd.out -> add.carry_in

    // d ^= a
    node xor: BusXor(width=32)
    connect d.out -> xor.a
    connect add.sum -> xor.b

    // d <<<= 16
    node rot: RotateLeft16
    connect xor.out -> rot.x

    node disp_a: HexDisplay(width=32)
    connect add.sum -> disp_a.in
    node disp_d: HexDisplay(width=32)
    connect rot.out -> disp_d.in
  }
}`,
    dsl: `${ROTATE_CIRCUITS}
circuit ARXStep {
  impl {
    node a: Input(value=100, width=32)
    node b: Input(value=42, width=32)
    node d: Input(value=255, width=32)

    // a += b
    node gnd: Constant(value=0)
    node add: Adder(width=32)
    connect a.out -> add.a
    connect b.out -> add.b
    connect gnd.out -> add.carry_in

    // d ^= a
    node xor: BusXor(width=32)
    connect d.out -> xor.a
    connect add.sum -> xor.b

    // d <<<= 16
    node rot: RotateLeft16
    connect xor.out -> rot.x

    node disp_a: HexDisplay(width=32)
    connect add.sum -> disp_a.in
    node disp_d: HexDisplay(width=32)
    connect rot.out -> disp_d.in
  }
}`,
  },

  // Demo 4: The full quarter-round with RFC test vector
  quarterRound: {
    name: "ChaCha20 Quarter-Round",
    description:
      "The complete quarter-round — 4 chained ARX steps. Verified against RFC 7539 test vector.",
    displayDsl: `// RFC 7539 test vector:
//   In:  a=0x11111111  b=0x01020304
//        c=0x9b8d6f43  d=0x01234567
//   Out: a=0xea2a92f4  b=0xcb1cf8ce
//        c=0x4581472e  d=0x5881c4bb

circuit ChaCha20Demo {
  impl {
    node in_a: Input(value=0x11111111, width=32)
    node in_b: Input(value=0x01020304, width=32)
    node in_c: Input(value=0x9b8d6f43, width=32)
    node in_d: Input(value=0x01234567, width=32)

    node qr: ChaCha20QuarterRound
    connect in_a.out -> qr.a
    connect in_b.out -> qr.b
    connect in_c.out -> qr.c
    connect in_d.out -> qr.d

    node out_a: HexDisplay(width=32)
    node out_b: HexDisplay(width=32)
    node out_c: HexDisplay(width=32)
    node out_d: HexDisplay(width=32)
    connect qr.a_out -> out_a.in
    connect qr.b_out -> out_b.in
    connect qr.c_out -> out_c.in
    connect qr.d_out -> out_d.in
  }
}`,
    dsl: `${ROTATE_CIRCUITS}
${QUARTER_ROUND_CIRCUIT}

circuit ChaCha20Demo {
  impl {
    node in_a: Input(value=0x11111111, width=32)
    node in_b: Input(value=0x01020304, width=32)
    node in_c: Input(value=0x9b8d6f43, width=32)
    node in_d: Input(value=0x01234567, width=32)

    node qr: ChaCha20QuarterRound
    connect in_a.out -> qr.a
    connect in_b.out -> qr.b
    connect in_c.out -> qr.c
    connect in_d.out -> qr.d

    node out_a: HexDisplay(width=32)
    node out_b: HexDisplay(width=32)
    node out_c: HexDisplay(width=32)
    node out_d: HexDisplay(width=32)
    connect qr.a_out -> out_a.in
    connect qr.b_out -> out_b.in
    connect qr.c_out -> out_c.in
    connect qr.d_out -> out_d.in
  }
}`,
  },
};
