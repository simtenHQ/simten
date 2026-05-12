import { describe, it, expect } from 'vitest';
import { circuit } from '../circuit.js';
import { bit, bus } from '../bit-bus.js';
import { getCircuitEval } from '../eval-registry.js';
import type { BuiltCircuit } from '../types.js';

// ============================================================================
// Helper: pre-built leaf components for use as nodes
// ============================================================================

const And = circuit('And', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
});

const Or = circuit('Or', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: (a || b) ? 1 : 0 }),
});

const Xor = circuit('Xor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: (a !== b) ? 1 : 0 }),
});

const Not = circuit('Not', {
  inputs: { in: bit },
  outputs: { out: bit },
  eval: ({ in: inp }) => ({ out: inp ? 0 : 1 }),
});

// ============================================================================
// bit and bus constructors
// ============================================================================

describe('bit and bus', () => {
  it('bit is a BitType', () => {
    expect(bit).toEqual({ kind: 'bit' });
  });

  it('bus creates a BusType', () => {
    expect(bus(8)).toEqual({ kind: 'bus', width: 8 });
    expect(bus(32)).toEqual({ kind: 'bus', width: 32 });
  });

  it('bus rejects invalid widths', () => {
    expect(() => bus(0)).toThrow('positive integer');
    expect(() => bus(-1)).toThrow('positive integer');
    expect(() => bus(1.5)).toThrow('positive integer');
  });
});

// ============================================================================
// Combinational leaf components
// ============================================================================

