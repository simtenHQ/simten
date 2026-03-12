# Examples

## Half Adder

Two bits → sum + carry.

```dsl
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

## Full Adder

Three bits (a + b + carry in) → sum + carry out. Reuses HalfAdder.

```dsl
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    node ha1: HalfAdder
    node ha2: HalfAdder
    node or1: Or

    connect a -> ha1.a
    connect b -> ha1.b
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

## 2-to-1 Multiplexer

Select between two inputs: `out = (a AND NOT sel) OR (b AND sel)`.

```dsl
circuit Mux2to1 {
  input a: Bit
  input b: Bit
  input sel: Bit
  output out: Bit

  impl {
    node not1: Not
    node and1: And
    node and2: And
    node or1: Or

    connect sel -> not1.a
    connect a -> and1.a
    connect not1.out -> and1.b

    connect b -> and2.a
    connect sel -> and2.b

    connect and1.out -> or1.a
    connect and2.out -> or1.b
    connect or1.out -> out
  }
}
```

## 4-Bit Ripple Carry Adder

Chain four full adders to add two 4-bit numbers.

```dsl
circuit RippleCarryAdder4 {
  input a: Bus[4]
  input b: Bus[4]
  input cin: Bit
  output sum: Bus[4]
  output cout: Bit

  impl {
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder

    connect a[0] -> fa0.a
    connect b[0] -> fa0.b
    connect cin -> fa0.cin
    connect fa0.sum -> sum[0]

    connect a[1] -> fa1.a
    connect b[1] -> fa1.b
    connect fa0.cout -> fa1.cin
    connect fa1.sum -> sum[1]

    connect a[2] -> fa2.a
    connect b[2] -> fa2.b
    connect fa1.cout -> fa2.cin
    connect fa2.sum -> sum[2]

    connect a[3] -> fa3.a
    connect b[3] -> fa3.b
    connect fa2.cout -> fa3.cin
    connect fa3.sum -> sum[3]

    connect fa3.cout -> cout
  }
}
```

## Counter (Sequential)

Increments on each clock cycle using a register and incrementer.

```dsl
circuit Counter {
  input clk: Bit
  output count: Bus[8]

  impl {
    node reg: Register
    node inc: Incrementer

    connect clk -> reg.clk
    connect reg.q -> inc.in
    connect inc.out -> reg.d
    connect reg.q -> count
  }
}
```

## Simple ALU

Selects between ADD, SUB, AND, OR based on 2-bit opcode.

```dsl
circuit SimpleALU {
  input a: Bus[8]
  input b: Bus[8]
  input opcode: Bus[2]
  output result: Bus[8]

  impl {
    node adder: Adder(width = 8)
    node and_op: BusAnd
    node or_op: BusOr
    node mux: Mux

    connect a -> adder.a
    connect b -> adder.b

    connect a -> and_op.a
    connect b -> and_op.b

    connect a -> or_op.a
    connect b -> or_op.b

    connect adder.sum -> mux.in0
    connect and_op.out -> mux.in2
    connect or_op.out -> mux.in3
    connect opcode -> mux.sel

    connect mux.out -> result
  }
}
```

## Design Patterns

**Combinational** — no state, no clock. Outputs computed directly from inputs.

**Sequential** — has state and clock. State updates on clock edges, outputs reflect current state.

**Hierarchical composition** — build complex circuits from simpler ones (FullAdder from HalfAdder, ALU from Adder).
