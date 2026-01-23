/**
 * Primitive Component Definitions
 *
 * Defines all primitive (kernel-implemented) components.
 * These are the building blocks for all circuits.
 */

import type { Circuit, BitValue, BusValue } from '../types/ir-v0.1';
import { bitType, busType } from '../types/ir-v0.1';
import type { Component } from '../types/ir';
import {
  createCombinationalEvaluator,
  createSequentialEvaluator,
  type PrimitiveEvaluator as PrimitiveEvaluatorInterface,
  type ClockEdges,
} from './primitive-interface';

/**
 * Unified primitive evaluator registry
 * Uses the PrimitiveEvaluatorInterface with evaluate() and updateState() methods
 */
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluatorInterface> = {
  // ============================================================================
  // Basic Logic Gates
  // ============================================================================

  And: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a && b]]);
  }),

  Or: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a || b]]);
  }),

  Not: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('in') as boolean;
    return new Map([['out', !a]]);
  }),

  Nand: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', !(a && b)]]);
  }),

  Nor: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', !(a || b)]]);
  }),

  Xor: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a !== b]]);
  }),

  Xnor: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a === b]]);
  }),

  Buffer: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('in') as boolean;
    return new Map([['out', a]]);
  }),

  // ============================================================================
  // Arithmetic Components
  // ============================================================================

  Incrementer: createCombinationalEvaluator((inputs) => {
    const value = inputs.get('in') as number;
    const width = 8; // Default to 8-bit, will be parameterized later
    const maxValue = (1 << width) - 1;
    const result = (value + 1) & maxValue; // Wrap around on overflow
    return new Map([['out', result]]);
  }),

  // ============================================================================
  // I/O Components
  // ============================================================================

  Switch: createCombinationalEvaluator((_inputs) => {
    // Switch output is controlled externally, not evaluated
    // This evaluator is just for consistency
    return new Map([['out', false]]);
  }),

  Led: createCombinationalEvaluator((_inputs) => {
    // LED is an output component, no outputs
    // This evaluator is just for consistency
    return new Map();
  }),

  // ============================================================================
  // Bus Operations (Multi-bit)
  // ============================================================================

  BusAnd: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a & b]]);
  }),

  BusOr: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a | b]]);
  }),

  BusNot: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('in') as number;
    // Note: Need to mask to the appropriate width
    // This is handled by the simulator based on port type
    return new Map([['out', ~a]]);
  }),

  BusXor: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a ^ b]]);
  }),

  // ============================================================================
  // Arithmetic Operations
  // ============================================================================

  /**
   * Parameterized n-bit adder
   * Parameters: width (default: 8)
   * Inputs: a (n-bit), b (n-bit), carry_in (1-bit, optional)
   * Outputs: sum (n-bit), carry_out (1-bit)
   */
  Adder: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

    // Get width from metadata (passed as part of inputs map with special key)
    // For now, we'll infer width from the values or use a sensible default
    const width = inputs.get('__width') as number ?? 8;
    const mask = (1 << width) - 1;

    const result = a + b + carryIn;
    const sum = result & mask;
    const carryOut = (result >> width) !== 0;

    return new Map<string, boolean | number>([
      ['sum', sum],
      ['carry_out', carryOut],
    ]);
  }),

  /**
   * Bit slice extraction (wire routing + masking)
   * Extracts bits [low..high] from input, zero-extends to 8 bits
   * Hardware: Just wire routing, no logic gates
   * Inputs: in (8-bit)
   * Parameters: low (bit index), high (bit index)
   * Outputs: out (8-bit, zero-padded)
   *
   * Example: BitSlice with low=0, high=2 extracts bits 0-2 (range 0-7)
   * Used for: Power-of-2 modulo, register field extraction, bit masking
   *
   * For non-power-of-2 bounds (e.g., 0-9), use Comparator + Adder + Mux:
   *   if (x >= 10) x -= 10
   *   if (x < 0)   x += 10
   */
  BitSlice: createCombinationalEvaluator((inputs) => {
    const value = inputs.get('in') as number;
    // Parameters would come from node.arguments, but for now use defaults
    const low = (inputs.get('__low') as number) ?? 0;
    const high = (inputs.get('__high') as number) ?? 2;

    // Extract bits [low..high]
    const numBits = high - low + 1;
    const mask = (1 << numBits) - 1;
    const result = (value >> low) & mask;

    return new Map([['out', result]]);
  }),

  /**
   * Parameterized n×n bit multiplier
   * Parameters: width (default: 8)
   * Inputs: a (n-bit), b (n-bit)
   * Outputs: product (2n-bit)
   */
  Multiplier: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;

    const width = inputs.get('__width') as number ?? 8;
    const mask = (1 << (width * 2)) - 1;

    const product = (a * b) & mask;

    return new Map([['product', product]]);
  }),

  /**
   * Parameterized n-bit comparator
   * Parameters: width (default: 8)
   * Inputs: a (n-bit), b (n-bit)
   * Outputs: eq (equal), lt (less than), gt (greater than)
   */
  Comparator: createCombinationalEvaluator((inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;

    return new Map([
      ['eq', a === b],
      ['lt', a < b],
      ['gt', a > b],
    ]);
  }),

  // ============================================================================
  // Plexers (Multiplexers and Decoders)
  // ============================================================================

  /**
   * Parameterized multiplexer
   * Parameters: inputs (2/4/8, default: 2), width (default: 1 for bit, >1 for bus)
   * Inputs: in0, in1, ..., inN, sel (log2(N)-bit)
   * Outputs: out
   */
  Mux: createCombinationalEvaluator((inputs) => {
    const inputCount = inputs.get('__input_count') as number ?? 2;
    const width = inputs.get('__width') as number ?? 1;
    const sel = inputs.get('sel') as number;

    // Clamp selector to valid range
    const actualSel = Math.min(sel, inputCount - 1);

    // Get the selected input (type assertion needed because Map values include parameters)
    const value = inputs.get(`in${actualSel}`) as BitValue | BusValue | undefined;

    return new Map([['out', value ?? (width === 1 ? false : 0)]]);
  }),

  /**
   * Parameterized decoder
   * Parameters: inputs (n, default: 2)
   * Inputs: in (n-bit)
   * Outputs: out0, out1, ..., out(2^n - 1)
   */
  Decoder: createCombinationalEvaluator((inputs) => {
    const inputWidth = inputs.get('__input_width') as number ?? 2;
    const inputValue = inputs.get('in') as number;
    const outputCount = 1 << inputWidth;

    const outputs = new Map<string, boolean | number>();
    for (let i = 0; i < outputCount; i++) {
      outputs.set(`out${i}`, i === inputValue);
    }

    return outputs;
  }),

  // ============================================================================
  // Memory and Utility
  // ============================================================================

  /**
   * Read-only memory with initialization
   * Parameters: addr_width (default: 8), data_width (default: 8)
   * Inputs: addr (addr_width-bit)
   * Outputs: data_out (data_width-bit)
   *
   * Note: ROM content is stored in component state (initialized once)
   */
  ROM: createSequentialEvaluator(
    (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const data = memory.get(addr) ?? 0;

      return new Map([['data_out', data]]);
    },
    (_inputs, currentState, _clockEdges) => {
      // ROM is read-only, state never changes
      return currentState;
    }
  ),

  /**
   * Constant value source
   * Parameters: value (number or boolean), width (default: inferred from value)
   * Outputs: out
   */
  Constant: createCombinationalEvaluator((inputs) => {
    // __value is a parameter (not an input port), but we output it as a signal
    const value = inputs.get('__value') as BitValue | BusValue | undefined;
    return new Map([['out', value ?? 0]]);
  }),

  /**
   * Splitter - splits a bus into smaller buses or bits
   * Parameters: width_in (total input width), widths_out (array of output widths)
   * Inputs: in (width_in-bit)
   * Outputs: out0, out1, ..., outN (each with specified width)
   */
  Splitter: createCombinationalEvaluator((inputs) => {
    const inputValue = inputs.get('in') as number;
    const widthsOutParam = inputs.get('__widths_out');
    const widthsOut = (Array.isArray(widthsOutParam) ? widthsOutParam : [1, 1]) as number[];

    const outputs = new Map<string, boolean | number>();
    let bitOffset = 0;

    for (let i = 0; i < widthsOut.length; i++) {
      const width = widthsOut[i];
      const mask = (1 << width) - 1;
      const value = (inputValue >> bitOffset) & mask;

      if (width === 1) {
        outputs.set(`out${i}`, value !== 0);
      } else {
        outputs.set(`out${i}`, value);
      }

      bitOffset += width;
    }

    return outputs;
  }),

  /**
   * Splitter8to8 - splits an 8-bit bus into 8 individual bits
   * Fixed configuration of Splitter with widths_out = [1,1,1,1,1,1,1,1]
   * Inputs: in (8-bit)
   * Outputs: bit0, bit1, bit2, bit3, bit4, bit5, bit6, bit7 (each 1-bit)
   */
  Splitter8to8: createCombinationalEvaluator((inputs) => {
    const inputValue = inputs.get('in') as number;
    const outputs = new Map<string, boolean | number>();

    // Extract each bit (bit0 is LSB, bit7 is MSB)
    for (let i = 0; i < 8; i++) {
      const bitValue = (inputValue >> i) & 1;
      outputs.set(`bit${i}`, bitValue !== 0);
    }

    return outputs;
  }),

  /**
   * Debug observation point
   * Passes through the input value unchanged
   * Used for debugging and visualization
   */
  Probe: createCombinationalEvaluator((inputs) => {
    // Get actual input value (not a parameter)
    const value = inputs.get('in') as BitValue | BusValue | undefined;
    return new Map([['out', value ?? false]]);
  }),

  /**
   * Push button input (momentary)
   * Outputs: out (1-bit)
   * State is controlled externally by user interaction
   */
  Button: createCombinationalEvaluator((_inputs) => {
    // Button output is controlled externally
    return new Map([['out', false]]);
  }),

  /**
   * Multi-bit numeric input
   * Parameters: width (default: 8)
   * Outputs: out (width-bit)
   * Value is controlled externally by user interaction
   */
  Input: createCombinationalEvaluator((inputs) => {
    // Get current value from component state (set by UI)
    // Default to 0 if not set
    const value = (inputs.get('__value') as number) ?? 0;
    return new Map([['out', value]]);
  }),

  // ============================================================================
  // Display Components
  // ============================================================================

  /**
   * 7-segment display
   * Inputs: in (4-bit for hex, or 7-bit for direct segment control)
   * No outputs (display component)
   */
  SevenSegment: createCombinationalEvaluator((_inputs) => {
    // Display component - no outputs
    return new Map();
  }),

  /**
   * Hexadecimal display
   * Inputs: in (n-bit, default: 8-bit)
   * No outputs (display component)
   */
  HexDisplay: createCombinationalEvaluator((_inputs) => {
    // Display component - no outputs
    return new Map();
  }),

  /**
   * Screen (Memory-Mapped Display)
   * 8x8 pixel grid that reads RAM addresses 0-63 via DMA-like state access
   * Simulates real display controllers (VIC-II, PPU, GPU)
   * No inputs - reads RAM state directly (handled in projection phase)
   * No outputs - display component
   */
  Screen: createCombinationalEvaluator((_inputs, _currentState, context) => {
    // Screen performs burst DMA - reads all 64 addresses from RAM in one evaluation
    // This simulates a display controller reading the framebuffer during VBLANK
    //
    // In real hardware:
    // - Display refresh happens at 60Hz (16ms period)
    // - During VBLANK (~1ms), display controller burst-reads the framebuffer
    // - Game logic runs at 10Hz (100ms period)
    // - Display shows stable image between refreshes
    //
    // In our simulation:
    // - Screen reads all 64 bytes from RAM each evaluation
    // - The explicit wiring (screen.addrB -> ram.addrB) is kept for documentation
    // - This is architecturally correct: displays DO burst-read memory

    // Dummy output - actual pixel data is stored in context for projection
    // The addrB output exists for circuit diagram clarity but isn't actively scanned
    return new Map([['addrB', 0]]);
  }),

  // ============================================================================
  // Sequential Components (Stateful)
  // ============================================================================

  DFlipFlop: createSequentialEvaluator(
    // Evaluate: Return outputs based on current state
    (inputs, currentState) => {
      const state = (currentState ?? false) as boolean;
      return new Map([
        ['q', state],
        ['q_bar', !state],
      ]);
    },
    // UpdateState: Capture D input on rising clock edge
    (inputs, currentState, clockEdges) => {
      const d = inputs.get('d') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Update state on rising edge
      if (edge === 'rising') {
        return d;
      }

      // Otherwise, keep current state
      return currentState;
    }
  ),

  Register: createSequentialEvaluator(
    // Evaluate: Return output based on current state
    (inputs, currentState) => {
      const state = (currentState ?? 0) as number;
      return new Map([['q', state]]);
    },
    // UpdateState: Write data when write enable is high
    (inputs, currentState, clockEdges) => {
      const data = inputs.get('data') as number;
      const we = inputs.get('we') as boolean;

      // Update state when write enable is high
      if (we) {
        return data;
      }

      // Otherwise, keep current state
      return currentState;
    }
  ),

  RAM: createSequentialEvaluator(
    // Evaluate: Return data at current address (combinational read)
    (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const data = memory.get(addr) ?? 0;
      return new Map([['data_out', data]]);
    },
    // UpdateState: Write data on rising clock edge with write enable
    (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const dataIn = inputs.get('data_in') as number;
      const we = inputs.get('we') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Write on rising edge with write enable
      if (edge === 'rising' && we) {
        // Create a new Map to avoid mutation
        const newMemory = new Map(memory);
        newMemory.set(addr, dataIn);
        return newMemory;
      }

      // Otherwise, keep current memory
      return memory;
    }
  ),

  DualPortRAM: createSequentialEvaluator(
    // Evaluate: Both ports read combinationally
    (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const addrB = inputs.get('addrB') as number;
      const dataA = memory.get(addrA) ?? 0;
      const dataB = memory.get(addrB) ?? 0;
      return new Map([
        ['dataA', dataA],
        ['dataB', dataB],
      ]);
    },
    // UpdateState: Port A writes on rising clock edge with write enable
    (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const dataA = inputs.get('dataA') as number;
      const weA = inputs.get('weA') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Port A: Write on rising edge with write enable
      if (edge === 'rising' && weA) {
        // Create a new Map to avoid mutation
        const newMemory = new Map(memory);
        newMemory.set(addrA, dataA);
        return newMemory;
      }

      // Otherwise, keep current memory
      return memory;
    }
  ),
};

