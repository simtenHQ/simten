// Auto-generated from DSL

const PacketGenerator = component('PacketGenerator')
  .out('byte_out', bus(8))
  .out('valid', bit)
  .node('cycle_counter', Register)
  .node('counter_inc', Adder)
  .node('ONE', Input, { value: 1 })
  .node('is_nineteen', Comparator)
  .node('NINETEEN', Input, { value: 19 })
  .node('ZERO', Input, { value: 0 })
  .node('next_counter', Mux)
  .node('counter_we', Input, { value: 1 })
  .node('is_cycle_0', Comparator)
  .node('is_cycle_1', Comparator)
  .node('is_cycle_2', Comparator)
  .node('TWO', Input, { value: 2 })
  .node('is_cycle_3', Comparator)
  .node('THREE', Input, { value: 3 })
  .node('is_cycle_4', Comparator)
  .node('FOUR', Input, { value: 4 })
  .node('is_cycle_5', Comparator)
  .node('FIVE', Input, { value: 5 })
  .node('is_cycle_6', Comparator)
  .node('SIX', Input, { value: 6 })
  .node('is_preamble_0_1', Or)
  .node('is_preamble_2_3', Or)
  .node('is_preamble_4_5', Or)
  .node('is_preamble_01_23', Or)
  .node('is_preamble_45_6', Or)
  .node('is_preamble', Or)
  .node('is_cycle_7', Comparator)
  .node('SEVEN', Input, { value: 7 })
  .node('is_cycle_8', Comparator)
  .node('EIGHT', Input, { value: 8 })
  .node('is_cycle_9', Comparator)
  .node('NINE', Input, { value: 9 })
  .node('is_cycle_10', Comparator)
  .node('TEN', Input, { value: 10 })
  .node('is_cycle_11', Comparator)
  .node('ELEVEN', Input, { value: 11 })
  .node('is_cycle_12', Comparator)
  .node('TWELVE', Input, { value: 12 })
  .node('is_cycle_13', Comparator)
  .node('THIRTEEN', Input, { value: 13 })
  .node('is_cycle_14', Comparator)
  .node('FOURTEEN', Input, { value: 14 })
  .node('is_cycle_15', Comparator)
  .node('FIFTEEN', Input, { value: 15 })
  .node('is_lt_sixteen', Comparator)
  .node('SIXTEEN', Input, { value: 16 })
  .node('DATA_0', Input, { value: 170 })
  .node('DATA_1', Input, { value: 187 })
  .node('DATA_2', Input, { value: 204 })
  .node('DATA_3', Input, { value: 221 })
  .node('DATA_4', Input, { value: 238 })
  .node('DATA_5', Input, { value: 255 })
  .node('DATA_6', Input, { value: 17 })
  .node('DATA_7', Input, { value: 34 })
  .node('PREAMBLE_BYTE', Input, { value: 85 })
  .node('SFD_BYTE', Input, { value: 213 })
  .node('data_mux_7', Mux)
  .node('data_mux_6', Mux)
  .node('data_mux_5', Mux)
  .node('data_mux_4', Mux)
  .node('data_mux_3', Mux)
  .node('data_mux_2', Mux)
  .node('data_mux_1', Mux)
  .node('data_mux_0', Mux)
  .node('sfd_or_data', Mux)
  .node('byte_out_mux', Mux)
  .connect(({ in: inp, out, cycle_counter, counter_inc, ONE, is_nineteen, NINETEEN, ZERO, next_counter, counter_we, is_cycle_0, is_cycle_1, is_cycle_2, TWO, is_cycle_3, THREE, is_cycle_4, FOUR, is_cycle_5, FIVE, is_cycle_6, SIX, is_preamble_0_1, is_preamble_2_3, is_preamble_4_5, is_preamble_01_23, is_preamble_45_6, is_preamble, is_cycle_7, SEVEN, is_cycle_8, EIGHT, is_cycle_9, NINE, is_cycle_10, TEN, is_cycle_11, ELEVEN, is_cycle_12, TWELVE, is_cycle_13, THIRTEEN, is_cycle_14, FOURTEEN, is_cycle_15, FIFTEEN, is_lt_sixteen, SIXTEEN, DATA_0, DATA_1, DATA_2, DATA_3, DATA_4, DATA_5, DATA_6, DATA_7, PREAMBLE_BYTE, SFD_BYTE, data_mux_7, data_mux_6, data_mux_5, data_mux_4, data_mux_3, data_mux_2, data_mux_1, data_mux_0, sfd_or_data, byte_out_mux }) => [
    cycle_counter.q.to(counter_inc.a, is_nineteen.a, is_cycle_0.a, is_cycle_1.a, is_cycle_2.a, is_cycle_3.a, is_cycle_4.a, is_cycle_5.a, is_cycle_6.a, is_cycle_7.a, is_cycle_8.a, is_cycle_9.a, is_cycle_10.a, is_cycle_11.a, is_cycle_12.a, is_cycle_13.a, is_cycle_14.a, is_cycle_15.a, is_lt_sixteen.a),
    ONE.out.to(counter_inc.b, is_cycle_1.b),
    NINETEEN.out.to(is_nineteen.b),
    counter_inc.sum.to(next_counter.in0),
    ZERO.out.to(next_counter.in1, is_cycle_0.b),
    is_nineteen.eq.to(next_counter.sel),
    next_counter.out.to(cycle_counter.data),
    counter_we.out.to(cycle_counter.we),
    TWO.out.to(is_cycle_2.b),
    THREE.out.to(is_cycle_3.b),
    FOUR.out.to(is_cycle_4.b),
    FIVE.out.to(is_cycle_5.b),
    SIX.out.to(is_cycle_6.b),
    is_cycle_0.eq.to(is_preamble_0_1.a),
    is_cycle_1.eq.to(is_preamble_0_1.b),
    is_cycle_2.eq.to(is_preamble_2_3.a),
    is_cycle_3.eq.to(is_preamble_2_3.b),
    is_cycle_4.eq.to(is_preamble_4_5.a),
    is_cycle_5.eq.to(is_preamble_4_5.b),
    is_preamble_0_1.out.to(is_preamble_01_23.a),
    is_preamble_2_3.out.to(is_preamble_01_23.b),
    is_preamble_4_5.out.to(is_preamble_45_6.a),
    is_cycle_6.eq.to(is_preamble_45_6.b),
    is_preamble_01_23.out.to(is_preamble.a),
    is_preamble_45_6.out.to(is_preamble.b),
    SEVEN.out.to(is_cycle_7.b),
    EIGHT.out.to(is_cycle_8.b),
    NINE.out.to(is_cycle_9.b),
    TEN.out.to(is_cycle_10.b),
    ELEVEN.out.to(is_cycle_11.b),
    TWELVE.out.to(is_cycle_12.b),
    THIRTEEN.out.to(is_cycle_13.b),
    FOURTEEN.out.to(is_cycle_14.b),
    FIFTEEN.out.to(is_cycle_15.b),
    SIXTEEN.out.to(is_lt_sixteen.b),
    is_lt_sixteen.lt.to(out.valid),
    DATA_7.out.to(data_mux_7.in0, data_mux_7.in1),
    is_cycle_15.eq.to(data_mux_7.sel),
    data_mux_7.out.to(data_mux_6.in0),
    DATA_6.out.to(data_mux_6.in1),
    is_cycle_14.eq.to(data_mux_6.sel),
    data_mux_6.out.to(data_mux_5.in0),
    DATA_5.out.to(data_mux_5.in1),
    is_cycle_13.eq.to(data_mux_5.sel),
    data_mux_5.out.to(data_mux_4.in0),
    DATA_4.out.to(data_mux_4.in1),
    is_cycle_12.eq.to(data_mux_4.sel),
    data_mux_4.out.to(data_mux_3.in0),
    DATA_3.out.to(data_mux_3.in1),
    is_cycle_11.eq.to(data_mux_3.sel),
    data_mux_3.out.to(data_mux_2.in0),
    DATA_2.out.to(data_mux_2.in1),
    is_cycle_10.eq.to(data_mux_2.sel),
    data_mux_2.out.to(data_mux_1.in0),
    DATA_1.out.to(data_mux_1.in1),
    is_cycle_9.eq.to(data_mux_1.sel),
    data_mux_1.out.to(data_mux_0.in0),
    DATA_0.out.to(data_mux_0.in1),
    is_cycle_8.eq.to(data_mux_0.sel),
    data_mux_0.out.to(sfd_or_data.in0),
    SFD_BYTE.out.to(sfd_or_data.in1),
    is_cycle_7.eq.to(sfd_or_data.sel),
    sfd_or_data.out.to(byte_out_mux.in0),
    PREAMBLE_BYTE.out.to(byte_out_mux.in1),
    is_preamble.out.to(byte_out_mux.sel),
    byte_out_mux.out.to(out.byte_out),
  ])
  .build()
