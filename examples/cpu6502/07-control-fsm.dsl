// 6502 CPU Stage 2: Control FSM
// States: FETCH (0), DECODE (1), EXECUTE (2), WRITEBACK (3)
// Generates control signals for CPU operation

circuit CPUControl {
  input reset: Bit          // 1 = reset to FETCH state
  input instr_cycles: Bus[3] // Number of cycles for current instruction
  input is_BRK: Bit         // 1 if current instruction is BRK (halt)

  output current_state: Bus[3]      // Current FSM state
  output cycle_num: Bus[3]  // Current cycle within instruction (0-based)
  output pc_increment: Bit  // 1 = increment PC this cycle
  output mem_read: Bit      // 1 = read from memory
  output mem_write: Bit     // 1 = write to memory
  output alu_enable: Bit    // 1 = ALU operation active
  output reg_write: Bit     // 1 = write to register file
  output halted: Bit        // 1 = CPU halted (BRK executed)

  clock clk

  impl {
    // === State Register ===
    node state_reg: Register
    connect clk -> state_reg.clk

    // === Cycle Counter ===
    node cycle_reg: Register
    connect clk -> cycle_reg.clk

    // === Halt Register ===
    node halt_reg: Register
    connect clk -> halt_reg.clk

    // === State Constants ===
    node STATE_FETCH: Constant(value=0)
    node STATE_DECODE: Constant(value=1)
    node STATE_EXECUTE: Constant(value=2)
    node STATE_WRITEBACK: Constant(value=3)

    // === State Comparators ===
    node is_fetch: Comparator
    connect state_reg.q -> is_fetch.a
    connect STATE_FETCH.out -> is_fetch.b

    node is_decode: Comparator
    connect state_reg.q -> is_decode.a
    connect STATE_DECODE.out -> is_decode.b

    node is_execute: Comparator
    connect state_reg.q -> is_execute.a
    connect STATE_EXECUTE.out -> is_execute.b

    node is_writeback: Comparator
    connect state_reg.q -> is_writeback.a
    connect STATE_WRITEBACK.out -> is_writeback.b

    // === Cycle Counter Logic ===
    node inc_cycle: Incrementer
    connect cycle_reg.q -> inc_cycle.in

    // Check if we've completed all cycles for this instruction
    node cycle_done: Comparator
    connect cycle_reg.q -> cycle_done.a
    connect instr_cycles -> cycle_done.b
    // cycle_done.eq = 1 when cycle_num == instr_cycles

    // Reset cycle counter in FETCH, otherwise increment
    node cycle_reset_or_inc: Mux
    connect is_fetch.eq -> cycle_reset_or_inc.sel
    connect inc_cycle.out -> cycle_reset_or_inc.in0    // not FETCH: increment
    connect STATE_FETCH.out -> cycle_reset_or_inc.in1  // FETCH: reset to 0

    connect cycle_reset_or_inc.out -> cycle_reg.data

    node always_on: Constant(value=1)
    node zero: Constant(value=0)
    connect always_on.out -> cycle_reg.we

    connect cycle_reg.q -> cycle_num

    // === Next State Logic ===
    // FETCH -> DECODE -> EXECUTE -> (repeat EXECUTE until cycle_done) -> FETCH
    // Simplified: FETCH -> DECODE -> EXECUTE -> FETCH (for now)

    // If halted, stay in current state
    // If reset, go to FETCH
    // If cycle_done, go to FETCH
    // Otherwise: FETCH->DECODE, DECODE->EXECUTE, EXECUTE->EXECUTE or FETCH

    // Is execution complete? (cycle_done in EXECUTE state)
    node exec_done: And
    connect is_execute.eq -> exec_done.a
    connect cycle_done.eq -> exec_done.b

    // Next state = DECODE if currently FETCH
    node next_if_fetch: Mux
    connect is_fetch.eq -> next_if_fetch.sel
    connect state_reg.q -> next_if_fetch.in0           // not FETCH: stay
    connect STATE_DECODE.out -> next_if_fetch.in1      // FETCH: go to DECODE

    // Next state = EXECUTE if currently DECODE
    node next_if_decode: Mux
    connect is_decode.eq -> next_if_decode.sel
    connect next_if_fetch.out -> next_if_decode.in0    // prev result
    connect STATE_EXECUTE.out -> next_if_decode.in1    // DECODE: go to EXECUTE

    // Next state = FETCH if exec_done, else stay in EXECUTE
    node next_if_execute: Mux
    connect exec_done.out -> next_if_execute.sel
    connect next_if_decode.out -> next_if_execute.in0  // prev result
    connect STATE_FETCH.out -> next_if_execute.in1     // exec done: go to FETCH

    // If reset or BRK, go to FETCH and halt
    node handle_reset: Mux
    connect reset -> handle_reset.sel
    connect next_if_execute.out -> handle_reset.in0    // normal operation
    connect STATE_FETCH.out -> handle_reset.in1        // reset: FETCH

    connect handle_reset.out -> state_reg.data
    connect always_on.out -> state_reg.we

    connect state_reg.q -> current_state

    // === Halt Logic ===
    // Set halt flag when BRK is executed
    node set_halt: Or
    connect halt_reg.q -> set_halt.a
    connect is_BRK -> set_halt.b

    // Clear halt on reset
    node halt_value: Mux
    connect reset -> halt_value.sel
    connect set_halt.out -> halt_value.in0    // normal: set if BRK
    connect zero.out -> halt_value.in1        // reset: clear

    connect halt_value.out -> halt_reg.data
    connect always_on.out -> halt_reg.we

    // Output halt status (extend to 8 bits for display)
    connect halt_reg.q -> halted

    // === Control Signal Generation ===

    // PC increment: in FETCH state only
    connect is_fetch.eq -> pc_increment

    // Memory read: in FETCH and DECODE states
    node mem_read_sig: Or
    connect is_fetch.eq -> mem_read_sig.a
    connect is_decode.eq -> mem_read_sig.b
    connect mem_read_sig.out -> mem_read

    // Memory write: in EXECUTE state (for STA instruction)
    // TODO: Should check if instruction is STA, for now just EXECUTE
    connect is_execute.eq -> mem_write

    // ALU enable: in EXECUTE state
    connect is_execute.eq -> alu_enable

    // Register write: in EXECUTE state (for LDA, ADC)
    connect is_execute.eq -> reg_write
  }
}

// === Test Circuit ===
circuit CPUControlTest {
  output current_state: Bus[3]
  output cycle: Bus[3]
  output pc_inc: Bit
  output mem_rd: Bit
  output mem_wr: Bit
  output alu_en: Bit
  output halted: Bit

  clock clk

  impl {
    node fsm: CPUControl
    connect clk -> fsm.clk

    // Manual inputs for testing
    node reset_input: Input       // 1 to reset
    node cycles_input: Input      // Number of cycles (try 2 or 4)
    node brk_input: Input         // 1 if BRK instruction

    connect reset_input.out -> fsm.reset
    connect cycles_input.out -> fsm.instr_cycles
    connect brk_input.out -> fsm.is_BRK

    connect fsm.current_state -> current_state
    connect fsm.cycle_num -> cycle
    connect fsm.pc_increment -> pc_inc
    connect fsm.mem_read -> mem_rd
    connect fsm.mem_write -> mem_wr
    connect fsm.alu_enable -> alu_en
    connect fsm.halted -> halted

    // Add displays
    node d_state: HexDisplay
    connect current_state -> d_state.in

    node d_cycle: HexDisplay
    connect cycle -> d_cycle.in
  }
}
