// Auto-generated from DSL

const ConsoleOutput = component('ConsoleOutput')
  .in('addr_lo', bus(8))
  .in('addr_hi', bus(8))
  .in('data_in', bus(8))
  .in('we', bit)
  .out('responds', bit)
  .out('data_out', bus(8))
  .node('f0', Constant, { value: 240 })
  .node('zero', Constant, { value: 0 })
  .node('hi_match', Comparator)
  .node('lo_match', Comparator)
  .node('addr_match', And)
  .node('console_we', And)
  .node('console', Console)
  .connect(({ in: inp, out, f0, zero, hi_match, lo_match, addr_match, console_we, console }) => [
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
  ])
  .build()

const ConsoleOutputTest = component('ConsoleOutputTest')
  .node('console_dev', ConsoleOutput)
  .node('addr_lo_in', Input)
  .node('addr_hi_in', Input)
  .node('data_in', Input)
  .node('we_in', Switch)
  .node('d_responds', Led)
  .node('d_data_out', HexDisplay)
  .connect(({ in: inp, out, console_dev, addr_lo_in, addr_hi_in, data_in, we_in, d_responds, d_data_out }) => [
    addr_lo_in.out.to(console_dev.addr_lo),
    addr_hi_in.out.to(console_dev.addr_hi),
    data_in.out.to(console_dev.data_in),
    we_in.out.to(console_dev.we),
    console_dev.responds.to(d_responds.in),
    console_dev.data_out.to(d_data_out.in),
  ])
  .build()
