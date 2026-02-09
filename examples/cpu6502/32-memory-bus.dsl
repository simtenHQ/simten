// Stage 8B: Memory Bus Architecture
// Full 64KB address space with proper memory map
//
// Memory Map:
//   $0000-$07FF: RAM (2KB - currently 256 bytes due to primitive limitation)
//   $0800-$BFFF: Unmapped (open bus)
//   $C000-$FFFF: ROM (16KB)
//   $FFFC-$FFFD: Reset Vector

// === RAM2K: RAM at $0000-$07FF ===
// Currently uses 256-byte RAM primitive (limitation accepted)
circuit RAM2K {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]
  input data_in: Bus[8]
  input we: Bit

  output data_out: Bus[8]
  output responds: Bit

  clock clk

  impl {
    // RAM responds to $0000-$07FF (addr_hi < 8)
    node eight: Constant(value=8)
    node addr_hi_cmp: Comparator
    connect addr_hi -> addr_hi_cmp.a
    connect eight.out -> addr_hi_cmp.b

    // Use comparator output directly for both internal and external
    connect addr_hi_cmp.lt -> responds

    // RAM primitive (256 bytes - uses addr_lo only)
    node ram: RAM
    connect clk -> ram.clk
    connect addr_lo -> ram.addr
    connect data_in -> ram.data_in

    // Only write if we respond to this address
    // Use addr_hi_cmp.lt directly instead of responds to avoid elaboration issue
    node write_enable: And
    connect addr_hi_cmp.lt -> write_enable.a
    connect we -> write_enable.b
    connect write_enable.out -> ram.we

    connect ram.data_out -> data_out
  }
}

// === ROM16K: ROM at $C000-$FFFF ===
// 16KB ROM with reset vector and test program
circuit ROM16K {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]

  output data_out: Bus[8]
  output responds: Bit

  impl {
    // ROM responds to $C000-$FFFF (addr_hi >= 0xC0)
    node c0: Constant(value=192)
    node addr_hi_cmp: Comparator
    connect addr_hi -> addr_hi_cmp.a
    connect c0.out -> addr_hi_cmp.b

    // responds = NOT(lt) = (addr_hi >= 0xC0)
    node not_lt: Not
    connect addr_hi_cmp.lt -> not_lt.in
    connect not_lt.out -> responds

    // Combine address for 16-bit ROM lookup
    node addr_combine: AddressCombiner
    connect addr_lo -> addr_combine.lo
    connect addr_hi -> addr_combine.hi

    // ROM with reset vector and test program
    // Reset vector at $FFFC/$FFFD points to $C000
    // Test program at $C000 (same as Stage 7 test)
    node rom: ROM(data={
      // Reset vector points to $C000
      0xFFFC: 0x00,
      0xFFFD: 0xC0,

      // Program at $C000:
      // $C000: SEC           (38)    - Set carry (C=1)
      // $C001: SEI           (78)    - Set interrupt disable (I=1)
      // $C002: PHP           (08)    - Push processor status to stack
      // $C003: CLC           (18)    - Clear carry (C=0)
      // $C004: CLI           (58)    - Clear interrupt disable (I=0)
      // $C005: PLP           (28)    - Pull processor status (C=1, I=1 restored)
      // $C006: LDA #$0F      (A9 0F) - Load 0x0F into A
      // $C008: AND #$F0      (29 F0) - A = A AND F0 = 0x00 (Z=1)
      // $C00A: ORA #$F0      (09 F0) - A = A OR F0 = 0xF0 (N=1)
      // $C00C: INY           (C8)    - Y++ = 1
      // $C00D: INY           (C8)    - Y++ = 2
      // $C00E: DEX           (CA)    - X-- = FF (from 0, wraps)
      // $C00F: NOP           (EA)    - Do nothing
      0xC000: 0x38,
      0xC001: 0x78,
      0xC002: 0x08,
      0xC003: 0x18,
      0xC004: 0x58,
      0xC005: 0x28,
      0xC006: 0xA9,
      0xC007: 0x0F,
      0xC008: 0x29,
      0xC009: 0xF0,
      0xC00A: 0x09,
      0xC00B: 0xF0,
      0xC00C: 0xC8,
      0xC00D: 0xC8,
      0xC00E: 0xCA,
      0xC00F: 0xEA
    })
    connect addr_combine.out -> rom.addr
    connect rom.data_out -> data_out
  }
}

// === MemoryBus: Device router with address decode and open bus ===
// Routes memory accesses to appropriate devices based on address
circuit MemoryBus {
  input addr_lo: Bus[8]
  input addr_hi: Bus[8]
  input data_in: Bus[8]
  input rw: Bit

  output data_out: Bus[8]

  clock clk

  impl {
    // Memory devices
    node ram: RAM2K
    node rom: ROM16K

    connect clk -> ram.clk
    connect addr_lo -> ram.addr_lo
    connect addr_hi -> ram.addr_hi
    connect data_in -> ram.data_in

    connect addr_lo -> rom.addr_lo
    connect addr_hi -> rom.addr_hi

    // RAM write enable: ram.responds AND NOT(rw)
    node not_rw: Not
    connect rw -> not_rw.in

    node ram_we: And
    connect ram.responds -> ram_we.a
    connect not_rw.out -> ram_we.b
    connect ram_we.out -> ram.we

    // Open bus register (latches last read value)
    node open_bus: Register
    connect clk -> open_bus.clk

    // Data output mux chain: open_bus -> RAM -> ROM
    // Priority: ROM > RAM > open_bus
    node data_mux_ram: Mux
    connect ram.responds -> data_mux_ram.sel
    connect open_bus.q -> data_mux_ram.in0
    connect ram.data_out -> data_mux_ram.in1

    node data_mux_rom: Mux
    connect rom.responds -> data_mux_rom.sel
    connect data_mux_ram.out -> data_mux_rom.in0
    connect rom.data_out -> data_mux_rom.in1

    connect data_mux_rom.out -> data_out

    // Update open bus on reads only (rw=1 means read)
    // Latch data when any device is selected and we're reading
    node any_device: Or
    connect ram.responds -> any_device.a
    connect rom.responds -> any_device.b

    node open_bus_we: And
    connect any_device.out -> open_bus_we.a
    connect rw -> open_bus_we.b

    connect open_bus_we.out -> open_bus.we
    connect data_mux_rom.out -> open_bus.data
  }
}

// === MemoryBusTest: Test circuit for memory bus ===
circuit MemoryBusTest {
  clock clk

  impl {
    node mem_bus: MemoryBus
    connect clk -> mem_bus.clk

    // Input controls
    node addr_lo_in: Input
    node addr_hi_in: Input
    node data_in: Input
    node rw_in: Input

    connect addr_lo_in.out -> mem_bus.addr_lo
    connect addr_hi_in.out -> mem_bus.addr_hi
    connect data_in.out -> mem_bus.data_in
    connect rw_in.out -> mem_bus.rw

    // Output display
    node d_data_out: HexDisplay
    connect mem_bus.data_out -> d_data_out.in
  }
}
