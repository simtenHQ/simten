/**
 * Standard Library — All built-in components
 *
 * Every component is defined with component() — full TypeScript type inference.
 * No fromPrimitive() bridge needed.
 *
 * Usage:
 *   import { And, Or, Register, RAM } from '@turing-incomplete/core/std'
 *   import { createStdLibrary } from '@turing-incomplete/core/std'
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
  RV32I_WBBypass, RV32I_LoadAlign, RV32I_HazardUnit,
  DualPortROM,
} from './rv32i.js';

// Networking
export {
  Eth_ProtocolDecoder, Eth_AddrClassifier, Eth_FrameInput,
  Eth_FrameParser, Eth_CRC32,
  MemBusMux, UART_TX, NIC_FIFO,
} from './networking.js';

// ============================================================================
// Library helper
// ============================================================================

import type { Circuit, ComponentLibrary } from '../types/circuit.js';
import type { BuiltComponent } from '../builder/types.js';

import * as logic from './logic.js';
import * as arithmetic from './arithmetic.js';
import * as routing from './routing.js';
import * as sequential from './sequential.js';
import * as memory from './memory.js';
import * as io from './io.js';
import * as display from './display.js';
import * as rv32i from './rv32i.js';
import * as networking from './networking.js';

/** All stdlib components */
const ALL_COMPONENTS: BuiltComponent[] = (() => {
  const byName = new Map<string, BuiltComponent>();
  for (const mod of [logic, arithmetic, routing, sequential, memory, io, display, rv32i, networking]) {
    for (const comp of Object.values(mod)) {
      if (comp && typeof comp === 'object' && 'name' in comp && 'circuit' in comp) {
        byName.set((comp as BuiltComponent).name, comp as BuiltComponent);
      }
    }
  }
  return Array.from(byName.values());
})();

/**
 * Create a ComponentLibrary from the standard library.
 */
export function createStdLibrary(): ComponentLibrary & { addCircuit(c: Circuit): void } {
  const circuits = new Map<string, Circuit>();

  for (const comp of ALL_COMPONENTS) {
    circuits.set(comp.name, comp.circuit);
  }

  return {
    resolveComponent(name: string): Circuit | undefined {
      return circuits.get(name);
    },
    getAllPrimitiveNames(): string[] {
      return Array.from(circuits.entries())
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([name]) => name);
    },
    addCircuit(circuit: Circuit): void {
      circuits.set(circuit.name, circuit);
    },
  };
}

/**
 * Get all stdlib components.
 */
export function getAllStdComponents(): BuiltComponent[] {
  return [...ALL_COMPONENTS];
}
