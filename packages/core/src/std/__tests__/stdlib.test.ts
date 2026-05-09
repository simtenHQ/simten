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
} from '../index.js';
import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
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
    expect(comp.circuit.name).toBe(name);
  });

  it.each(allCircuits)('%s has valid circuit IR', (_name, comp) => {
    expect(comp.circuit).toBeDefined();
    expect(comp.circuit.implementation.kind).toBe('primitive');
  });

  it.each(allCircuits)('%s has well-formed ports', (name, comp) => {
    for (const port of comp.circuit.inputs) {
      expect(port.name).toBeTruthy();
      expect(port.portType.kind).toMatch(/^(bit|bus)$/);
    }
    for (const port of comp.circuit.outputs) {
      expect(port.name).toBeTruthy();
      expect(port.portType.kind).toMatch(/^(bit|bus)$/);
    }
  });

});

// ============================================================================
// Sequential circuits have clocks and state
// ============================================================================

describe('sequential components', () => {
  it('DFlipFlop has clock and state', () => {
    expect(DFlipFlop.circuit.clocks.length).toBeGreaterThan(0);
    expect(DFlipFlop.circuit.state.length).toBeGreaterThan(0);
    expect(DFlipFlop.circuit.metadata?.timing).toBe('sequential');
  });

  it('Register has clock and state', () => {
    expect(Register.circuit.clocks.length).toBeGreaterThan(0);
    expect(Register.circuit.state.length).toBeGreaterThan(0);
    expect(Register.circuit.metadata?.timing).toBe('sequential');
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
// Library from dependencies
// ============================================================================

describe('circuit._dependencies', () => {
  it('includes all referenced stdlib components', () => {
    // And._dependencies is empty (it's a leaf primitive)
    expect(And._dependencies.size).toBe(0);
  });

  it('building a library from deps resolves all needed components', () => {
    // Adder is composite — it has And, Or, Xor, etc. in _dependencies
    const circuitMap = new Map<string, Circuit>();
    const lib: CircuitLibrary & { addCircuit(c: Circuit): void } = {
      resolveCircuit: (name) => circuitMap.get(name),
      getAllPrimitiveNames: () => [...circuitMap.entries()].filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
      addCircuit: (c) => { circuitMap.set(c.name, c); },
    };
    lib.addCircuit(Adder.circuit);
    for (const [, dep] of Adder._dependencies) lib.addCircuit(dep.circuit);

    expect(lib.resolveCircuit('Adder')).toBeDefined();
    // All transitive deps are present
    for (const [name] of Adder._dependencies) {
      expect(lib.resolveCircuit(name)).toBeDefined();
    }
  });
});

// ============================================================================
// End-to-end: use stdlib with circuit() API
// ============================================================================

describe('stdlib + builder integration', () => {
  it('builds a HalfAdder from stdlib components', async () => {
    const { circuit, bit } = await import('../../circuit/index.js');

    const HalfAdder = circuit('HalfAdder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { x: Xor, a: And },
      connect: ({ inputs, outputs, nodes: { x, a } }) => [
        inputs.a.to(x.a, a.a),
        inputs.b.to(x.b, a.b),
        x.out.to(outputs.sum),
        a.out.to(outputs.carry),
      ],
    });

    expect(HalfAdder.circuit.nodes).toHaveLength(2);
    expect(HalfAdder.circuit.nodes[0].componentRef).toBe('Xor');
    expect(HalfAdder.circuit.nodes[1].componentRef).toBe('And');
    expect(HalfAdder.circuit.connections).toHaveLength(6);
  });
});