/**
 * Create primitive circuit definitions
 */

function createPrimitiveCircuit(
  name: string,
  inputs: Array<{ name: string; portType: { kind: 'bit' } | { kind: 'bus'; width: number } }>,
  outputs: Array<{ name: string; portType: { kind: 'bit' } | { kind: 'bus'; width: number } }>,
  description?: string
): Circuit {
  return {
    id: `primitive:${name}`,
    name,
    parameters: [],
    inputs,
    outputs,
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description,
    },
  };
}

/**
 * All primitive component definitions
 */
export const PRIMITIVES: Circuit[] = [
  // ============================================================================
  // Basic Logic Gates
  // ============================================================================

  createPrimitiveCircuit(
    'And',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical AND gate - outputs true when both inputs are true'
  ),

  createPrimitiveCircuit(
    'Or',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical OR gate - outputs true when at least one input is true'
  ),

  createPrimitiveCircuit(
    'Not',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Logical NOT gate - inverts the input'
  ),

  createPrimitiveCircuit(
    'Nand',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical NAND gate - outputs false only when both inputs are true'
  ),

  createPrimitiveCircuit(
    'Nor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical NOR gate - outputs true only when both inputs are false'
  ),

  createPrimitiveCircuit(
    'Xor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical XOR gate - outputs true when inputs are different'
  ),

  createPrimitiveCircuit(
    'Xnor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical XNOR gate - outputs true when inputs are the same'
  ),

  createPrimitiveCircuit(
    'Buffer',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Buffer - passes the input through unchanged'
  ),

  // ============================================================================
  // Arithmetic Components
  // ============================================================================

  createPrimitiveCircuit(
    'Incrementer',
    [{ name: 'in', portType: busType(8) }],
    [{ name: 'out', portType: busType(8) }],
    'Incrementer - adds 1 to the input (wraps around at 255)'
  ),

  // ============================================================================
  // I/O Components
  // ============================================================================

  createPrimitiveCircuit(
    'Switch',
    [],
    [{ name: 'out', portType: bitType() }],
    'User-controllable input switch'
  ),

  createPrimitiveCircuit(
    'Led',
    [{ name: 'in', portType: bitType() }],
    [],
    'Visual output LED indicator'
  ),

  // ============================================================================
  // Bus Operations (8-bit examples)
  // ============================================================================

  createPrimitiveCircuit(
    'BusAnd',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise AND operation on 8-bit buses'
  ),

  createPrimitiveCircuit(
    'BusOr',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise OR operation on 8-bit buses'
  ),

  createPrimitiveCircuit(
    'BusNot',
    [{ name: 'in', portType: busType(8) }],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise NOT operation on 8-bit bus'
  ),

  createPrimitiveCircuit(
    'BusXor',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise XOR operation on 8-bit buses'
  ),

  // ============================================================================
  // Sequential Components (Stateful)
  // ============================================================================

  // DFlipFlop - manually defined to include clocks and state
  {
    id: 'primitive:DFlipFlop',
    name: 'DFlipFlop',
    parameters: [],
    inputs: [{ name: 'd', portType: bitType() }],
    outputs: [
      { name: 'q', portType: bitType() },
      { name: 'q_bar', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dff-state',
        name: 'value',
        stateType: bitType(),
        initialValue: false,
      },
    ],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description: 'D Flip-Flop - stores 1 bit of state, updates on rising clock edge',
    },
  },

  // Register - manually defined to include clocks and state
  {
    id: 'primitive:Register',
    name: 'Register',
    parameters: [],
    inputs: [
      { name: 'data', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'q', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'reg-state',
        name: 'value',
        stateType: busType(8),
        initialValue: 0,
      },
    ],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description: '8-bit Register - stores data when write enable is high',
    },
  },

  // RAM - manually defined to include clocks and state
  {
    id: 'primitive:RAM',
    name: 'RAM',
    parameters: [],
    inputs: [
      { name: 'addr', portType: busType(8) },
      { name: 'data_in', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'data_out', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'ram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description: '256x8 RAM - reads are combinational, writes occur on rising clock edge with write enable',
    },
  },

  // DualPortRAM - two independent ports for simultaneous access
  {
    id: 'primitive:DualPortRAM',
    name: 'DualPortRAM',
    parameters: [],
    inputs: [
      { name: 'addrA', portType: busType(8) },  // Port A address (write/read port)
      { name: 'dataA', portType: busType(8) },  // Port A data input (for writes)
      { name: 'weA', portType: bitType() },     // Port A write enable
      { name: 'addrB', portType: busType(8) },  // Port B address (read port)
    ],
    outputs: [
      { name: 'dataA', portType: busType(8) },  // Port A data output (for reads)
      { name: 'dataB', portType: busType(8) },  // Port B data output
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dualram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description: '256x8 Dual-Port RAM - Both ports read combinationally. Port A writes on clock edge with write enable. Port B is read-only. Provides framebuffer snapshots.',
      provides: ['FrameSnapshotSource'], // Implements burst DMA snapshot interface
    },
  },

  // ============================================================================
  // Arithmetic Operations
  // ============================================================================

  createPrimitiveCircuit(
    'Adder',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'carry_in', portType: bitType() },
    ],
    [
      { name: 'sum', portType: busType(8) },
      { name: 'carry_out', portType: bitType() },
    ],
    'Parameterized n-bit adder with carry in/out (default: 8-bit)'
  ),

  createPrimitiveCircuit(
    'Multiplier',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'product', portType: busType(16) }],
    'Parameterized n×n bit multiplier, outputs 2n-bit product (default: 8×8=16-bit)'
  ),

  createPrimitiveCircuit(
    'BitSlice',
    [{ name: 'in', portType: busType(8) }],
    [{ name: 'out', portType: busType(8) }],
    'Extract bits [low..high] from input (wire routing, zero logic cost). Default: bits 0-2 for modulo-8. For non-power-of-2 bounds, use Comparator+Adder+Mux.'
  ),

  createPrimitiveCircuit(
    'Comparator',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [
      { name: 'eq', portType: bitType() },
      { name: 'lt', portType: bitType() },
      { name: 'gt', portType: bitType() },
    ],
    'Parameterized n-bit comparator (default: 8-bit)'
  ),

  // ============================================================================
  // Plexers
  // ============================================================================

  createPrimitiveCircuit(
    'Mux',
    [
      { name: 'in0', portType: bitType() },
      { name: 'in1', portType: bitType() },
      { name: 'sel', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Parameterized multiplexer (default: 2-input, 1-bit)'
  ),

  createPrimitiveCircuit(
    'Decoder',
    [{ name: 'in', portType: busType(2) }],
    [
      { name: 'out0', portType: bitType() },
      { name: 'out1', portType: bitType() },
      { name: 'out2', portType: bitType() },
      { name: 'out3', portType: bitType() },
    ],
    'Parameterized n-to-2^n decoder (default: 2-to-4)'
  ),

  // ============================================================================
  // Memory and Utility
  // ============================================================================

  createPrimitiveCircuit(
    'ROM',
    [{ name: 'addr', portType: busType(8) }],
    [{ name: 'data_out', portType: busType(8) }],
    'Read-only memory with initialization (default: 256×8)'
  ),

  createPrimitiveCircuit(
    'Constant',
    [],
    [{ name: 'out', portType: bitType() }],
    'Constant value source (parameterized by value)'
  ),

  createPrimitiveCircuit(
    'Splitter',
    [{ name: 'in', portType: busType(8) }],
    [
      { name: 'out0', portType: busType(4) },
      { name: 'out1', portType: busType(4) },
    ],
    'Bus splitter - splits a bus into smaller buses (default: 8-bit to 2×4-bit)'
  ),

  createPrimitiveCircuit(
    'Splitter8to8',
    [{ name: 'in', portType: busType(8) }],
    [
      { name: 'bit0', portType: bitType() },
      { name: 'bit1', portType: bitType() },
      { name: 'bit2', portType: bitType() },
      { name: 'bit3', portType: bitType() },
      { name: 'bit4', portType: bitType() },
      { name: 'bit5', portType: bitType() },
      { name: 'bit6', portType: bitType() },
      { name: 'bit7', portType: bitType() },
    ],
    'Splits an 8-bit bus into 8 individual bit outputs (bit0=LSB, bit7=MSB)'
  ),

  createPrimitiveCircuit(
    'Probe',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Debug observation point - passes signal through unchanged'
  ),

  // ============================================================================
  // I/O Components
  // ============================================================================

  createPrimitiveCircuit(
    'Button',
    [],
    [{ name: 'out', portType: bitType() }],
    'Push button input (momentary, user-controlled)'
  ),

  createPrimitiveCircuit(
    'Input',
    [],
    [{ name: 'out', portType: busType(8) }],
    'Multi-bit numeric input (runtime editable, default: 8-bit)'
  ),

  createPrimitiveCircuit(
    'SevenSegment',
    [{ name: 'in', portType: busType(4) }],
    [],
    '7-segment display for hexadecimal digits (0-F)'
  ),

  createPrimitiveCircuit(
    'HexDisplay',
    [{ name: 'in', portType: busType(8) }],
    [],
    'Hexadecimal display for multi-bit values (default: 8-bit)'
  ),

  // Screen - manually defined to include inputs and outputs (combinational sink)
  {
    id: 'primitive:Screen',
    name: 'Screen',
    parameters: [],
    inputs: [{ name: 'dataIn', portType: busType(8) }],   // Pixel data from RAM (documentation)
    outputs: [{ name: 'addrB', portType: busType(8) }],  // Address to read from RAM (documentation)
    clocks: [],  // No clock - burst DMA happens each evaluation
    state: [],   // No state - reads directly from RAM via snapshot
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description: '8x8 pixel display - consumes framebuffer via FrameSnapshotSource (simulates VBLANK burst DMA)',
      kind: 'sink', // Sink component - outputs don't feed back into circuit
      consumes: ['FrameSnapshotSource'], // Requires exactly one connected snapshot provider
    },
  },
];

