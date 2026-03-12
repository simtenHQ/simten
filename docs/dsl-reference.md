# DSL Reference

## Circuit Definition

```dsl
circuit <Name> {
  input <name>: <Type>
  output <name>: <Type>
  clock <name>

  state <name>: <Type> [= <initial_value>]    // sequential only

  impl {
    node <id>: <ComponentType>[(<param> = <value>)]
    connect <source> -> <target>
  }
}
```

## Types

| Type | Description | Runtime representation |
|------|-------------|----------------------|
| `Bit` | Single binary value | `boolean` |
| `Bus[N]` | N-bit wide bus | `number` (unsigned) |

## Port Paths

| Path | Meaning |
|------|---------|
| `a` | Circuit-level port named `a` |
| `node1.out` | Port `out` on node `node1` |

## Connection Syntax

```dsl
connect a -> xor1.a          // circuit input to node input
connect xor1.out -> sum       // node output to circuit output
connect ha1.carry -> or1.a    // node output to node input
```

## Node Instantiation

```dsl
node xor1: Xor                              // no parameters
node adder: Adder(width = 8)                 // with parameters
node ram: RAM(addr_width = 10, data_width = 8)
```

## Comments

```dsl
// single-line comment
/* multi-line
   comment */
```

## Number Literals

```dsl
42        // decimal
0xFF      // hexadecimal
0b1010    // binary
```

## Keywords

`circuit`, `input`, `output`, `clock`, `node`, `connect`, `impl`, `state`, `on`, `rising`, `falling`, `if`, `else`, `testbench`, `use`, `as`, `stimulus`, `capture`, `assert`, `at`, `step`, `tick`, `for`, `in`

## Testbench Syntax

```dsl
testbench HalfAdderTest {
  use HalfAdder as dut

  stimulus {
    step { dut.a = 0; dut.b = 0 }
    step { dut.a = 1; dut.b = 0 }
    step { dut.a = 0; dut.b = 1 }
    step { dut.a = 1; dut.b = 1 }
  }

  assert at 0 { dut.sum == 0; dut.carry == 0 }
  assert at 1 { dut.sum == 1; dut.carry == 0 }
  assert at 2 { dut.sum == 1; dut.carry == 0 }
  assert at 3 { dut.sum == 0; dut.carry == 1 }
}
```

## Type Rules

- `Bit -> Bit` — valid
- `Bus[N] -> Bus[N]` — valid (same width)
- `Bit -> Bus[N]` — invalid (needs explicit conversion)
- `Bus[8] -> Bus[16]` — invalid (width mismatch)

Use `Splitter` or `BitSlice` for type conversions.
