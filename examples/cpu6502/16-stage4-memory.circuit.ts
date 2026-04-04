// Auto-generated from DSL

const StackPointer = component('StackPointer')
  .in('decrement', bit)
  .in('increment', bit)
  .in('load', bit)
  .in('load_value', bus(8))
  .out('sp', bus(8))
  .node('sp_reg', Register, { initial: 255 })
  .node('always_on', Constant, { value: 1 })
  .node('one', Constant, { value: 1 })
  .node('init_value', Constant, { value: 255 })
  .node('dec', Subtractor)
  .node('zero_bit', Constant, { value: 0 })
  .node('inc', Adder)
  .node('mux_inc', Mux)
  .node('mux_dec', Mux)
  .node('mux_load', Mux)
  .connect(({ in: inp, out, sp_reg, always_on, one, init_value, dec, zero_bit, inc, mux_inc, mux_dec, mux_load }) => [
    always_on.out.to(sp_reg.we),
    sp_reg.q.to(dec.a, inc.a, mux_inc.in0, out.sp),
    one.out.to(dec.b, inc.b),
    zero_bit.out.to(dec.borrow_in, inc.carry_in),
    inp.increment.to(mux_inc.sel),
    inc.sum.to(mux_inc.in1),
    inp.decrement.to(mux_dec.sel),
    mux_inc.out.to(mux_dec.in0),
    dec.difference.to(mux_dec.in1),
    inp.load.to(mux_load.sel),
    mux_dec.out.to(mux_load.in0),
    inp.load_value.to(mux_load.in1),
    mux_load.out.to(sp_reg.data),
  ])
  .build()

