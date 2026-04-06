// Auto-generated from DSL

const HalfAdder = circuit('HalfAdder', {
  in: { a: bit, b: bit },
  out: { sum: bit, carry: bit },
  meta: { description: "Half adder built entirely from NAND gates" },
  nodes: { nand1: Nand, nand2: Nand, nand3: Nand, nand4: Nand, nand5: Nand },
  connect: ({ in: inp, out, nand1, nand2, nand3, nand4, nand5 }) => [
    inp.a.to(nand1.a, nand2.a),
    inp.b.to(nand1.b, nand3.b),
    nand1.out.to(nand2.b, nand3.a, nand5.a, nand5.b),
    nand2.out.to(nand4.a),
    nand3.out.to(nand4.b),
    nand4.out.to(out.sum),
    nand5.out.to(out.carry),
  ],
})

const FullAdder = circuit('FullAdder', {
  in: { a: bit, b: bit, cin: bit },
  out: { sum: bit, cout: bit },
  meta: { description: "Full adder from two NAND-only half adders and a NAND OR gate" },
  nodes: { ha1: HalfAdder, ha2: HalfAdder, nand_c1: Nand, nand_c2: Nand, nand_or: Nand },
  connect: ({ in: inp, out, ha1, ha2, nand_c1, nand_c2, nand_or }) => [
    inp.a.to(ha1.a),
    inp.b.to(ha1.b),
    ha1.sum.to(ha2.a),
    inp.cin.to(ha2.b),
    ha2.sum.to(out.sum),
    ha1.carry.to(nand_c1.a, nand_c1.b),
    ha2.carry.to(nand_c2.a, nand_c2.b),
    nand_c1.out.to(nand_or.a),
    nand_c2.out.to(nand_or.b),
    nand_or.out.to(out.cout),
  ],
})

const FullAdderDemo = circuit('FullAdderDemo', {
  meta: { description: "Interactive full adder demo with drill-down" },
  nodes: { sw_a: Switch, sw_b: Switch, sw_cin: Switch, led_sum: Led, led_cout: Led, fa: FullAdder },
  connect: ({ in: inp, out, sw_a, sw_b, sw_cin, led_sum, led_cout, fa }) => [
    sw_a.out.to(fa.a),
    sw_b.out.to(fa.b),
    sw_cin.out.to(fa.cin),
    fa.sum.to(led_sum.in),
    fa.cout.to(led_cout.in),
  ],
})
