/**
 * Standard Library — All built-in circuits
 *
 * Every circuit is defined with circuit() — full TypeScript type inference.
 * No fromPrimitive() bridge needed.
 *
 * Usage:
 *   import { And, Or, Register, RAM } from '@simten/core/std'
 *   import { createStdLibrary } from '@simten/core/std'
 */

// Logic Gates
export { And, Or, Not, Nand, Nor, Xor, Xnor, Buffer } from './logic.js';

// Arithmetic
export {
  Incrementer, Adder, Subtractor, Multiplier, Comparator,
  LeftShifter, RightShifter,
  SignedAdder, SignedComparator, SignedMultiplier,
  BusAnd, BusOr, BusNot, BusXor,
} from './arithmetic.js';

// Routing / Plexers / Utilities
export {
  Mux, Decoder,
  Splitter, Splitter8to8, Combiner8to8, Concat, BitSlice, AddressCombiner,
  Probe,
} from './routing.js';

// Sequential
export { DFlipFlop, Register } from './sequential.js';

// Memory
export { ROM, RAM, DualPortRAM } from './memory.js';

// I/O
export { Switch, Button, Led, Input, Output, Constant } from './io.js';

// Display
export { SevenSegment, HexDisplay, Screen, RasterDisplay, Console } from './display.js';

// RV32I
export {
  RV32I_Decode, RV32I_ALU, RV32I_ImmGen, RV32I_Control,
  RV32I_BranchComp, RV32I_RegisterFile, RV32I_InstrMem, RV32I_DataMem,
  RV32I_WritebackMux, RV32I_NextPCMux, RV32I_ForwardingUnit,
  RV32I_WBBypass, RV32I_LoadAlign, RV32I_LoadAlignFull, RV32I_HazardUnit,
  DualPortROM,
} from './rv32i.js';

// Networking
export {
  Eth_ProtocolDecoder, Eth_AddrClassifier, Eth_FrameInput,
  Eth_FrameParser, Eth_CRC32,
  MemBusMux, UART_TX, NIC_FIFO,
} from './networking.js';


