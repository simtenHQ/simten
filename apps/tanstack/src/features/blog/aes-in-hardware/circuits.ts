/**
 * Circuit definitions for the "AES in Hardware" blog post.
 *
 * Builds from SubBytes (ROM S-box lookup) through XTime (GF(2^8) ×2)
 * to MixColumns — the operation so complex Intel built it into the CPU.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayDsl: string;
  dsl: string;
}

// FIPS 197, Figure 7 — the AES forward S-box
export const AES_SBOX: number[] = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

// Pre-loaded ROM memory for SubBytes lookups
export const AES_SBOX_MEMORY: Map<string, Map<number, number>> = (() => {
  const sboxMap = new Map<number, number>();
  AES_SBOX.forEach((val, idx) => sboxMap.set(idx, val));
  return new Map([["ROM", sboxMap]]);
})();

// XTime and MixColumn sub-circuits shared across demos
const XTIME_CIRCUIT = `
circuit XTime {
  description "GF(2^8) multiply by 2: shift left, XOR 0x1b if MSB was set"
  input x: Bus[8]
  output out: Bus[8]
  impl {
    // Shift left by 1
    node c1: Constant(value=1, width=8)
    node shl: LeftShifter(width=8)
    connect x -> shl.value
    connect c1.out -> shl.shift

    // Extract bit 7 (MSB) to decide on polynomial reduction
    node split: Splitter8to8
    connect x -> split.in

    // If bit7 was set, XOR with 0x1b (the AES irreducible polynomial)
    node poly: Constant(value=27, width=8)
    node zero8: Constant(value=0, width=8)
    node mux: Mux(width=8)
    connect zero8.out -> mux.in0
    connect poly.out -> mux.in1
    connect split.bit7 -> mux.sel

    node xor: BusXor(width=8)
    connect shl.result -> xor.a
    connect mux.out -> xor.b
    connect xor.out -> out
  }
}`;

const MIXCOLUMN_CIRCUIT = `
circuit MixColumn {
  description "AES MixColumns on one 4-byte column over GF(2^8)"
  input s0: Bus[8]
  input s1: Bus[8]
  input s2: Bus[8]
  input s3: Bus[8]
  output r0: Bus[8]
  output r1: Bus[8]
  output r2: Bus[8]
  output r3: Bus[8]
  impl {
    // 2*si = XTime(si)
    node xt0: XTime
    node xt1: XTime
    node xt2: XTime
    node xt3: XTime
    connect s0 -> xt0.x
    connect s1 -> xt1.x
    connect s2 -> xt2.x
    connect s3 -> xt3.x

    // 3*si = XTime(si) XOR si
    node m3_0: BusXor(width=8)
    node m3_1: BusXor(width=8)
    node m3_2: BusXor(width=8)
    node m3_3: BusXor(width=8)
    connect xt0.out -> m3_0.a
    connect s0 -> m3_0.b
    connect xt1.out -> m3_1.a
    connect s1 -> m3_1.b
    connect xt2.out -> m3_2.a
    connect s2 -> m3_2.b
    connect xt3.out -> m3_3.a
    connect s3 -> m3_3.b

    // r0 = 2*s0 XOR 3*s1 XOR s2 XOR s3
    node r0a: BusXor(width=8)
    node r0b: BusXor(width=8)
    node r0c: BusXor(width=8)
    connect xt0.out -> r0a.a
    connect m3_1.out -> r0a.b
    connect r0a.out -> r0b.a
    connect s2 -> r0b.b
    connect r0b.out -> r0c.a
    connect s3 -> r0c.b
    connect r0c.out -> r0

    // r1 = s0 XOR 2*s1 XOR 3*s2 XOR s3
    node r1a: BusXor(width=8)
    node r1b: BusXor(width=8)
    node r1c: BusXor(width=8)
    connect s0 -> r1a.a
    connect xt1.out -> r1a.b
    connect r1a.out -> r1b.a
    connect m3_2.out -> r1b.b
    connect r1b.out -> r1c.a
    connect s3 -> r1c.b
    connect r1c.out -> r1

    // r2 = s0 XOR s1 XOR 2*s2 XOR 3*s3
    node r2a: BusXor(width=8)
    node r2b: BusXor(width=8)
    node r2c: BusXor(width=8)
    connect s0 -> r2a.a
    connect s1 -> r2a.b
    connect r2a.out -> r2b.a
    connect xt2.out -> r2b.b
    connect r2b.out -> r2c.a
    connect m3_3.out -> r2c.b
    connect r2c.out -> r2

    // r3 = 3*s0 XOR s1 XOR s2 XOR 2*s3
    node r3a: BusXor(width=8)
    node r3b: BusXor(width=8)
    node r3c: BusXor(width=8)
    connect m3_0.out -> r3a.a
    connect s1 -> r3a.b
    connect r3a.out -> r3b.a
    connect s2 -> r3b.b
    connect r3b.out -> r3c.a
    connect xt3.out -> r3c.b
    connect r3c.out -> r3
  }
}`;

export const AES_CIRCUITS: Record<string, BlogCircuit> = {
  // Demo 1: S-box lookup via ROM
  subByteDemo: {
    name: "SubBytes: S-Box Lookup",
    description:
      "Each byte is replaced via a 256-entry lookup table. Try 0x00 (→ 0x63), 0x53 (→ 0xed), or 0xff (→ 0x16). Pre-loaded with FIPS 197 S-box.",
    displayDsl: `// FIPS 197 AES S-box lookup
// S[0x00]=0x63  S[0x53]=0xed  S[0xff]=0x16

circuit SubByteDemo {
  impl {
    node s: Input(value=83, width=8)
    node rom: ROM
    connect s.out -> rom.addr
    node disp: HexDisplay(width=8)
    connect rom.data_out -> disp.in
  }
}`,
    dsl: `circuit SubByteDemo {
  impl {
    node s: Input(value=83, width=8)
    node rom: ROM
    connect s.out -> rom.addr
    node disp: HexDisplay(width=8)
    connect rom.data_out -> disp.in
  }
}`,
  },

  // Demo 2: XTime — GF(2^8) multiplication by 2
  xTimeDemo: {
    name: "XTime: Multiply by 2 in GF(2^8)",
    description:
      "Left-shift, then XOR with 0x1b if the MSB was 1. Try 87 (0x57 → 0xae), 128 (0x80 → 0x1b), or 149 (0x95 → 0x35).",
    displayDsl: `circuit XTime {
  input x: Bus[8]
  output out: Bus[8]
  impl {
    // Shift left by 1
    node c1: Constant(value=1, width=8)
    node shl: LeftShifter(width=8)
    connect x -> shl.value
    connect c1.out -> shl.shift

    // If bit7 was set, XOR with 0x1b
    node split: Splitter8to8
    connect x -> split.in

    node poly: Constant(value=27, width=8)
    node zero8: Constant(value=0, width=8)
    node mux: Mux(width=8)
    connect zero8.out -> mux.in0
    connect poly.out -> mux.in1
    connect split.bit7 -> mux.sel

    node xor: BusXor(width=8)
    connect shl.result -> xor.a
    connect mux.out -> xor.b
    connect xor.out -> out
  }
}

circuit XTimeDemo {
  impl {
    node val: Input(value=87, width=8)
    node xt: XTime
    connect val.out -> xt.x
    node disp: HexDisplay(width=8)
    connect xt.out -> disp.in
  }
}`,
    dsl: `${XTIME_CIRCUIT}

circuit XTimeDemo {
  impl {
    node val: Input(value=87, width=8)
    node xt: XTime
    connect val.out -> xt.x
    node disp: HexDisplay(width=8)
    connect xt.out -> disp.in
  }
}`,
  },

  // Demo 3: MixColumns on one column — FIPS 197 test vector
  mixColumnDemo: {
    name: "MixColumns: One Column",
    description:
      "FIPS 197 test vector: [0xdb, 0x13, 0x53, 0x45] → [0x8e, 0x4d, 0xa1, 0xbc]. Four bytes in, four bytes out, completely mixed.",
    displayDsl: `// FIPS 197 MixColumns test vector:
//   In:  [0xdb, 0x13, 0x53, 0x45]
//   Out: [0x8e, 0x4d, 0xa1, 0xbc]

circuit MixColumnDemo {
  impl {
    node s0: Input(value=219, width=8)
    node s1: Input(value=19, width=8)
    node s2: Input(value=83, width=8)
    node s3: Input(value=69, width=8)

    node mc: MixColumn
    connect s0.out -> mc.s0
    connect s1.out -> mc.s1
    connect s2.out -> mc.s2
    connect s3.out -> mc.s3

    node r0: HexDisplay(width=8)
    node r1: HexDisplay(width=8)
    node r2: HexDisplay(width=8)
    node r3: HexDisplay(width=8)
    connect mc.r0 -> r0.in
    connect mc.r1 -> r1.in
    connect mc.r2 -> r2.in
    connect mc.r3 -> r3.in
  }
}`,
    dsl: `${XTIME_CIRCUIT}
${MIXCOLUMN_CIRCUIT}

circuit MixColumnDemo {
  impl {
    // FIPS 197 test vector: [db,13,53,45] → [8e,4d,a1,bc]
    node s0: Input(value=219, width=8)
    node s1: Input(value=19, width=8)
    node s2: Input(value=83, width=8)
    node s3: Input(value=69, width=8)

    node mc: MixColumn
    connect s0.out -> mc.s0
    connect s1.out -> mc.s1
    connect s2.out -> mc.s2
    connect s3.out -> mc.s3

    node r0: HexDisplay(width=8)
    node r1: HexDisplay(width=8)
    node r2: HexDisplay(width=8)
    node r3: HexDisplay(width=8)
    connect mc.r0 -> r0.in
    connect mc.r1 -> r1.in
    connect mc.r2 -> r2.in
    connect mc.r3 -> r3.in
  }
}`,
  },
};
