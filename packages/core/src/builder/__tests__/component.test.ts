import { describe, it, expect } from 'vitest';
import { component } from '../component.js';
import { bit, bus } from '../bit-bus.js';
import type { BuiltComponent } from '../types.js';

// ============================================================================
// Helper: pre-built leaf components for use as nodes
// ============================================================================

const And = component('And')
  .in('a', bit)
  .in('b', bit)
  .out('out', bit)
  .eval(({ a, b }) => ({ out: (a && b) ? 1 : 0 }))
  .build();

const Or = component('Or')
  .in('a', bit)
  .in('b', bit)
  .out('out', bit)
  .eval(({ a, b }) => ({ out: (a || b) ? 1 : 0 }))
  .build();

const Xor = component('Xor')
  .in('a', bit)
  .in('b', bit)
  .out('out', bit)
  .eval(({ a, b }) => ({ out: (a !== b) ? 1 : 0 }))
  .build();

const Not = component('Not')
  .in('in', bit)
  .out('out', bit)
  .eval(({ in: inp }) => ({ out: inp ? 0 : 1 }))
  .build();

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
    const result = And;
    expect(result.name).toBe('And');
    expect(result.circuit.inputs).toHaveLength(2);
    expect(result.circuit.outputs).toHaveLength(1);
    expect(result.circuit.inputs[0].name).toBe('a');
    expect(result.circuit.inputs[0].portType).toEqual({ kind: 'bit' });
    expect(result.circuit.inputs[1].name).toBe('b');
    expect(result.circuit.outputs[0].name).toBe('out');
    expect(result.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(result.circuit.clocks).toHaveLength(0);
    expect(result.circuit.state).toHaveLength(0);
    expect(result.circuit.metadata?.kind).toBe('combinational');
  });

  it('builds a bus-width component', () => {
    const Adder = component('Adder')
      .in('a', bus(8))
      .in('b', bus(8))
      .out('sum', bus(8))
      .out('carry', bit)
      .eval(({ a, b }) => ({
        sum: (a + b) & 0xFF,
        carry: (a + b) >> 8,
      }))
      .build();

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
    expect(evalFn({ a: 0, b: 0 })).toEqual({ out: 0 });
  });

  it('allows numeric shorthand for bus width', () => {
    const Comp = component('Comp')
      .in('data', 8)
      .out('result', 16)
      .eval(({ data }) => ({ result: data * 2 }))
      .build();

    expect(Comp.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(Comp.circuit.outputs[0].portType).toEqual({ kind: 'bus', width: 16 });
  });
});

// ============================================================================
// Sequential leaf components
// ============================================================================

describe('sequential leaf', () => {
  it('builds a counter with state', () => {
    const Counter = component('Counter')
      .in('enable', bit)
      .out('count', bus(8))
      .state({ total: 0 })
      .eval(({ total }) => ({ count: total }))
      .onTick(({ enable, total }) => ({
        total: enable ? ((total as number) + 1) & 0xFF : (total as number),
      }))
      .build();

    expect(Counter.circuit.clocks).toHaveLength(1);
    expect(Counter.circuit.clocks[0].name).toBe('clk');
    expect(Counter.circuit.state).toHaveLength(1);
    expect(Counter.circuit.metadata?.kind).toBe('sequential');
    expect((Counter as any)._evalFn).toBeDefined();
    expect((Counter as any)._onTickFn).toBeDefined();
    expect((Counter as any)._initialState).toEqual({ total: 0 });
  });

  it('builds a register', () => {
    const Register = component('Register8')
      .in('d', bus(8))
      .out('q', bus(8))
      .state({ stored: 0 })
      .eval(({ stored }) => ({ q: stored as number }))
      .onTick(({ d }) => ({ stored: d as number }))
      .build();

    expect(Register.circuit.inputs).toHaveLength(1);
    expect(Register.circuit.outputs).toHaveLength(1);
    expect(Register.circuit.clocks).toHaveLength(1);
    expect(Register.circuit.state).toHaveLength(1);
    expect(Register.name).toBe('Register8');
  });

  it('builds a DFlipFlop', () => {
    const DFF = component('DFlipFlop')
      .in('d', bit)
      .out('q', bit)
      .out('q_bar', bit)
      .state({ stored: false })
      .eval(({ stored }) => ({
        q: stored ? 1 : 0,
        q_bar: stored ? 0 : 1,
      }))
      .onTick(({ d }) => ({ stored: Boolean(d) }))
      .build();

    expect(DFF.circuit.outputs).toHaveLength(2);
    expect(DFF.circuit.outputs[0].name).toBe('q');
    expect(DFF.circuit.outputs[1].name).toBe('q_bar');
  });
});

