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

import type { Circuit } from '../circuit/builder-types.js';

// Arithmetic
export {
  Adder,
  BusAnd,
  BusNot,
  BusOr,
  BusXnor,
  BusXor,
  Comparator,
  Divider,
  FullAdder,
  Incrementer,
  LeftShifter,
  Modulo,
  Multiplier,
  RightShifter,
  SignedAdder,
  SignedComparator,
  SignedDivider,
  SignedModulo,
  SignedMultiplier,
  SignedRightShifter,
  Subtractor,
  WrappingMultiplier,
} from './arithmetic.js';
// Display
export { Console, HexDisplay, RasterDisplay, Screen, SevenSegment } from './display.js';
// I/O
export { Constant, Input, Led, Output, Switch } from './io.js';
// Logic Gates + bus-width logical / reduction operators
export {
  And,
  Buffer,
  LogicAnd,
  LogicNot,
  LogicOr,
  Nand,
  Nor,
  Not,
  Or,
  ReduceAnd,
  ReduceOr,
  ReduceXnor,
  ReduceXor,
  Xnor,
  Xor,
} from './logic.js';
// Gate-level reference builds for the canvas drill-down. Display only — never
// elaborated into a netlist. Re-exported here (not via `_allExports`) so the
// builders stay out of STDLIB_CIRCUITS; see made-of.ts and its test.
export { hasMadeOf, MADE_OF, MADE_OF_NAMES, type MadeOfBuilder } from './made-of.js';

// Memory
export { DualPortRAM, RAM, ROM, romFromBytes, romFromEntries, romFromWords } from './memory.js';
// MOS 6502 (cycle-accurate core — see ./mos6502-cpu.ts). Its bus and decode
// blocks stay internal; the core and the ALU are the public pieces.
export { MOS6502_ALU } from './mos6502.js';
export { MOS6502_Core } from './mos6502-cpu.js';
// Networking
export {
  Eth_AddrClassifier,
  Eth_CRC32,
  Eth_FrameInput,
  Eth_FrameParser,
  Eth_ProtocolDecoder,
  MemBusMux,
  NIC_FIFO,
  UART_RX,
  UART_TX,
} from './networking.js';
// Routing / Plexers / Utilities
export {
  AddressCombiner,
  BitSlice,
  Combiner,
  Combiner8to8,
  Concat,
  Decoder,
  Mux,
  NibbleSplitter,
  Probe,
  Splitter,
  Splitter8to8,
} from './routing.js';
// RV32I
export {
  DualPortROM,
  RV32I_ALU,
  RV32I_BranchComp,
  RV32I_Control,
  RV32I_DataMem,
  RV32I_Decode,
  RV32I_ForwardingUnit,
  RV32I_HazardUnit,
  RV32I_ImmGen,
  RV32I_InstrMem,
  RV32I_LoadAlign,
  RV32I_LoadAlignFull,
  RV32I_NextPCMux,
  RV32I_RegisterFile,
  RV32I_WBBypass,
  RV32I_WritebackMux,
} from './rv32i.js';
// RV32I assembled CPU core (single source of truth — see ./rv32i-cpu.ts)
export { RV32I_Core } from './rv32i-cpu.js';
// Sequential
export { DFlipFlop, Register } from './sequential.js';
// Reconstruction / bit-manipulation (importer authoring constructs)
export { DynamicSlice, SignExtend, Slice, ZeroExtend } from './wiring.js';

// ============================================================================
// Aggregate circuit list
// ============================================================================
//
// Pre-filtered, well-typed list of every Circuit in the stdlib. Consumers
// that need to iterate primitives (editor type-gen, library registration,
// elaboration scope) should use this instead of `Object.values(std).filter(...)`,
// which breaks the moment a non-circuit helper (like romFromBytes) is exported.

import * as Arithmetic from './arithmetic.js';
import * as Display from './display.js';
import * as IO from './io.js';
import * as Logic from './logic.js';
import * as Memory from './memory.js';
import { MOS6502_ALU } from './mos6502.js';
import * as MOS6502Cpu from './mos6502-cpu.js';
import * as Networking from './networking.js';
import * as Routing from './routing.js';
import * as RV32I from './rv32i.js';
import * as RV32ICpu from './rv32i-cpu.js';
import * as Sequential from './sequential.js';
import * as Reconstruction from './wiring.js';

const isCircuit = (v: unknown): v is Circuit => !!v && typeof v === 'object' && 'circuit' in v;

const _allExports: unknown[] = [
  ...Object.values(Logic),
  ...Object.values(Arithmetic),
  ...Object.values(Routing),
  ...Object.values(Reconstruction),
  ...Object.values(Sequential),
  ...Object.values(Memory),
  ...Object.values(IO),
  ...Object.values(Display),
  ...Object.values(RV32I),
  ...Object.values(RV32ICpu),
  MOS6502_ALU,
  ...Object.values(MOS6502Cpu),
  ...Object.values(Networking),
];

// Materialize parameterized factories with their default options so the
// editor/library has a concrete `Circuit` to register for each one.
// Singletons pass through unchanged.
const _materialize = (v: unknown): Circuit | null => {
  if (isCircuit(v)) return v;
  if (typeof v === 'function') {
    try {
      const built = (v as () => unknown)();
      return isCircuit(built) ? built : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const STDLIB_CIRCUITS: readonly Circuit[] = Object.freeze(
  _allExports.map(_materialize).filter((c): c is Circuit => c !== null),
);
