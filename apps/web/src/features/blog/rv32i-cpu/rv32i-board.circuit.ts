import { circuit } from '@simten/core/circuit';
import {
  Constant,
  DualPortROM,
  HexDisplay,
  MemBusMux,
  RV32I_Core,
  RV32I_DataMem,
  UART_TX,
} from '@simten/core/std';

export const RV32I_Board = circuit('RV32I_Board', {
  nodes: {
    cpu: RV32I_Core(),
    rom: DualPortROM(),
    mem_bus: MemBusMux,
    dmem: RV32I_DataMem,
    uart: UART_TX,
    zero32: Constant({ value: 0, width: 32 }),
    zero1: Constant({ value: 0, width: 1 }),
    pc_display: HexDisplay,
  },
  connect: ({ nodes: { cpu, rom, mem_bus, dmem, uart, zero32, zero1, pc_display } }) => [
    cpu.instr_addr.to(rom.addrA),
    rom.dataA.to(cpu.instruction),
    cpu.data_addr.to(mem_bus.addr),
    cpu.data_write.to(mem_bus.write_data),
    cpu.data_mem_read.to(mem_bus.mem_read),
    cpu.data_mem_write.to(mem_bus.mem_write),
    cpu.data_funct3.to(mem_bus.funct3),
    mem_bus.local_addr.to(dmem.addr, uart.addr, rom.addrB),
    mem_bus.write_data_out.to(dmem.write_data, uart.write_data),
    mem_bus.p0_read.to(dmem.mem_read),
    mem_bus.p0_write.to(dmem.mem_write),
    mem_bus.funct3_out.to(dmem.funct3),
    dmem.read_data.to(mem_bus.read_data_0),
    mem_bus.p1_read.to(uart.mem_read),
    mem_bus.p1_write.to(uart.mem_write),
    uart.read_data.to(mem_bus.read_data_1),
    // ROM data port returns the raw aligned word; the CPU's WB-stage aligner
    // does byte/half extraction (an extra aligner here would extract twice).
    rom.dataB.to(mem_bus.read_data_4),
    zero32.out.to(cpu.net_rx_data, mem_bus.read_data_2, mem_bus.read_data_3),
    zero1.out.to(cpu.net_rx_valid, cpu.net_rx_frame),
    mem_bus.read_data.to(cpu.data_read),
    cpu.pc_out.to(pc_display.in),
  ],
});