// ============================================================================
// Composite components
// ============================================================================

describe('composite (chained)', () => {
  it('builds a HalfAdder from gates', () => {
    const HalfAdder = component('HalfAdder')
      .in('a', bit)
      .in('b', bit)
      .out('sum', bit)
      .out('carry', bit)
      .node('x', Xor)
      .node('a', And)
      .connect(({ in: inp, out, x, a }) => [
        inp.a.to(x.a, a.a),
        inp.b.to(x.b, a.b),
        x.out.to(out.sum),
        a.out.to(out.carry),
      ])
      .build();

    expect(HalfAdder.circuit.implementation).toEqual({ kind: 'composite' });
    expect(HalfAdder.circuit.nodes).toHaveLength(2);
    expect(HalfAdder.circuit.nodes[0].id).toBe('x');
    expect(HalfAdder.circuit.nodes[0].componentRef).toBe('Xor');
    expect(HalfAdder.circuit.nodes[1].id).toBe('a');
    expect(HalfAdder.circuit.nodes[1].componentRef).toBe('And');

    // 4 connections: a→x.a, a→a.a, b→x.b, b→a.b, x.out→sum, a.out→carry
    // in.a fans out to x.a and a.a (2 connections from 1 .to())
    // in.b fans out to x.b and a.b (2 connections from 1 .to())
    // x.out → out.sum (1 connection)
    // a.out → out.carry (1 connection)
    expect(HalfAdder.circuit.connections).toHaveLength(6);
  });

  it('builds a composite from composites', () => {
    const HalfAdder = component('HalfAdder')
      .in('a', bit)
      .in('b', bit)
      .out('sum', bit)
      .out('carry', bit)
      .node('x', Xor)
      .node('a', And)
      .connect(({ in: inp, out, x, a }) => [
        inp.a.to(x.a, a.a),
        inp.b.to(x.b, a.b),
        x.out.to(out.sum),
        a.out.to(out.carry),
      ])
      .build();

    const FullAdder = component('FullAdder')
      .in('a', bit)
      .in('b', bit)
      .in('cin', bit)
      .out('sum', bit)
      .out('cout', bit)
      .node('ha1', HalfAdder)
      .node('ha2', HalfAdder)
      .node('or', Or)
      .connect(({ in: inp, out, ha1, ha2, or }) => [
        inp.a.to(ha1.a),
        inp.b.to(ha1.b),
        ha1.sum.to(ha2.a),
        inp.cin.to(ha2.b),
        ha2.sum.to(out.sum),
        ha1.carry.to(or.a),
        ha2.carry.to(or.b),
        or.out.to(out.cout),
      ])
      .build();

    expect(FullAdder.circuit.nodes).toHaveLength(3);
    expect(FullAdder.circuit.nodes[0].componentRef).toBe('HalfAdder');
    expect(FullAdder.circuit.nodes[1].componentRef).toBe('HalfAdder');
    expect(FullAdder.circuit.nodes[2].componentRef).toBe('Or');
    expect(FullAdder.circuit.connections).toHaveLength(8);
  });

  it('auto-builds builder passed to .node()', () => {
    const NotBuilder = component('Not')
      .in('in', bit)
      .out('out', bit)
      .eval(({ in: inp }) => ({ out: inp ? 0 : 1 }));

    // Pass builder directly, should auto-build
    const Inverter = component('Inverter')
      .in('a', bit)
      .out('b', bit)
      .node('n', NotBuilder as any)
      .connect(({ in: inp, out, n }) => [
        inp.a.to(n.in),
        n.out.to(out.b),
      ])
      .build();

    expect(Inverter.circuit.nodes).toHaveLength(1);
    expect(Inverter.circuit.nodes[0].componentRef).toBe('Not');
  });

  it('detects sequential when nodes contain sequential components', () => {
    const Reg = component('Reg')
      .in('d', bus(8))
      .out('q', bus(8))
      .state({ stored: 0 })
      .eval(({ stored }) => ({ q: stored as number }))
      .onTick(({ d }) => ({ stored: d as number }))
      .build();

    const Pipeline = component('Pipeline')
      .in('data', bus(8))
      .out('result', bus(8))
      .node('r', Reg)
      .connect(({ in: inp, out, r }) => [
        inp.data.to(r.d),
        r.q.to(out.result),
      ])
      .build();

    expect(Pipeline.circuit.metadata?.kind).toBe('sequential');
  });
});

