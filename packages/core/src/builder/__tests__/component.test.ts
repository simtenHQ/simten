import { describe, it, expect } from 'vitest';
import { component } from '../component.js';
import { bit, bus } from '../bit-bus.js';
import type { BuiltComponent } from '../types.js';

// ============================================================================
// Helper: pre-built leaf components for use as nodes
// ============================================================================

const And = component('And', {
  in: { a: bit, b: bit },
  out: { out: bit },
  eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
});

const Or = component('Or', {
  in: { a: bit, b: bit },
  out: { out: bit },
  eval: ({ a, b }) => ({ out: (a || b) ? 1 : 0 }),
});

const Xor = component('Xor', {
  in: { a: bit, b: bit },
  out: { out: bit },
  eval: ({ a, b }) => ({ out: (a !== b) ? 1 : 0 }),
});

const Not = component('Not', {
  in: { in: bit },
  out: { out: bit },
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
    expect(And.name).toBe('And');
    expect(And.circuit.inputs).toHaveLength(2);
    expect(And.circuit.outputs).toHaveLength(1);
    expect(And.circuit.inputs[0].name).toBe('a');
    expect(And.circuit.inputs[0].portType).toEqual({ kind: 'bit' });
    expect(And.circuit.outputs[0].name).toBe('out');
    expect(And.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(And.circuit.clocks).toHaveLength(0);
    expect(And.circuit.state).toHaveLength(0);
    expect(And.circuit.metadata?.kind).toBe('combinational');
  });

  it('builds a bus-width component', () => {
    const Adder = component('Adder', {
      in: { a: bus(8), b: bus(8) },
      out: { sum: bus(8), carry: bit },
      eval: ({ a, b }) => ({ sum: (a + b) & 0xFF, carry: (a + b) >> 8 }),
    });

    expect(Adder.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Adder.circuit.outputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Adder.circuit.outputs[1].portType).toEqual({ kind: 'bit' });
    expect(Adder.circuit.outputs[1].name).toBe('carry');
  });

  it('attaches eval function', () => {
    expect((And as any)._evalFn).toBeDefined();
    const evalFn = (And as any)._evalFn;
    expect(evalFn({ a: 1, b: 1 })).toEqual({ out: 1 });
    expect(evalFn({ a: 1, b: 0 })).toEqual({ out: 0 });
  });

  it('allows numeric shorthand for bus width', () => {
    const Comp = component('Comp', {
      in: { data: 8 },
      out: { result: 16 },
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
    const Counter = component('Counter', {
      in: { enable: bit },
      out: { count: bus(8) },
      state: { total: 0 },
      eval: ({ total }) => ({ count: total as number }),
      onTick: ({ enable, total }) => ({
        total: enable ? ((total as number) + 1) & 0xFF : (total as number),
      }),
    });

    expect(Counter.circuit.clocks).toHaveLength(1);
    expect(Counter.circuit.clocks[0].name).toBe('clk');
    expect(Counter.circuit.state).toHaveLength(1);
    expect(Counter.circuit.metadata?.kind).toBe('sequential');
    expect((Counter as any)._evalFn).toBeDefined();
    expect((Counter as any)._onTickFn).toBeDefined();
    expect((Counter as any)._initialState).toEqual({ total: 0 });
  });

  it('builds a register', () => {
    const Register = component('Register8', {
      in: { d: bus(8) },
      out: { q: bus(8) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    expect(Register.circuit.inputs).toHaveLength(1);
    expect(Register.circuit.outputs).toHaveLength(1);
    expect(Register.circuit.clocks).toHaveLength(1);
    expect(Register.name).toBe('Register8');
  });
});

// ============================================================================
// Composite components
// ============================================================================

describe('composite', () => {
  it('builds a HalfAdder from gates', () => {
    const HalfAdder = component('HalfAdder', {
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

    expect(HalfAdder.circuit.implementation).toEqual({ kind: 'composite' });
    expect(HalfAdder.circuit.nodes).toHaveLength(2);
    expect(HalfAdder.circuit.nodes[0].id).toBe('x');
    expect(HalfAdder.circuit.nodes[0].componentRef).toBe('Xor');
    expect(HalfAdder.circuit.nodes[1].id).toBe('a');
    expect(HalfAdder.circuit.nodes[1].componentRef).toBe('And');
    expect(HalfAdder.circuit.connections).toHaveLength(6);
  });

  it('builds a composite from composites', () => {
    const HalfAdder = component('HalfAdder', {
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

    const FullAdder = component('FullAdder', {
      in: { a: bit, b: bit, cin: bit },
      out: { sum: bit, cout: bit },
      nodes: { ha1: HalfAdder, ha2: HalfAdder, or: Or },
      connect: ({ in: inp, out, ha1, ha2, or }) => [
        inp.a.to(ha1.a),
        inp.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inp.cin.to(ha2.b),
        ha2.sum.to(out.sum),
        ha1.carry.to(or.a),
        ha2.carry.to(or.b),
        or.out.to(out.cout),
      ],
    });

    expect(FullAdder.circuit.nodes).toHaveLength(3);
    expect(FullAdder.circuit.nodes[0].componentRef).toBe('HalfAdder');
    expect(FullAdder.circuit.connections).toHaveLength(8);
  });

  it('detects sequential when nodes contain sequential components', () => {
    const Reg = component('Reg', {
      in: { d: bus(8) },
      out: { q: bus(8) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    const Pipeline = component('Pipeline', {
      in: { data: bus(8) },
      out: { result: bus(8) },
      nodes: { r: Reg },
      connect: ({ in: inp, out, r }) => [
        inp.data.to(r.d),
        r.q.to(out.result),
      ],
    });

    expect(Pipeline.circuit.metadata?.kind).toBe('sequential');
  });
});

// ============================================================================
// Parameterized components
// ============================================================================

describe('parameterized', () => {
  it('creates components via factory function', () => {
    const Register = (width: number) => component(`Register${width}`, {
      in: { d: bus(width) },
      out: { q: bus(width) },
      state: { stored: 0 },
      eval: ({ stored }) => ({ q: stored as number }),
      onTick: ({ d }) => ({ stored: d as number }),
    });

    const r8 = Register(8);
    const r16 = Register(16);

    expect(r8.name).toBe('Register8');
    expect(r8.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(r16.name).toBe('Register16');
    expect(r16.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 16 });
  });
});

// ============================================================================
// Node arguments
// ============================================================================

describe('node arguments', () => {
  it('passes arguments to nodes via nodeArgs', () => {
    const Constant = component('Constant', {
      out: { out: bit },
      eval: () => ({ out: 0 }),
    });

    const Demo = component('Demo', {
      nodes: { c: Constant },
      nodeArgs: { c: { value: 42 } },
    });

    expect(Demo.circuit.nodes[0].arguments).toEqual({ value: 42 });
  });
});

// ============================================================================
// Metadata
// ============================================================================

describe('metadata', () => {
  it('attaches metadata via meta', () => {
    const ALU = component('ALU', {
      in: { a: bus(32) },
      out: { result: bus(32) },
      meta: { category: 'arithmetic', description: 'Arithmetic Logic Unit', icon: '+' },
      eval: ({ a }) => ({ result: a }),
    });

    expect(ALU.circuit.metadata?.description).toBe('Arithmetic Logic Unit');
    expect((ALU as any)._category).toBe('arithmetic');
    expect((ALU as any)._icon).toBe('+');
  });
});

// ============================================================================
// Validation errors
// ============================================================================

describe('validation', () => {
  it('rejects input/output name collision', () => {
    expect(() =>
      component('Bad', {
        in: { x: bit },
        out: { x: bit },
        eval: ({ x }) => ({ x }),
      })
    ).toThrow("used for both input and output");
  });

  it('rejects state name colliding with input', () => {
    expect(() =>
      component('Bad', {
        in: { count: bus(8) },
        out: { out: bus(8) },
        state: { count: 0 },
        eval: ({ count }) => ({ out: count as number }),
      })
    ).toThrow("collides with input");
  });

  it('rejects reserved node names', () => {
    expect(() =>
      component('Bad', {
        in: { a: bit },
        out: { b: bit },
        nodes: { in: And },
      })
    ).toThrow("reserved");
  });

  it('rejects onTick without state', () => {
    expect(() =>
      component('Bad', {
        in: { d: bit },
        out: { q: bit },
        onTick: ({ d }) => ({ value: d }),
      })
    ).toThrow('requires state');
  });

  it('rejects connection to nonexistent port on node', () => {
    expect(() =>
      component('Bad', {
        in: { a: bit },
        out: { b: bit },
        nodes: { x: And },
        connect: ({ in: inp, x }) => [
          inp.a.to((x as any).nonexistent),
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
    const Switch = component('Switch', {
      out: { value: bit },
    });

    expect(Switch.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(Switch.circuit.inputs).toHaveLength(0);
    expect(Switch.circuit.outputs).toHaveLength(1);
    expect(Switch.circuit.metadata?.kind).toBe('combinational');
  });
});
