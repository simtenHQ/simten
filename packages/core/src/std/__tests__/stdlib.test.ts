/**
 * Standard Library Tests
 *
 * Verifies that:
 * 1. All stdlib circuits load without errors
 * 2. Each circuit produces valid Circuit IR matching existing PRIMITIVE_DEFINITIONS
 * 3. The stdlib CircuitLibrary resolves all components
 * 4. Stdlib components work in the simulation pipeline (end-to-end)
 */

import { describe, it, expect } from 'vitest';
import { PRIMITIVE_DEFINITIONS } from '../../simulator/primitives.js';
import {
  And, Or, Not, Xor, Nand, Nor, Xnor, Buffer,
  Adder, Subtractor, Multiplier, Comparator,
  Incrementer, LeftShifter, RightShifter,
  SignedAdder, SignedComparator, SignedMultiplier,
  BusAnd, BusOr, BusNot, BusXor,
  Mux, Decoder, Splitter, Splitter8to8, Combiner8to8, Concat, BitSlice, AddressCombiner, Probe,
  DFlipFlop, Register,
  ROM, RAM, DualPortRAM,
  Switch, Button, Led, Input, Output, Constant,
  SevenSegment, HexDisplay, Screen, RasterDisplay, Console,
  createStdLibrary,
  getAllStdCircuits,
} from '../index.js';
import type { BuiltCircuit } from '../../circuit/types.js';

// ============================================================================
// All components load
// ============================================================================

describe('stdlib circuits load', () => {
  const allCircuits: [string, BuiltCircuit][] = [
    // Logic
    ['And', And], ['Or', Or], ['Not', Not], ['Xor', Xor],
    ['Nand', Nand], ['Nor', Nor], ['Xnor', Xnor], ['Buffer', Buffer],
    // Arithmetic
    ['Adder', Adder], ['Subtractor', Subtractor], ['Multiplier', Multiplier],
    ['Comparator', Comparator], ['Incrementer', Incrementer],
    ['LeftShifter', LeftShifter], ['RightShifter', RightShifter],
    ['SignedAdder', SignedAdder], ['SignedComparator', SignedComparator],
    ['SignedMultiplier', SignedMultiplier],
    ['BusAnd', BusAnd], ['BusOr', BusOr], ['BusNot', BusNot], ['BusXor', BusXor],
    // Routing
    ['Mux', Mux], ['Decoder', Decoder],
    ['Splitter', Splitter], ['Splitter8to8', Splitter8to8],
    ['Combiner8to8', Combiner8to8], ['Concat', Concat],
    ['BitSlice', BitSlice], ['AddressCombiner', AddressCombiner], ['Probe', Probe],
    // Sequential
    ['DFlipFlop', DFlipFlop], ['Register', Register],
    // Memory
    ['ROM', ROM], ['RAM', RAM], ['DualPortRAM', DualPortRAM],
    // I/O
    ['Switch', Switch], ['Button', Button], ['Led', Led],
    ['Input', Input], ['Output', Output], ['Constant', Constant],
    // Display
    ['SevenSegment', SevenSegment], ['HexDisplay', HexDisplay],
    ['Screen', Screen], ['RasterDisplay', RasterDisplay], ['Console', Console],
  ];

  it.each(allCircuits)('%s has correct name', (name, comp) => {
    expect(comp.name).toBe(name);
  });

  it.each(allCircuits)('%s has valid circuit IR', (name, comp) => {
    expect(comp.circuit).toBeDefined();
    expect(comp.circuit.id).toBe(`circuit:${name}`);
    expect(comp.circuit.implementation.kind).toBe('primitive');
  });

  it.each(allCircuits)('%s matches PRIMITIVE_DEFINITIONS ports', (name, comp) => {
    const def = PRIMITIVE_DEFINITIONS[name];
    expect(def).toBeDefined();

    // Input ports match
    expect(comp.circuit.inputs.length).toBe(def.inputs.length);
    for (let i = 0; i < def.inputs.length; i++) {
      expect(comp.circuit.inputs[i].name).toBe(def.inputs[i].name);
      expect(comp.circuit.inputs[i].portType.kind).toBe(def.inputs[i].portType.kind);
    }

    // Output ports match
    expect(comp.circuit.outputs.length).toBe(def.outputs.length);
    for (let i = 0; i < def.outputs.length; i++) {
      expect(comp.circuit.outputs[i].name).toBe(def.outputs[i].name);
      expect(comp.circuit.outputs[i].portType.kind).toBe(def.outputs[i].portType.kind);
    }
  });

  it.each(allCircuits)('%s has _shape matching ports', (name, comp) => {
    const shape = comp._shape;
    expect(Object.keys(shape.inputs).length).toBe(comp.circuit.inputs.length);
    expect(Object.keys(shape.outputs).length).toBe(comp.circuit.outputs.length);
  });
});

