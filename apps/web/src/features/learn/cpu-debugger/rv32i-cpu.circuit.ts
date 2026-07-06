import { bit, bus, circuit } from '@simten/core/circuit';
import {
  Constant,
  MemBusMux,
  NIC_FIFO,
  RV32I_Core,
  RV32I_DataMem,
  RV32I_InstrMem,
  UART_TX,
} from '@simten/core/std';

// Debugger board: the canonical pipelined CPU (`RV32I_Core`) plus the memory and
// memory-mapped peripherals the debugger UI needs. `debug: true` exposes:
//   • a JTAG-style register scan port — the UI cycles `debug_addr` 0..31 and
//     samples `debug_value` to build the register view;
//   • the five pipeline-stage PCs (`if_pc/id_pc/ex_pc/mem_pc4/wb_pc4`) as outputs,
//     read by useRV32IDebugger for the IF/ID/EX/MEM/WB view (MEM/WB are PC+4).
// All synthesizable. The CPU's own `net_*` ports are vestigial — real networking
// is the `nic` peripheral on the bus — so they're tied off.
export const RV32I_CPU = circuit('RV32I_CPU', {
  inputs: { net_rx_data: bus(32), net_rx_valid: bit, net_rx_frame: bit, debug_addr: bus(5) },
  outputs: {
    net_tx_data: bus(32),
    net_tx_valid: bit,
    net_tx_frame: bit,
    pc_out: bus(32),
    debug_value: bus(32),
    if_pc: bus(32),
    id_pc: bus(32),
    ex_pc: bus(32),
    mem_pc4: bus(32),
    wb_pc4: bus(32),
  },
  nodes: {
    cpu: RV32I_Core({ debug: true }),
    imem: RV32I_InstrMem, // instruction fetch (hook loads the program here via setNodeValue("imem", …))
    bus_mux: MemBusMux,
    dmem: RV32I_DataMem,
    uart: UART_TX,
    nic: NIC_FIFO,
    imem_data: RV32I_InstrMem, // data-side reads of the instruction region
    zero32: Constant({ value: 0, width: 32 }),
    zero1: Constant({ value: 0, width: 1 }),
  },
  connect: ({
    inputs,
    outputs,
    nodes: { cpu, imem, bus_mux, dmem, uart, nic, imem_data, zero32, zero1 },
  }) => [
    // instruction fetch
    cpu.instr_addr.to(imem.addr),
    imem.instruction.to(cpu.instruction),

    // data bus
    cpu.data_addr.to(bus_mux.addr),
    cpu.data_write.to(bus_mux.write_data),
    cpu.data_mem_read.to(bus_mux.mem_read),
    cpu.data_mem_write.to(bus_mux.mem_write),
    cpu.data_funct3.to(bus_mux.funct3),
    bus_mux.read_data.to(cpu.data_read),

    // CPU's vestigial net inputs tied off (networking is the NIC peripheral below)
    zero32.out.to(cpu.net_rx_data),
    zero1.out.to(cpu.net_rx_valid, cpu.net_rx_frame),

    // memory-mapped peripherals: dmem (p0), uart (p1), nic tx (p2) / rx (p3), imem-as-data (p4)
    bus_mux.local_addr.to(dmem.addr, uart.addr, nic.tx_addr, nic.rx_addr, imem_data.addr),
    bus_mux.write_data_out.to(dmem.write_data, uart.write_data, nic.tx_write_data),
    bus_mux.p0_read.to(dmem.mem_read),
    bus_mux.p0_write.to(dmem.mem_write),
    bus_mux.funct3_out.to(dmem.funct3),
    dmem.read_data.to(bus_mux.read_data_0),
    bus_mux.p1_read.to(uart.mem_read),
    bus_mux.p1_write.to(uart.mem_write),
    uart.read_data.to(bus_mux.read_data_1),
    bus_mux.p2_read.to(nic.tx_mem_read),
    bus_mux.p2_write.to(nic.tx_mem_write),
    nic.tx_read_data.to(bus_mux.read_data_2),
    bus_mux.p3_read.to(nic.rx_mem_read),
    bus_mux.p3_write.to(nic.rx_mem_write),
    nic.rx_read_data.to(bus_mux.read_data_3),
    // IMEM data port returns the raw aligned word; the CPU's WB-stage aligner
    // does byte/half extraction (an extra aligner here would extract twice).
    imem_data.instruction.to(bus_mux.read_data_4),

    // NIC network I/O (top level)
    inputs.net_rx_data.to(nic.net_rx_data),
    inputs.net_rx_valid.to(nic.net_rx_valid),
    inputs.net_rx_frame.to(nic.net_rx_frame),
    nic.net_tx_data.to(outputs.net_tx_data),
    nic.net_tx_valid.to(outputs.net_tx_valid),
    nic.net_tx_frame.to(outputs.net_tx_frame),

    // debug scan port + pipeline-stage PCs
    inputs.debug_addr.to(cpu.debug_addr),
    cpu.debug_value.to(outputs.debug_value),
    cpu.pc_out.to(outputs.pc_out),
    cpu.if_pc.to(outputs.if_pc),
    cpu.id_pc.to(outputs.id_pc),
    cpu.ex_pc.to(outputs.ex_pc),
    cpu.mem_pc4.to(outputs.mem_pc4),
    cpu.wb_pc4.to(outputs.wb_pc4),
  ],
});