const StackMemory = component('StackMemory')
  .in('addr', bus(8))
  .in('data_in', bus(8))
  .in('write_enable', bit)
  .out('data_out', bus(8))
  .node('zero', Constant, { value: 0 })
  .node('addr_f0', Constant, { value: 240 })
  .node('addr_f1', Constant, { value: 241 })
  .node('addr_f2', Constant, { value: 242 })
  .node('addr_f3', Constant, { value: 243 })
  .node('addr_f4', Constant, { value: 244 })
  .node('addr_f5', Constant, { value: 245 })
  .node('addr_f6', Constant, { value: 246 })
  .node('addr_f7', Constant, { value: 247 })
  .node('addr_f8', Constant, { value: 248 })
  .node('addr_f9', Constant, { value: 249 })
  .node('addr_fa', Constant, { value: 250 })
  .node('addr_fb', Constant, { value: 251 })
  .node('addr_fc', Constant, { value: 252 })
  .node('addr_fd', Constant, { value: 253 })
  .node('addr_fe', Constant, { value: 254 })
  .node('addr_ff', Constant, { value: 255 })
  .node('at_f0', Comparator)
  .node('at_f1', Comparator)
  .node('at_f2', Comparator)
  .node('at_f3', Comparator)
  .node('at_f4', Comparator)
  .node('at_f5', Comparator)
  .node('at_f6', Comparator)
  .node('at_f7', Comparator)
  .node('at_f8', Comparator)
  .node('at_f9', Comparator)
  .node('at_fa', Comparator)
  .node('at_fb', Comparator)
  .node('at_fc', Comparator)
  .node('at_fd', Comparator)
  .node('at_fe', Comparator)
  .node('at_ff', Comparator)
  .node('mem_f0', Register)
  .node('mem_f1', Register)
  .node('mem_f2', Register)
  .node('mem_f3', Register)
  .node('mem_f4', Register)
  .node('mem_f5', Register)
  .node('mem_f6', Register)
  .node('mem_f7', Register)
  .node('mem_f8', Register)
  .node('mem_f9', Register)
  .node('mem_fa', Register)
  .node('mem_fb', Register)
  .node('mem_fc', Register)
  .node('mem_fd', Register)
  .node('mem_fe', Register)
  .node('mem_ff', Register)
  .node('we_f0', And)
  .node('we_f1', And)
  .node('we_f2', And)
  .node('we_f3', And)
  .node('we_f4', And)
  .node('we_f5', And)
  .node('we_f6', And)
  .node('we_f7', And)
  .node('we_f8', And)
  .node('we_f9', And)
  .node('we_fa', And)
  .node('we_fb', And)
  .node('we_fc', And)
  .node('we_fd', And)
  .node('we_fe', And)
  .node('we_ff', And)
  .node('mux1', Mux)
  .node('mux2', Mux)
  .node('mux3', Mux)
  .node('mux4', Mux)
  .node('mux5', Mux)
  .node('mux6', Mux)
  .node('mux7', Mux)
  .node('mux8', Mux)
  .node('mux9', Mux)
  .node('mux10', Mux)
  .node('mux11', Mux)
  .node('mux12', Mux)
  .node('mux13', Mux)
  .node('mux14', Mux)
  .node('mux15', Mux)
  .node('mux16', Mux)
  .connect(({ in: inp, out, zero, addr_f0, addr_f1, addr_f2, addr_f3, addr_f4, addr_f5, addr_f6, addr_f7, addr_f8, addr_f9, addr_fa, addr_fb, addr_fc, addr_fd, addr_fe, addr_ff, at_f0, at_f1, at_f2, at_f3, at_f4, at_f5, at_f6, at_f7, at_f8, at_f9, at_fa, at_fb, at_fc, at_fd, at_fe, at_ff, mem_f0, mem_f1, mem_f2, mem_f3, mem_f4, mem_f5, mem_f6, mem_f7, mem_f8, mem_f9, mem_fa, mem_fb, mem_fc, mem_fd, mem_fe, mem_ff, we_f0, we_f1, we_f2, we_f3, we_f4, we_f5, we_f6, we_f7, we_f8, we_f9, we_fa, we_fb, we_fc, we_fd, we_fe, we_ff, mux1, mux2, mux3, mux4, mux5, mux6, mux7, mux8, mux9, mux10, mux11, mux12, mux13, mux14, mux15, mux16 }) => [
    inp.addr.to(at_f0.a, at_f1.a, at_f2.a, at_f3.a, at_f4.a, at_f5.a, at_f6.a, at_f7.a, at_f8.a, at_f9.a, at_fa.a, at_fb.a, at_fc.a, at_fd.a, at_fe.a, at_ff.a),
    addr_f0.out.to(at_f0.b),
    addr_f1.out.to(at_f1.b),
    addr_f2.out.to(at_f2.b),
    addr_f3.out.to(at_f3.b),
    addr_f4.out.to(at_f4.b),
    addr_f5.out.to(at_f5.b),
    addr_f6.out.to(at_f6.b),
    addr_f7.out.to(at_f7.b),
    addr_f8.out.to(at_f8.b),
    addr_f9.out.to(at_f9.b),
    addr_fa.out.to(at_fa.b),
    addr_fb.out.to(at_fb.b),
    addr_fc.out.to(at_fc.b),
    addr_fd.out.to(at_fd.b),
    addr_fe.out.to(at_fe.b),
    addr_ff.out.to(at_ff.b),
    inp.data_in.to(mem_f0.data, mem_f1.data, mem_f2.data, mem_f3.data, mem_f4.data, mem_f5.data, mem_f6.data, mem_f7.data, mem_f8.data, mem_f9.data, mem_fa.data, mem_fb.data, mem_fc.data, mem_fd.data, mem_fe.data, mem_ff.data),
    inp.write_enable.to(we_f0.a, we_f1.a, we_f2.a, we_f3.a, we_f4.a, we_f5.a, we_f6.a, we_f7.a, we_f8.a, we_f9.a, we_fa.a, we_fb.a, we_fc.a, we_fd.a, we_fe.a, we_ff.a),
    at_f0.eq.to(we_f0.b, mux1.sel),
    we_f0.out.to(mem_f0.we),
    at_f1.eq.to(we_f1.b, mux2.sel),
    we_f1.out.to(mem_f1.we),
    at_f2.eq.to(we_f2.b, mux3.sel),
    we_f2.out.to(mem_f2.we),
    at_f3.eq.to(we_f3.b, mux4.sel),
    we_f3.out.to(mem_f3.we),
    at_f4.eq.to(we_f4.b, mux5.sel),
    we_f4.out.to(mem_f4.we),
    at_f5.eq.to(we_f5.b, mux6.sel),
    we_f5.out.to(mem_f5.we),
    at_f6.eq.to(we_f6.b, mux7.sel),
    we_f6.out.to(mem_f6.we),
    at_f7.eq.to(we_f7.b, mux8.sel),
    we_f7.out.to(mem_f7.we),
    at_f8.eq.to(we_f8.b, mux9.sel),
    we_f8.out.to(mem_f8.we),
    at_f9.eq.to(we_f9.b, mux10.sel),
    we_f9.out.to(mem_f9.we),
    at_fa.eq.to(we_fa.b, mux11.sel),
    we_fa.out.to(mem_fa.we),
    at_fb.eq.to(we_fb.b, mux12.sel),
    we_fb.out.to(mem_fb.we),
    at_fc.eq.to(we_fc.b, mux13.sel),
    we_fc.out.to(mem_fc.we),
    at_fd.eq.to(we_fd.b, mux14.sel),
    we_fd.out.to(mem_fd.we),
    at_fe.eq.to(we_fe.b, mux15.sel),
    we_fe.out.to(mem_fe.we),
    at_ff.eq.to(we_ff.b, mux16.sel),
    we_ff.out.to(mem_ff.we),
    zero.out.to(mux1.in0),
    mem_f0.q.to(mux1.in1),
    mux1.out.to(mux2.in0),
    mem_f1.q.to(mux2.in1),
    mux2.out.to(mux3.in0),
    mem_f2.q.to(mux3.in1),
    mux3.out.to(mux4.in0),
    mem_f3.q.to(mux4.in1),
    mux4.out.to(mux5.in0),
    mem_f4.q.to(mux5.in1),
    mux5.out.to(mux6.in0),
    mem_f5.q.to(mux6.in1),
    mux6.out.to(mux7.in0),
    mem_f6.q.to(mux7.in1),
    mux7.out.to(mux8.in0),
    mem_f7.q.to(mux8.in1),
    mux8.out.to(mux9.in0),
    mem_f8.q.to(mux9.in1),
    mux9.out.to(mux10.in0),
    mem_f9.q.to(mux10.in1),
    mux10.out.to(mux11.in0),
    mem_fa.q.to(mux11.in1),
    mux11.out.to(mux12.in0),
    mem_fb.q.to(mux12.in1),
    mux12.out.to(mux13.in0),
    mem_fc.q.to(mux13.in1),
    mux13.out.to(mux14.in0),
    mem_fd.q.to(mux14.in1),
    mux14.out.to(mux15.in0),
    mem_fe.q.to(mux15.in1),
    mux15.out.to(mux16.in0),
    mem_ff.q.to(mux16.in1),
    mux16.out.to(out.data_out),
  ])
  .build()

const StackTest = component('StackTest')
  .node('sp', StackPointer)
  .node('stack_mem', StackMemory)
  .node('dec_input', Input)
  .node('inc_input', Input)
  .node('load_input', Input)
  .node('load_val_input', Input)
  .node('data_input', Input)
  .node('write_input', Input)
  .node('d_sp', HexDisplay)
  .node('d_data_out', HexDisplay)
  .connect(({ in: inp, out, sp, stack_mem, dec_input, inc_input, load_input, load_val_input, data_input, write_input, d_sp, d_data_out }) => [
    sp.sp.to(stack_mem.addr, d_sp.in),
    dec_input.out.to(sp.decrement),
    inc_input.out.to(sp.increment),
    load_input.out.to(sp.load),
    load_val_input.out.to(sp.load_value),
    data_input.out.to(stack_mem.data_in),
    write_input.out.to(stack_mem.write_enable),
    stack_mem.data_out.to(d_data_out.in),
  ])
  .build()
