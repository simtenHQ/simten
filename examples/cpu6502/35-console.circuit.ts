// Auto-generated from DSL

const ConsoleOutput = circuit('ConsoleOutput', {
  in: { addr_lo: bus(8), addr_hi: bus(8), data_in: bus(8), we: bit },
  out: { responds: bit, data_out: bus(8) },
  nodes: { f0: Constant, zero: Constant, hi_match: Comparator, lo_match: Comparator, addr_match: And, console_we: And, console: Console },
  nodeArgs: { f0: { value: 240 }, zero: { value: 0 } },
  connect: ({ in: inp, out, f0, zero, hi_match, lo_match, addr_match, console_we, console }) => [
    inp.addr_hi.to(hi_match.a),
    f0.out.to(hi_match.b),
    inp.addr_lo.to(lo_match.a),
    zero.out.to(lo_match.b, out.data_out),
    hi_match.eq.to(addr_match.a),
    lo_match.eq.to(addr_match.b),
    addr_match.out.to(out.responds, console_we.a),
    inp.we.to(console_we.b),
    inp.data_in.to(console.data),
    console_we.out.to(console.we),
  ],
})

const ConsoleOutputTest = circuit('ConsoleOutputTest', {
  nodes: { console_dev: ConsoleOutput, addr_lo_in: Input, addr_hi_in: Input, data_in: Input, we_in: Switch, d_responds: Led, d_data_out: HexDisplay },
  connect: ({ in: inp, out, console_dev, addr_lo_in, addr_hi_in, data_in, we_in, d_responds, d_data_out }) => [
    addr_lo_in.out.to(console_dev.addr_lo),
    addr_hi_in.out.to(console_dev.addr_hi),
    data_in.out.to(console_dev.data_in),
    we_in.out.to(console_dev.we),
    console_dev.responds.to(d_responds.in),
    console_dev.data_out.to(d_data_out.in),
  ],
})