// ============================================================================
// Object-style syntax
// ============================================================================

describe('object style', () => {
  it('builds a component with object config', () => {
    const result = component('ALU', {
      in: { a: bus(8), b: bus(8), op: bus(2) },
      out: { result: bus(8) },
      nodes: { add: And },  // placeholder
      meta: { category: 'arithmetic', description: 'ALU' },
    });

    expect(result.name).toBe('ALU');
    expect(result.circuit.inputs).toHaveLength(3);
    expect(result.circuit.outputs).toHaveLength(1);
    expect(result.circuit.nodes).toHaveLength(1);
  });

  it('builds a pure eval component with object config', () => {
    const ReLU = component('ReLU', {
      in: { x: bus(16) },
      out: { y: bus(16) },
      eval: ({ x }) => ({ y: x > 0 ? x : 0 }),
    });

    expect(ReLU.circuit.implementation).toEqual({ kind: 'primitive' });
    expect((ReLU as any)._evalFn({ x: 5 })).toEqual({ y: 5 });
    expect((ReLU as any)._evalFn({ x: -3 })).toEqual({ y: 0 });
  });
});

// ============================================================================
// Parameterized components
// ============================================================================

describe('parameterized', () => {
  it('creates components via factory function', () => {
    const Register = (width: number) => component(`Register${width}`)
      .in('d', bus(width))
      .out('q', bus(width))
      .state({ stored: 0 })
      .eval(({ stored }) => ({ q: stored as number }))
      .onTick(({ d }) => ({ stored: d as number }))
      .build();

    const r8 = Register(8);
    const r16 = Register(16);

    expect(r8.name).toBe('Register8');
    expect(r8.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
    expect(r16.name).toBe('Register16');
    expect(r16.circuit.inputs[0].portType).toEqual({ kind: 'bus', width: 16 });
  });
});

// ============================================================================
// Dual mode (eval + impl)
// ============================================================================

describe('dual mode', () => {
  it('supports both eval and impl', () => {
    const Adder = component('Adder')
      .in('a', bus(8))
      .in('b', bus(8))
      .out('sum', bus(8))
      .eval(({ a, b }) => ({ sum: (a + b) & 0xFF }))
      .impl(c => c
        .node('g0', And)
        .node('g1', Xor)
      )
      .build();

    // Has eval for fast simulation
    expect((Adder as any)._evalFn).toBeDefined();
    expect((Adder as any)._evalFn({ a: 3, b: 5 })).toEqual({ sum: 8 });
    // Still marked as primitive (eval takes priority)
    expect(Adder.circuit.implementation).toEqual({ kind: 'primitive' });
  });
});

// ============================================================================
// Metadata
// ============================================================================

describe('metadata', () => {
  it('attaches metadata via .meta()', () => {
    const ALU = component('ALU')
      .in('a', bus(32))
      .out('result', bus(32))
      .meta({ category: 'arithmetic', description: 'Arithmetic Logic Unit', icon: '+' })
      .eval(({ a }) => ({ result: a }))
      .build();

    expect(ALU.circuit.metadata?.description).toBe('Arithmetic Logic Unit');
    expect((ALU as any)._category).toBe('arithmetic');
    expect((ALU as any)._icon).toBe('+');
  });
});

// ============================================================================
// Validation errors
// ============================================================================

describe('validation', () => {
  it('rejects duplicate input names', () => {
    expect(() =>
      component('Bad')
        .in('a', bit)
        .in('a', bit)
        .out('out', bit)
        .eval(({ a }) => ({ out: a }))
        .build()
    ).toThrow("Duplicate input port name: 'a'");
  });

  it('rejects input/output name collision', () => {
    expect(() =>
      component('Bad')
        .in('x', bit)
        .out('x', bit)
        .eval(({ x }) => ({ x }))
        .build()
    ).toThrow("Port name 'x' used for both input and output");
  });

  it('rejects state name colliding with input', () => {
    expect(() =>
      component('Bad')
        .in('count', bus(8))
        .out('out', bus(8))
        .state({ count: 0 })
        .eval(({ count }) => ({ out: count as number }))
        .build()
    ).toThrow("State name 'count' collides with input port name");
  });

  it('rejects state name colliding with output', () => {
    expect(() =>
      component('Bad')
        .in('d', bus(8))
        .out('q', bus(8))
        .state({ q: 0 })
        .eval(({ q }) => ({ q: q as number }))
        .build()
    ).toThrow("State name 'q' collides with output port name");
  });

  it('rejects reserved node names', () => {
    expect(() =>
      component('Bad')
        .in('a', bit)
        .out('b', bit)
        .node('in', And)
        .build()
    ).toThrow("Node name 'in' is reserved");
  });

  it('rejects onTick without state', () => {
    expect(() =>
      component('Bad')
        .in('d', bit)
        .out('q', bit)
        .onTick(({ d }) => ({ value: d }))
        .build()
    ).toThrow('.onTick() requires .state()');
  });

  it('rejects connection to nonexistent port on node', () => {
    expect(() =>
      component('Bad')
        .in('a', bit)
        .out('b', bit)
        .node('x', And)
        .connect(({ in: inp, out, x }) => [
          inp.a.to((x as any).nonexistent),
        ])
        .build()
    ).toThrow("Port 'nonexistent' does not exist on node 'x'");
  });

  it('rejects connection to nonexistent circuit port', () => {
    expect(() =>
      component('Bad')
        .in('a', bit)
        .out('b', bit)
        .node('x', And)
        .connect(({ in: inp, out, x }) => {
          // Manually create a bad ref
          const badRef = { _path: { nodeId: '', portName: 'bogus' }, _type: bit, to: (() => {}) as any };
          return [inp.a.to(badRef)];
        })
        .build()
    ).toThrow("circuit port 'bogus' does not exist");
  });
});

// ============================================================================
// Source components (no eval, no nodes)
// ============================================================================

describe('source components', () => {
  it('builds a Switch (no eval, no nodes)', () => {
    const Switch = component('Switch')
      .out('value', bit)
      .build();

    expect(Switch.circuit.implementation).toEqual({ kind: 'primitive' });
    expect(Switch.circuit.inputs).toHaveLength(0);
    expect(Switch.circuit.outputs).toHaveLength(1);
    expect(Switch.circuit.metadata?.kind).toBe('combinational');
  });
});
