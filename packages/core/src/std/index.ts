/**
 * Standard Library — All built-in components
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

// ============================================================================
// Library helper
// ============================================================================

import type { Circuit, ComponentLibrary } from '../types/circuit.js';
import type { BuiltComponent } from '../builder/types.js';
import { PRIMITIVE_DEFINITIONS } from '../simulator/primitives.js';
import { fromPrimitive } from './from-primitive.js';

// Import named components for the explicit exports above
import * as logic from './logic.js';
import * as arithmetic from './arithmetic.js';
import * as routing from './routing.js';
import * as sequential from './sequential.js';
import * as memory from './memory.js';
import * as io from './io.js';
import * as display from './display.js';

/**
 * All stdlib components — includes both explicitly exported components
 * and any additional primitives from PRIMITIVE_DEFINITIONS that aren't
 * individually exported (e.g. DualPortROM, RV32I_Decode, networking, etc.)
 */
const ALL_COMPONENTS: BuiltComponent[] = (() => {
  // Start with explicitly exported components (keyed by name to dedup)
  const byName = new Map<string, BuiltComponent>();
  for (const mod of [logic, arithmetic, routing, sequential, memory, io, display]) {
    for (const comp of Object.values(mod)) {
      byName.set(comp.name, comp);
    }
  }
  // Add any remaining primitives not explicitly exported
  for (const [name, def] of Object.entries(PRIMITIVE_DEFINITIONS)) {
    if (!byName.has(name)) {
      byName.set(name, fromPrimitive(def));
    }
  }
  return Array.from(byName.values());
})();

/**
 * Create a ComponentLibrary from the standard library.
 * Compatible with the existing simulation pipeline.
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
 * Get all stdlib components as BuiltComponent array.
 */
export function getAllStdComponents(): BuiltComponent[] {
  return [...ALL_COMPONENTS];
}
