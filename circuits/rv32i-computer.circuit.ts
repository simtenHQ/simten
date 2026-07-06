/**
 * RV32I Computer — a complete RISC-V system you can drill into.
 *
 * Top level reads like a block diagram: program ROM → CPU → memory bus → UART
 * console, with the PC on a hex display. Double-click the CPU to see the
 * five-stage pipeline (IF / ID / EX / MEM / WB with the pipeline registers
 * between stages, hazard + forwarding units alongside); keep drilling into a
 * stage to reach the ALU, register file, and decoder.
 *
 * The ROM ships with a program (hand-assembled RV32I, listing below) that
 * prints to the UART forever. Drop a compiled .bin on the ROM node to run
 * your own code. This is the same CPU core that passes riscv-arch-test
 * (38/38 vs Spike) and runs on a ULX3S FPGA.
 */
import { bit, bus, circuit } from '@simten/core/circuit';
import {
  Constant,
  DualPortROM,
  HexDisplay,
  MemBusMux,
  RV32I_Core,
  RV32I_DataMem,
  UART_TX,
} from '@simten/core/std';

// The preloaded program — prints "HELLO FROM RISC-V" in a loop:
//   lui  a0, 0x80000          # a0 = UART (memory-mapped at 0x80000000)
//   loop:
//     addi a1, x0, '<char>'   # for each character of the message
//     sw   a1, 0(a0)          #   write it to the UART
//   addi a2, x0, 300          # then count down a delay...
//   delay:
//     addi a2, a2, -1
//     bne  a2, x0, delay
//   jal  x0, loop             # ...and print it again
const PROGRAM = [
  55, 5, 0, 128, 147, 5, 128, 4, 35, 32, 181, 0, 147, 5, 80, 4, 35, 32, 181, 0, 147, 5, 192, 4, 35,
  32, 181, 0, 147, 5, 192, 4, 35, 32, 181, 0, 147, 5, 240, 4, 35, 32, 181, 0, 147, 5, 0, 2, 35, 32,
  181, 0, 147, 5, 96, 4, 35, 32, 181, 0, 147, 5, 32, 5, 35, 32, 181, 0, 147, 5, 240, 4, 35, 32, 181,
  0, 147, 5, 208, 4, 35, 32, 181, 0, 147, 5, 0, 2, 35, 32, 181, 0, 147, 5, 32, 5, 35, 32, 181, 0,
  147, 5, 144, 4, 35, 32, 181, 0, 147, 5, 48, 5, 35, 32, 181, 0, 147, 5, 48, 4, 35, 32, 181, 0, 147,
  5, 208, 2, 35, 32, 181, 0, 147, 5, 96, 5, 35, 32, 181, 0, 147, 5, 208, 0, 35, 32, 181, 0, 147, 5,
  160, 0, 35, 32, 181, 0, 19, 6, 192, 18, 19, 6, 246, 255, 227, 30, 6, 254, 111, 240, 223, 245,
];

// The CPU: the canonical 5-stage pipelined RV32I core (the same one that runs
// on the FPGA), with its unused network ports tied off. Drill in to see the
// pipeline.
const CPU = circuit('CPU', {
  inputs: { instruction: bus(32), data_read: bus(32) },
  outputs: {
    instr_addr: bus(32),
    data_addr: bus(32),
    data_write: bus(32),
    data_mem_read: bit,
    data_mem_write: bit,
    data_funct3: bus(3),
    pc: bus(32),
  },
  nodes: {
    core: RV32I_Core(),
    zero32: Constant({ value: 0, width: 32 }),
    zero1: Constant({ value: 0, width: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { core, zero32, zero1 } }) => [
    inputs.instruction.to(core.instruction),
    inputs.data_read.to(core.data_read),
    zero32.out.to(core.net_rx_data),
    zero1.out.to(core.net_rx_valid, core.net_rx_frame),
    core.instr_addr.to(outputs.instr_addr),
    core.data_addr.to(outputs.data_addr),
    core.data_write.to(outputs.data_write),
    core.data_mem_read.to(outputs.data_mem_read),
    core.data_mem_write.to(outputs.data_mem_write),
    core.data_funct3.to(outputs.data_funct3),
    core.pc_out.to(outputs.pc),
  ],
});

// The memory system: bus decode + RAM, plus the plumbing that lets the CPU
// read constants out of the program ROM and talk to the UART.
// Map: RAM at 0x00010000, UART at 0x80000000, program ROM (read-only) at 0x0.
const Memory = circuit('Memory', {
  inputs: {
    addr: bus(32),
    write_data: bus(32),
    mem_read: bit,
    mem_write: bit,
    funct3: bus(3),
    rom_data: bus(32),
    uart_read_data: bus(32),
  },
  outputs: {
    read_data: bus(32),
    rom_addr: bus(32),
    uart_addr: bus(32),
    uart_write_data: bus(32),
    uart_read: bit,
    uart_write: bit,
  },
  nodes: {
    bus_mux: MemBusMux,
    ram: RV32I_DataMem,
    zero32: Constant({ value: 0, width: 32 }),
  },
  connect: ({ inputs, outputs, nodes: { bus_mux, ram, zero32 } }) => [
    inputs.addr.to(bus_mux.addr),
    inputs.write_data.to(bus_mux.write_data),
    inputs.mem_read.to(bus_mux.mem_read),
    inputs.mem_write.to(bus_mux.mem_write),
    inputs.funct3.to(bus_mux.funct3),
    bus_mux.local_addr.to(ram.addr, outputs.rom_addr, outputs.uart_addr),
    bus_mux.write_data_out.to(ram.write_data, outputs.uart_write_data),
    bus_mux.p0_read.to(ram.mem_read),
    bus_mux.p0_write.to(ram.mem_write),
    bus_mux.funct3_out.to(ram.funct3),
    ram.read_data.to(bus_mux.read_data_0),
    bus_mux.p1_read.to(outputs.uart_read),
    bus_mux.p1_write.to(outputs.uart_write),
    inputs.uart_read_data.to(bus_mux.read_data_1),
    inputs.rom_data.to(bus_mux.read_data_4),
    zero32.out.to(bus_mux.read_data_2, bus_mux.read_data_3),
    bus_mux.read_data.to(outputs.read_data),
  ],
});

// The computer: program → CPU → memory → console.
export const RV32I_Computer = circuit('RV32I_Computer', {
  nodes: {
    program: DualPortROM({ memory: PROGRAM }),
    cpu: CPU,
    memory: Memory,
    console: UART_TX,
    pc_display: HexDisplay,
  },
  connect: ({ nodes: { program, cpu, memory, console: con, pc_display } }) => [
    // instruction fetch
    cpu.instr_addr.to(program.addrA),
    program.dataA.to(cpu.instruction),
    // data bus
    cpu.data_addr.to(memory.addr),
    cpu.data_write.to(memory.write_data),
    cpu.data_mem_read.to(memory.mem_read),
    cpu.data_mem_write.to(memory.mem_write),
    cpu.data_funct3.to(memory.funct3),
    memory.read_data.to(cpu.data_read),
    // data-side reads of the program ROM (constants, strings)
    memory.rom_addr.to(program.addrB),
    program.dataB.to(memory.rom_data),
    // UART console
    memory.uart_addr.to(con.addr),
    memory.uart_write_data.to(con.write_data),
    memory.uart_read.to(con.mem_read),
    memory.uart_write.to(con.mem_write),
    con.read_data.to(memory.uart_read_data),
    // program counter readout
    cpu.pc.to(pc_display.in),
  ],
});
