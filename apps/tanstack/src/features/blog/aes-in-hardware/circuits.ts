/**
 * Circuit definitions for the "AES in Hardware" blog post.
 *
 * Builds from SubBytes (ROM S-box lookup) through XTime (GF(2^8) ×2)
 * to MixColumns — the operation so complex Intel built it into the CPU.
 */

export interface BlogCircuit {
  name: string;
  description: string;
  displayCode: string;
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
/** S-box as a JSON object for nodeArgs init */
const AES_SBOX_INIT: Record<number, number> = {};
AES_SBOX.forEach((val, idx) => { AES_SBOX_INIT[idx] = val; });
const AES_SBOX_JSON = JSON.stringify(AES_SBOX_INIT);

// XTime and MixColumn sub-circuits shared across demos
const XTIME_CIRCUIT = `
const XTime = component('XTime', {
  in: { x: bus(8) },
  out: { out: bus(8) },
  nodes: { c1: Constant, shl: LeftShifter, split: Splitter8to8, poly: Constant, zero8: Constant, mux: Mux, xor: BusXor },
  nodeArgs: { c1: { value: 1, width: 8 }, shl: { width: 8 }, poly: { value: 27, width: 8 }, zero8: { value: 0, width: 8 }, mux: { width: 8 }, xor: { width: 8 } },
  connect: ({ in: inp, out, c1, shl, split, poly, zero8, mux, xor }) => [
    inp.x.to(shl.value, split.in),
    c1.out.to(shl.shift),
    zero8.out.to(mux.in0),
    poly.out.to(mux.in1),
    split.bit7.to(mux.sel),
    shl.result.to(xor.a),
    mux.out.to(xor.b),
    xor.out.to(out.out),
  ],
})
`;

const MIXCOLUMN_CIRCUIT = `
const MixColumn = component('MixColumn', {
  in: { s0: bus(8)).in('s1', bus(8)).in('s2', bus(8)).in('s3', bus(8) },
  out: { r0: bus(8)).out('r1', bus(8)).out('r2', bus(8)).out('r3', bus(8) },
  meta: { description: 'AES MixColumns on one 4-byte column over GF(2^8)' },
  connect: ({ in: inp, out, xt0, xt1, xt2, xt3, m3_0, m3_1, m3_2, m3_3, r0a, r0b, r0c, r1a, r1b, r1c, r2a, r2b, r2c, r3a, r3b, r3c }) => [
    inp.s0.to(xt0.x, m3_0.b, r1a.a, r2a.a),
    inp.s1.to(xt1.x, m3_1.b, r1a.b, r2a.b, r3a.b),
    inp.s2.to(xt2.x, m3_2.b, r0b.b, r3b.b),
    inp.s3.to(xt3.x, m3_3.b, r0c.b, r1c.b),
    xt0.out.to(m3_0.a, r0a.a),
    xt1.out.to(m3_1.a, r1a.b),
    xt2.out.to(m3_2.a, r2b.b),
    xt3.out.to(m3_3.a, r3c.b),
    m3_1.out.to(r0a.b),
    m3_2.out.to(r1b.b),
    m3_3.out.to(r2c.b),
    m3_0.out.to(r3a.a),
    r0a.out.to(r0b.a), r0b.out.to(r0c.a), r0c.out.to(out.r0),
    r1a.out.to(r1b.a), r1b.out.to(r1c.a), r1c.out.to(out.r1),
    r2a.out.to(r2b.a), r2b.out.to(r2c.a), r2c.out.to(out.r2),
    r3a.out.to(r3b.a), r3b.out.to(r3c.a), r3c.out.to(out.r3),
  ],
})
`;

export const AES_CIRCUITS: Record<string, BlogCircuit> = {
  // Demo 1: S-box lookup via ROM
  subByteDemo: {
    name: "SubBytes: S-Box Lookup",
    description:
      "Each byte is replaced via a 256-entry lookup table. Try 0x00 (→ 0x63), 0x53 (→ 0xed), or 0xff (→ 0x16). Pre-loaded with FIPS 197 S-box.",
    displayCode: `
const SubByteDemo = component('SubByteDemo', {
  nodes: { s: Input, rom: ROM, disp: HexDisplay },
  nodeArgs: { s: { value: 83, width: 8 }, disp: { width: 8 } },
  connect: ({ in: inp, out, s, rom, disp }) => [
    s.out.to(rom.addr),
    rom.data_out.to(disp.in),
  ],
})
`,
    dsl: `
const SubByteDemo = component('SubByteDemo', {
  nodes: { s: Input, rom: ROM, disp: HexDisplay },
  nodeArgs: { s: { value: 83, width: 8 }, rom: { init: ${AES_SBOX_JSON} }, disp: { width: 8 } },
  connect: ({ in: inp, out, s, rom, disp }) => [
    s.out.to(rom.addr),
    rom.data_out.to(disp.in),
  ],
})
`,
  },

  // Demo 2: XTime — GF(2^8) multiplication by 2
  xTimeDemo: {
    name: "XTime: Multiply by 2 in GF(2^8)",
    description:
      "Left-shift, then XOR with 0x1b if the MSB was 1. Try 87 (0x57 → 0xae), 128 (0x80 → 0x1b), or 149 (0x95 → 0x35).",
    displayCode: `
const XTime = component('XTime', {
  in: { x: bus(8) },
  out: { out: bus(8) },
  nodes: { c1: Constant, shl: LeftShifter, split: Splitter8to8, poly: Constant, zero8: Constant, mux: Mux, xor: BusXor },
  nodeArgs: { c1: { value: 1, width: 8 }, shl: { width: 8 }, poly: { value: 27, width: 8 }, zero8: { value: 0, width: 8 }, mux: { width: 8 }, xor: { width: 8 } },
  connect: ({ in: inp, out, c1, shl, split, poly, zero8, mux, xor }) => [
    inp.x.to(shl.value, split.in),
    c1.out.to(shl.shift),
    zero8.out.to(mux.in0),
    poly.out.to(mux.in1),
    split.bit7.to(mux.sel),
    shl.result.to(xor.a),
    mux.out.to(xor.b),
    xor.out.to(out.out),
  ],
})

const XTimeDemo = component('XTimeDemo', {
  nodes: { val: Input, xt: XTime, disp: HexDisplay },
  nodeArgs: { val: { value: 87, width: 8 }, disp: { width: 8 } },
  connect: ({ in: inp, out, val, xt, disp }) => [
    val.out.to(xt.x),
    xt.out.to(disp.in),
  ],
})
`,
    dsl: `${XTIME_CIRCUIT}

const XTimeDemo = component('XTimeDemo', {
  nodes: { val: Input, xt: XTime, disp: HexDisplay },
  nodeArgs: { val: { value: 87, width: 8 }, disp: { width: 8 } },
  connect: ({ val, xt, disp }) => [
    val.out.to(xt.x),
    xt.out.to(disp.in),
  ],
})
`,
  },

  // Demo 3: MixColumns on one column — FIPS 197 test vector
  mixColumnDemo: {
    name: "MixColumns: One Column",
    description:
      "FIPS 197 test vector: [0xdb, 0x13, 0x53, 0x45] → [0x8e, 0x4d, 0xa1, 0xbc]. Four bytes in, four bytes out, completely mixed.",
    displayCode: `// FIPS 197 MixColumns test vector:
//   In:  [0xdb, 0x13, 0x53, 0x45]
//   Out: [0x8e, 0x4d, 0xa1, 0xbc]

const MixColumnDemo = component('MixColumnDemo', {
  nodes: { s0: Input, s1: Input, s2: Input, s3: Input, mc: MixColumn, r0: HexDisplay, r1: HexDisplay, r2: HexDisplay, r3: HexDisplay },
  nodeArgs: { s0: { value: 219, width: 8 }, s1: { value: 19, width: 8 }, s2: { value: 83, width: 8 }, s3: { value: 69, width: 8 }, r0: { width: 8 }, r1: { width: 8 }, r2: { width: 8 }, r3: { width: 8 } },
  connect: ({ s0, s1, s2, s3, mc, r0, r1, r2, r3 }) => [
    s0.out.to(mc.s0), s1.out.to(mc.s1),
    s2.out.to(mc.s2), s3.out.to(mc.s3),
    mc.r0.to(r0.in), mc.r1.to(r1.in),
    mc.r2.to(r2.in), mc.r3.to(r3.in),
  ],
})`,
    dsl: `${XTIME_CIRCUIT}
${MIXCOLUMN_CIRCUIT}

const MixColumnDemo = component('MixColumnDemo', {
  nodes: { s0: Input, s1: Input, s2: Input, s3: Input, mc: MixColumn, r0: HexDisplay, r1: HexDisplay, r2: HexDisplay, r3: HexDisplay },
  nodeArgs: { s0: { value: 219, width: 8 }, s1: { value: 19, width: 8 }, s2: { value: 83, width: 8 }, s3: { value: 69, width: 8 }, r0: { width: 8 }, r1: { width: 8 }, r2: { width: 8 }, r3: { width: 8 } },
  connect: ({ s0, s1, s2, s3, mc, r0, r1, r2, r3 }) => [
    s0.out.to(mc.s0), s1.out.to(mc.s1),
    s2.out.to(mc.s2), s3.out.to(mc.s3),
    mc.r0.to(r0.in), mc.r1.to(r1.in),
    mc.r2.to(r2.in), mc.r3.to(r3.in),
  ],
})
`,
  },
};