/**
 * Get all primitive circuits
 */
export function getPrimitives(): Circuit[] {
  return PRIMITIVES;
}

/**
 * Get primitive evaluator by name
 */
export function getPrimitiveEvaluator(name: string): PrimitiveEvaluatorInterface | undefined {
  return PRIMITIVE_EVALUATORS[name];
}

/**
 * Check if a component is a primitive
 */
export function isPrimitive(name: string): boolean {
  return PRIMITIVES.some((p) => p.name === name);
}

/**
 * Get primitive circuit definition by name
 */
export function getPrimitiveCircuit(name: string): Circuit | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}

/**
 * Create initial component state for a primitive
 *
 * This is the SINGLE SOURCE OF TRUTH for creating primitive components.
 * All component creation flows through this function, which handles:
 * - All 31+ primitive types from the PRIMITIVES array
 * - Proper initial state for each component type
 * - Type-specific properties (width, memory, etc.)
 *
 * Architecture Notes:
 * - This replaces the old switch statement in ir-store.ts
 * - No need for individual if statements per component type
 * - Automatically handles new primitives added to PRIMITIVES array
 * - Returns null for unknown types (lets caller handle the error)
 *
 * Type Safety:
 * - Returns properly typed Component union (not Record<string, any>)
 * - New primitives use UserDefinedComponent (type: string) from union
 * - Each property is explicitly typed and type-checked
 * - No use of `any` type - full TypeScript safety
 *
 * @param id - Unique component identifier
 * @param type - Component type name (must match a name in PRIMITIVES array)
 * @param initialValue - Optional initial value for input/stateful components
 * @returns Component object with proper initial state, or null if type is unknown
 */
