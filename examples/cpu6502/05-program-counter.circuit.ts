// Auto-generated from DSL

const ProgramCounter = component('ProgramCounter')
  .in('load', bit)
  .in('load_addr_low', bus(8))
  .in('load_addr_high', bus(8))
  .in('increment', bit)
  .out('pc_low', bus(8))
  .out('pc_high', bus(8))
  .node('pcl_reg', Register)
  .node('pch_reg', Register)
  .node('inc_low', Incrementer)
  .node('max_byte', Constant, { value: 255 })
  .node('will_overflow', Comparator)
  .node('inc_high', Incrementer)
  .node('high_inc_mux', Mux)
  .node('low_load_or_inc', Mux)
  .node('low_final', Mux)
  .node('high_load_or_inc', Mux)
  .node('high_final', Mux)
  .node('always_on', Constant, { value: 1 })
  .connect(({ in: inp, out, pcl_reg, pch_reg, inc_low, max_byte, will_overflow, inc_high, high_inc_mux, low_load_or_inc, low_final, high_load_or_inc, high_final, always_on }) => [
    pcl_reg.q.to(inc_low.in, will_overflow.a, low_load_or_inc.in0, out.pc_low),
    max_byte.out.to(will_overflow.b),
    pch_reg.q.to(inc_high.in, high_inc_mux.in0, high_load_or_inc.in0, out.pc_high),
    will_overflow.eq.to(high_inc_mux.sel),
    inc_high.out.to(high_inc_mux.in1),
    inp.increment.to(low_load_or_inc.sel, high_load_or_inc.sel),
    inc_low.out.to(low_load_or_inc.in1),
    inp.load.to(low_final.sel, high_final.sel),
    low_load_or_inc.out.to(low_final.in0),
    inp.load_addr_low.to(low_final.in1),
    low_final.out.to(pcl_reg.data),
    high_inc_mux.out.to(high_load_or_inc.in1),
    high_load_or_inc.out.to(high_final.in0),
    inp.load_addr_high.to(high_final.in1),
    high_final.out.to(pch_reg.data),
    always_on.out.to(pcl_reg.we, pch_reg.we),
  ])
  .build()

const ProgramCounterTest = component('ProgramCounterTest')
  .out('pc_low', bus(8))
  .out('pc_high', bus(8))
  .node('pc_reg', ProgramCounter)
  .node('load_input', Input)
  .node('addr_low_input', Input)
  .node('addr_high_input', Input)
  .node('inc_input', Input)
  .node('display_low', HexDisplay)
  .node('display_high', HexDisplay)
  .connect(({ in: inp, out, pc_reg, load_input, addr_low_input, addr_high_input, inc_input, display_low, display_high }) => [
    load_input.out.to(pc_reg.load),
    addr_low_input.out.to(pc_reg.load_addr_low),
    addr_high_input.out.to(pc_reg.load_addr_high),
    inc_input.out.to(pc_reg.increment),
    pc_reg.pc_low.to(out.pc_low),
    pc_reg.pc_high.to(out.pc_high),
    out.pc_low.to(display_low.in),
    out.pc_high.to(display_high.in),
  ])
  .build()