// ============================================================================
// Sequential circuits have clocks and state
// ============================================================================

describe('sequential components', () => {
  it('DFlipFlop has clock and state', () => {
    expect(DFlipFlop.circuit.clocks.length).toBeGreaterThan(0);
    expect(DFlipFlop.circuit.state.length).toBeGreaterThan(0);
    expect(DFlipFlop.circuit.metadata?.kind).toBe('sequential');
  });

  it('Register has clock and state', () => {
    expect(Register.circuit.clocks.length).toBeGreaterThan(0);
    expect(Register.circuit.state.length).toBeGreaterThan(0);
    expect(Register.circuit.metadata?.kind).toBe('sequential');
  });

  it('RAM has clock and state', () => {
    expect(RAM.circuit.clocks.length).toBeGreaterThan(0);
    expect(RAM.circuit.state.length).toBeGreaterThan(0);
  });

  it('ROM has state (no clock — combinational read)', () => {
    expect(ROM.circuit.state.length).toBeGreaterThan(0);
    // ROM has no clock — reads are combinational
  });
});

// ============================================================================
// I/O circuits
// ============================================================================

describe('I/O circuits', () => {
  it('Switch has no inputs and one output', () => {
    expect(Switch.circuit.inputs).toHaveLength(0);
    expect(Switch.circuit.outputs).toHaveLength(1);
    expect(Switch.circuit.outputs[0].name).toBe('out');
  });

  it('Led has one input and no outputs', () => {
    expect(Led.circuit.inputs).toHaveLength(1);
    expect(Led.circuit.outputs).toHaveLength(0);
  });

  it('Switch is a source component (no inputs)', () => {
    expect(Switch.circuit.inputs).toHaveLength(0);
    expect(Switch.circuit.outputs).toHaveLength(1);
  });

  it('Button is a source component (no inputs)', () => {
    expect(Button.circuit.inputs).toHaveLength(0);
    expect(Button.circuit.outputs).toHaveLength(1);
  });
});

// ============================================================================
// Library helper
// ============================================================================

describe('createStdLibrary', () => {
  it('resolves all standard components', () => {
    const lib = createStdLibrary();

    for (const name of Object.keys(PRIMITIVE_DEFINITIONS)) {
      const circuit = lib.resolveCircuit(name);
      expect(circuit).toBeDefined();
      expect(circuit!.name).toBe(name);
    }
  });

  it('getAllPrimitiveNames returns all primitives', () => {
    const lib = createStdLibrary();
    const names = lib.getAllPrimitiveNames();

    for (const name of Object.keys(PRIMITIVE_DEFINITIONS)) {
      expect(names).toContain(name);
    }
  });

  it('addCircuit adds a custom component', () => {
    const lib = createStdLibrary();
    const custom = And.circuit;  // reuse And's circuit as a test
    const renamed = { ...custom, name: 'CustomAnd' };
    lib.addCircuit(renamed);

    expect(lib.resolveCircuit('CustomAnd')).toBeDefined();
  });
});

// ============================================================================
// getAllStdCircuits
// ============================================================================

describe('getAllStdCircuits', () => {
  it('returns all components', () => {
    const all = getAllStdCircuits();
    expect(all.length).toBeGreaterThanOrEqual(Object.keys(PRIMITIVE_DEFINITIONS).length);
  });

  it('each component has a unique name', () => {
    const all = getAllStdCircuits();
    const names = all.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ============================================================================
// End-to-end: use stdlib with builder API
// ============================================================================

describe('stdlib + builder integration', () => {
  it('builds a HalfAdder from stdlib components', async () => {
    const { circuit, bit } = await import('../../circuit/index.js');

    const HalfAdder = circuit('HalfAdder', {
      in: { a: bit, b: bit },
      out: { sum: bit, carry: bit },
      nodes: { x: Xor, a: And },
      connect: ({ in: inp, out, x, a }) => [
        inp.a.to(x.a, a.a),
        inp.b.to(x.b, a.b),
        x.out.to(out.sum),
        a.out.to(out.carry),
      ],
    });

    expect(HalfAdder.circuit.nodes).toHaveLength(2);
    expect(HalfAdder.circuit.nodes[0].componentRef).toBe('Xor');
    expect(HalfAdder.circuit.nodes[1].componentRef).toBe('And');
    expect(HalfAdder.circuit.connections).toHaveLength(6);
  });
});