export function createPrimitiveComponent(
  id: string,
  type: string,
  initialValue?: boolean | number
): Component | null {
  // Verify this is actually a primitive
  const primitive = getPrimitiveCircuit(type);
  if (!primitive) {
    return null;
  }

  // Build the component object with proper typing
  // Base component with id and type (satisfies ComponentBase)
  //
  // Note: TypeScript doesn't like adding properties to objects that satisfy
  // a discriminated union because it can't verify which variant we're creating.
  // We use type assertions to tell TypeScript these objects satisfy Component.
  // This is safe because UserDefinedComponent accepts any string type and
  // doesn't restrict additional properties (it's an open interface).
  const baseComponent = { id, type };

  // Determine initial state based on component type
  // This encapsulates the logic for what state each primitive needs
  //
  // Design principle: Explicit is better than implicit
  // We explicitly handle each stateful/parameterized component type
  // rather than trying to infer state from the Circuit definition
  switch (type) {
    // Input components (user-controllable)
    case 'Switch': {
      const value: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { ...baseComponent, value } as Component;
    }

    case 'Input': {
      const value: number = typeof initialValue === 'number' ? initialValue : 0;
      const width: number = 8; // Default width
      return { ...baseComponent, value, width } as Component;
    }

    case 'Button': {
      const value: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { ...baseComponent, value } as Component;
    }

    // Output components (display)
    case 'Led': {
      const value: boolean = false;
      return { ...baseComponent, value } as Component;
    }

    case 'HexDisplay': {
      const value: number = 0;
      const width: number = 8; // Default width
      return { ...baseComponent, value, width } as Component;
    }

    case 'Screen': {
      // Memory-mapped display component
      // No value property needed - pixel data comes from RAM via DMA
      return { ...baseComponent } as Component;
    }

    case 'SevenSegment': {
      const value: number = 0;
      return { ...baseComponent, value } as Component;
    }

    // Sequential components (stateful)
    case 'DFlipFlop': {
      const state: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { ...baseComponent, state } as Component;
    }

    case 'Register': {
      const width: number = 8; // Default width
      const state: number = typeof initialValue === 'number' ? initialValue : 0;
      return { ...baseComponent, width, state } as Component;
    }

    case 'RAM': {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { ...baseComponent, addressWidth, dataWidth, memory } as Component;
    }

    case 'DualPortRAM': {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { ...baseComponent, addressWidth, dataWidth, memory } as Component;
    }

    case 'ROM': {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { ...baseComponent, addressWidth, dataWidth, memory } as Component;
    }

    // Parameterized components
    case 'Constant': {
      const value: boolean | number = initialValue ?? 0;
      return { ...baseComponent, value } as Component;
    }

    // All other primitives (combinational logic, arithmetic, etc.)
    // These don't need initial state beyond id and type
    // They satisfy UserDefinedComponent interface
    default:
      return baseComponent as Component;
  }
}
