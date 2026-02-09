// Stage 7: System6502 - Full system integration
//
// Connects CPU6502Core to MemoryBus for complete system
// Memory map:
//   $0000-$00FF: RAM (zero page)
//   $0100-$01FF: RAM (stack)
//   $FF00-$FFFF: ROM (program)

// === System6502: Complete 6502 system ===
circuit System6502 {
  input reset: Bit

  // Debug outputs from CPU
  output pc: Bus[8]          // PC low byte (backward compatible)
  output pc_hi: Bus[8]       // PC high byte (Stage 8: 16-bit PC support)
  output instruction: Bus[8]
  output reg_a: Bus[8]
  output reg_x: Bus[8]
  output reg_y: Bus[8]
  output reg_sp: Bus[8]
  output flag_n: Bit
  output flag_z: Bit
  output flag_c: Bit
  output flag_v: Bit
  output flag_d: Bit
  output flag_i: Bit

  // Bus debug outputs
  output addr_lo: Bus[8]
  output addr_hi: Bus[8]
  output data_bus: Bus[8]
  output rw: Bit

  clock clk

  impl {
    node cpu: CPU6502Core
    node mem_bus: MemoryBus

    connect clk -> cpu.clk
    connect clk -> mem_bus.clk
    connect reset -> cpu.reset

    // CPU -> Bus
    connect cpu.addr_lo -> mem_bus.addr_lo
    connect cpu.addr_hi -> mem_bus.addr_hi
    connect cpu.data_out -> mem_bus.data_in
    connect cpu.rw -> mem_bus.rw

    // Bus -> CPU
    connect mem_bus.data_out -> cpu.data_in

    // Forward debug outputs from CPU
    connect cpu.pc -> pc
    connect cpu.pc_hi_out -> pc_hi
    connect cpu.instruction -> instruction
    connect cpu.reg_a -> reg_a
    connect cpu.reg_x -> reg_x
    connect cpu.reg_y -> reg_y
    connect cpu.reg_sp -> reg_sp
    connect cpu.flag_n -> flag_n
    connect cpu.flag_z -> flag_z
    connect cpu.flag_c -> flag_c
    connect cpu.flag_v -> flag_v
    connect cpu.flag_d -> flag_d
    connect cpu.flag_i -> flag_i

    // Bus debug outputs
    connect cpu.addr_lo -> addr_lo
    connect cpu.addr_hi -> addr_hi
    connect mem_bus.data_out -> data_bus
    connect cpu.rw -> rw
  }
}

// === Stage7Test: Test circuit with displays ===
circuit Stage7Test {
  clock clk

  impl {
    node system: System6502
    connect clk -> system.clk

    node reset_input: Input
    connect reset_input.out -> system.reset

    // Display CPU state
    node d_pc_lo: HexDisplay
    connect system.pc -> d_pc_lo.in

    node d_pc_hi: HexDisplay
    connect system.pc_hi -> d_pc_hi.in

    node d_instruction: HexDisplay
    connect system.instruction -> d_instruction.in

    node d_a: HexDisplay
    connect system.reg_a -> d_a.in

    node d_x: HexDisplay
    connect system.reg_x -> d_x.in

    node d_y: HexDisplay
    connect system.reg_y -> d_y.in

    node d_sp: HexDisplay
    connect system.reg_sp -> d_sp.in

    // Display bus state
    node d_addr_lo: HexDisplay
    connect system.addr_lo -> d_addr_lo.in

    node d_addr_hi: HexDisplay
    connect system.addr_hi -> d_addr_hi.in

    node d_data: HexDisplay
    connect system.data_bus -> d_data.in

    // Display flags
    node d_c: HexDisplay
    connect system.flag_c -> d_c.in

    node d_z: HexDisplay
    connect system.flag_z -> d_z.in

    node d_n: HexDisplay
    connect system.flag_n -> d_n.in
  }
}
