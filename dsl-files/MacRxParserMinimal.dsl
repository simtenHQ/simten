circuit MacRxParserMinimal {
  impl {
    node byte_in: Input
    node valid: Input

    node fsm_state: Register
    node preamble_count: Register

    node STATE_IDLE: Input
    node STATE_PREAMBLE_SYNC: Input

    node ZERO: Input
    node ONE: Input

    node isIDLE: Comparator
    connect fsm_state.q -> isIDLE.a
    connect STATE_IDLE.out -> isIDLE.b

    node isPreambleByte: Comparator
    connect byte_in.out -> isPreambleByte.a
    connect ZERO.out -> isPreambleByte.b

    node idle_transition: And
    connect isIDLE.eq -> idle_transition.a
    connect isPreambleByte.eq -> idle_transition.b

    node next_state: Mux
    connect STATE_IDLE.out -> next_state.in0
    connect STATE_PREAMBLE_SYNC.out -> next_state.in1
    connect idle_transition.out -> next_state.sel

    connect next_state.out -> fsm_state.data
    node fsm_state_we: Switch
    connect fsm_state_we.out -> fsm_state.we

    node data_out: HexDisplay
    connect byte_in.out -> data_out.in
  }
}