describe('combinational leaf', () => {
  it('builds an AND gate', () => {
    expect(And.circuit.name).toBe('And');
    expect(And.circuit.inputs).toHaveLength(2);
    expect(And.circuit.outputs).toHaveLength(1);
    expect(And.circuit.inputs[0].name).toBe('a');
    expect(And.circuit.inputs[0].portType).toEqual({ kind: 'bit' });
    expect(And.circuit.outputs[0].name).toBe('out');
    expect(And.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(And.circuit.clocks).toHaveLength(0);
    expect(And.circuit.state).toHaveLength(0);
    expect(And.circuit.metadata?.timing).toBe('combinational');
  });

  it('builds a bus-width component', () => {
    const Adder = circuit('Adder', {
      inputs: { a: bus(8), b: bus(8) },
      outputs: { sum: bus(8), carry: bit },
      eval: ({ a, b }) => ({ sum: (a + b) & 0xFF, carry: (a + b) >> 8 }),
    });

    expect(Adder.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Adder.circuit.outputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Adder.circuit.outputs[1].portType).toEqual({ kind: 'bit' });
    expect(Adder.circuit.outputs[1].name).toBe('carry');
  });

  it('registers eval function in registry at definition time', () => {
    const entry = getCircuitEval('And');
    expect(entry).toBeDefined();
    expect(entry!.evalFn({ a: 1, b: 1 })).toEqual({ out: 1 });
    expect(entry!.evalFn({ a: 1, b: 0 })).toEqual({ out: 0 });
  });

  it('allows numeric shorthand for bus width', () => {
    const Comp = circuit('Comp', {
      inputs: { data: 8 },
      outputs: { result: 16 },
      eval: ({ data }) => ({ result: data * 2 }),
    });

    expect(Comp.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Comp.circuit.outputs[0].portType).toEqual({ kind: 'bus', width: 16 });
  });
});

// ============================================================================
// Sequential leaf components
// ============================================================================

describe('sequential leaf', () => {
  it('builds a counter with state', () => {
    const Counter = circuit('Counter', {
      inputs: { enable: bit },
      outputs: { count: bus(8) },
      state: { total: 0 },
      eval: ({ total }) => ({ count: total as number }),
      onTick: ({ enable, total }) => ({
        total: enable ? ((total as number) + 1) & 0xFF : (total as number),
      }),
    });

    expect(Counter.circuit.clocks).toHaveLength(1);
    expect(Counter.circuit.clocks[0].name).toBe('clk');
    expect(Counter.circuit.state).toHaveLength(1);
    expect(Counter.circuit.metadata?.timing).toBe('sequential');
    const entry = getCircuitEval('Counter');
    expect(entry?.evalFn).toBeDefined();
    expect(entry?.onTickFn).toBeDefined();
    expect(entry?.stateKeys).toEqual(['total']);
  });

  it('builds a register', () => {
    const Register = circuit('Register8', {
      inputs: { d: bus(8) },
      outputs: { q: bus(8) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    expect(Register.circuit.inputs).toHaveLength(1);
    expect(Register.circuit.outputs).toHaveLength(1);
    expect(Register.circuit.clocks).toHaveLength(1);
    expect(Register.circuit.name).toBe('Register8');
  });
});

// ============================================================================
// Composite components
// ============================================================================

describe('composite', () => {
  it('builds a HalfAdder from gates', () => {
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

    expect(HalfAdder.circuit.implementation).toEqual({ kind: 'composite' });
    expect(HalfAdder.circuit.nodes).toHaveLength(2);
    expect(HalfAdder.circuit.nodes[0].id).toBe('x');
    expect(HalfAdder.circuit.nodes[0].componentRef).toBe('Xor');
    expect(HalfAdder.circuit.nodes[1].id).toBe('a');
    expect(HalfAdder.circuit.nodes[1].componentRef).toBe('And');
    expect(HalfAdder.circuit.connections).toHaveLength(6);
  });

  it('builds a composite from composites', () => {
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

    const FullAdder = circuit('FullAdder', {
      inputs: { a: bit, b: bit, cin: bit },
      outputs: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or: Or },
      connect: ({ inputs, outputs, nodes: { ha1, ha2, or } }) => [
        inputs.a.to(ha1.a),
        inputs.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inputs.cin.to(ha2.b),
        ha2.sum.to(outputs.sum),
        ha1.carry.to(or.a),
        ha2.carry.to(or.b),
        or.out.to(outputs.cout),
      ],
    });

    expect(FullAdder.circuit.nodes).toHaveLength(3);
    expect(FullAdder.circuit.nodes[0].componentRef).toBe('HalfAdder');
    expect(FullAdder.circuit.connections).toHaveLength(8);
  });

  it('detects sequential when nodes contain sequential components', () => {
    const Reg = circuit('Reg', {
      inputs: { d: bus(8) },
      outputs: { q: bus(8) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    const Pipeline = circuit('Pipeline', {
      inputs: { data: bus(8) },
      outputs: { result: bus(8) },
      nodes: { r: Reg },
      connect: ({ inputs, outputs, nodes: { r } }) => [
        inputs.data.to(r.d),
        r.q.to(outputs.result),
      ],
    });

    expect(Pipeline.circuit.metadata?.timing).toBe('sequential');
  });
});

// ============================================================================
// Parameterized components
// ============================================================================

describe('parameterized', () => {
  it('creates components via factory function', () => {
    const Register = (width: number) => circuit(`Register${width}`, {
      inputs: { d: bus(width) },
      outputs: { q: bus(width) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    const r8 = Register(8);
    const r16 = Register(16);

    expect(r8.circuit.name).toBe('Register8');
    expect(r8.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(r16.circuit.name).toBe('Register16');
    expect(r16.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 16 });
  });
});

// ============================================================================
// Metadata
// ============================================================================

describe('metadata', () => {
  it('attaches metadata via meta', () => {
    const ALU = circuit('ALU', {
      inputs: { a: bus(32) },
      outputs: { result: bus(32) },
      meta: { category: 'arithmetic', description: 'Arithmetic Logic Unit', icon: '+' },
      eval: ({ a }) => ({ result: a }),
    });

    expect(ALU.circuit.metadata?.description).toBe('Arithmetic Logic Unit');
    expect(ALU.circuit.metadata?.category).toBe('arithmetic');
    expect(ALU.circuit.metadata?.icon).toBe('+');
  });
});

// ============================================================================
// Validation errors
// ============================================================================

describe('validation', () => {
  it('rejects input/output name collision', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { x: bit },
        outputs: { x: bit },
        eval: ({ x }) => ({ x }),
      })
    ).toThrow("used for both input and output");
  });

  it('rejects state name colliding with input', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { count: bus(8) },
        outputs: { out: bus(8) },
        state: { count: 0 },
        eval: ({ count }) => ({ out: count as number }),
      })
    ).toThrow("collides with input");
  });

  it('rejects reserved node names', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { a: bit },
        outputs: { b: bit },
        nodes: { inputs: And },
      })
    ).toThrow("reserved");
  });

  it('rejects onTick without state', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { d: bit },
        outputs: { q: bit },
        onTick: ({ d }) => ({ value: d }),
      })
    ).toThrow('requires state');
  });

  it('rejects connection to nonexistent port on node', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { a: bit },
        outputs: { b: bit },
        nodes: { x: And },
        connect: ({ inputs, outputs, nodes: { x } }) => [
          inputs.a.to((x as any).nonexistent),
        ],
      })
    ).toThrow("does not exist on node 'x'");
  });
});

// ============================================================================
// Source components (no eval, no nodes)
// ============================================================================

describe('source components', () => {
  it('builds a Switch (no eval, no nodes)', () => {
    const Switch = circuit('Switch', {
      outputs: { value: bit },
    });

    expect(Switch.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(Switch.circuit.inputs).toHaveLength(0);
    expect(Switch.circuit.outputs).toHaveLength(1);
    expect(Switch.circuit.metadata?.timing).toBe('combinational');
  });
});
