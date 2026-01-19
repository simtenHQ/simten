# DSL Examples - From Simple to Complex

## 1. Basic Logic Gates (Primitives)

These are primitive components - they have no implementation, behavior is provided by simulator.

```
// AND gate - primitive
circuit And {
  input a: Bit
  input b: Bit
  output out: Bit
  // No impl - primitive provided by simulator
}

// XOR gate - primitive
circuit Xor {
  input a: Bit
  input b: Bit
  output out: Bit
  // No impl - primitive provided by simulator
}
```

## 2. Half Adder (Simple Composite)

Adds two bits, produces sum and carry.

```
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    // Sum is XOR (a ⊕ b)
    node xor1: Xor

    // Carry is AND (a ∧ b)
    node and1: And

    // Wire inputs to XOR for sum
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    // Wire inputs to AND for carry
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

**Truth Table:**
```
a | b | sum | carry
--|---|-----|------
0 | 0 |  0  |  0
0 | 1 |  1  |  0
1 | 0 |  1  |  0
1 | 1 |  0  |  1
```

## 3. Full Adder (Component Reuse)

Adds three bits (two inputs + carry in), produces sum and carry out.

```
circuit FullAdder {
  input a: Bit
  input b: Bit
  input cin: Bit
  output sum: Bit
  output cout: Bit

  impl {
    // First half adder: add a and b
    node ha1: HalfAdder

    // Second half adder: add (a+b) and cin
    node ha2: HalfAdder

    // OR gate: combine carry outputs
    node or1: Or

    // First stage: a + b
    connect a -> ha1.a
    connect b -> ha1.b

    // Second stage: (a+b) + cin
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    // Carry out: either stage generated carry
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

**How it works:**
1. ha1 adds a + b → produces partial sum and carry
2. ha2 adds partial sum + cin → produces final sum
3. cout = ha1.carry OR ha2.carry (carry if either stage produces one)

## 4. 4-Bit Ripple Carry Adder (Iteration Pattern)

Adds two 4-bit numbers.

```
circuit RippleCarryAdder4 {
  input a: Bus[4]
  input b: Bus[4]
  input cin: Bit
  output sum: Bus[4]
  output cout: Bit

  impl {
    // Four full adders, one per bit
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder

    // Bit 0 (LSB)
    connect a[0] -> fa0.a
    connect b[0] -> fa0.b
    connect cin -> fa0.cin
    connect fa0.sum -> sum[0]

    // Bit 1
    connect a[1] -> fa1.a
    connect b[1] -> fa1.b
    connect fa0.cout -> fa1.cin  // Chain carry
    connect fa1.sum -> sum[1]

    // Bit 2
    connect a[2] -> fa2.a
    connect b[2] -> fa2.b
    connect fa1.cout -> fa2.cin  // Chain carry
    connect fa2.sum -> sum[2]

    // Bit 3 (MSB)
    connect a[3] -> fa3.a
    connect b[3] -> fa3.b
    connect fa2.cout -> fa3.cin  // Chain carry
    connect fa3.sum -> sum[3]

    // Final carry out
    connect fa3.cout -> cout
  }
}
```

## 5. Parameterized N-bit Adder (Scalable)

Generic adder that works for any bit width.

```
circuit RippleCarryAdder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  input cin: Bit
  output sum: Bus[width]
  output cout: Bit

  impl {
    // Generate width full adders
    // This would be expanded by the compiler based on width parameter

    // Pseudocode (actual syntax TBD):
    for i in 0..(width-1) {
      node fa[i]: FullAdder

      connect a[i] -> fa[i].a
      connect b[i] -> fa[i].b

      if i == 0 {
        connect cin -> fa[i].cin
      } else {
        connect fa[i-1].cout -> fa[i].cin
      }

      connect fa[i].sum -> sum[i]
    }

    connect fa[width-1].cout -> cout
  }
}

// Usage:
circuit Example {
  input x: Bus[8]
  input y: Bus[8]
  output result: Bus[8]

  impl {
    node adder: RippleCarryAdder(width = 8)

    connect x -> adder.a
    connect y -> adder.b
    connect 0 -> adder.cin  // No carry in
    connect adder.sum -> result
  }
}
```

## 6. Register (Simple State)

Stores a single bit value.

```
circuit Register {
  input d: Bit
  clock clk
  output q: Bit

  state value: Bit = 0

  impl {
    // On clock rising edge, capture input
    on clk rising {
      value = d
    }

    // Output always reflects current state
    q = value
  }
}
```

**Behavior:**
- Between clock edges: q holds its value
- On rising edge: q captures whatever is on d
- On falling edge: nothing happens

## 7. 8-Bit Register (Bus State)

Stores an 8-bit value.

```
circuit Register8 {
  input d: Bus[8]
  clock clk
  output q: Bus[8]

  state value: Bus[8] = 0x00

  impl {
    on clk rising {
      value = d
    }

    q = value
  }
}
```

## 8. Counter (Sequential Logic)

Counts up on each clock cycle.

```
circuit Counter8 {
  clock clk
  input reset: Bit
  output count: Bus[8]

  state value: Bus[8] = 0

  impl {
    // Combinational: output current count
    count = value

    // Sequential: increment on clock
    on clk rising {
      if reset {
        value = 0
      } else {
        value = value + 1
      }
    }
  }
}
```

## 9. 2-to-1 Multiplexer (Data Selector)

Selects one of two inputs based on a control signal.

```
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

    // When sel=0: pass a; when sel=1: pass b
    // out = (a AND NOT sel) OR (b AND sel)

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

**Truth Table:**
```
sel | a | b | out
----|---|---|----
 0  | 0 | X | 0
 0  | 1 | X | 1
 1  | X | 0 | 0
 1  | X | 1 | 1
```

## 10. 4-to-1 Multiplexer (Hierarchical)

Uses two 2-to-1 muxes to build a 4-to-1 mux.

```
circuit Mux4to1 {
  input a: Bit
  input b: Bit
  input c: Bit
  input d: Bit
  input sel: Bus[2]
  output out: Bit

  impl {
    node mux1: Mux2to1  // Select between a and b
    node mux2: Mux2to1  // Select between c and d
    node mux3: Mux2to1  // Select between mux1 and mux2

    // First level: sel[0] chooses within pairs
    connect a -> mux1.a
    connect b -> mux1.b
    connect sel[0] -> mux1.sel

    connect c -> mux2.a
    connect d -> mux2.b
    connect sel[0] -> mux2.sel

    // Second level: sel[1] chooses which pair
    connect mux1.out -> mux3.a
    connect mux2.out -> mux3.b
    connect sel[1] -> mux3.sel

    connect mux3.out -> out
  }
}
```

## 11. Simple ALU (Arithmetic Logic Unit)

Performs multiple operations based on opcode.

```
circuit SimpleALU {
  input a: Bus[8]
  input b: Bus[8]
  input opcode: Bus[2]  // 00=ADD, 01=SUB, 10=AND, 11=OR
  output result: Bus[8]

  impl {
    // Operation units
    node adder: RippleCarryAdder(width = 8)
    node subtractor: RippleCarryAdder(width = 8)  // Using adder for subtraction
    node and_op: BitwiseAnd(width = 8)
    node or_op: BitwiseOr(width = 8)

    // Result selector
    node mux: Mux4to1Bus(width = 8)

    // Connect inputs to all operation units
    connect a -> adder.a
    connect b -> adder.b
    connect 0 -> adder.cin

    connect a -> subtractor.a
    connect ~b -> subtractor.b  // Invert b for subtraction (two's complement)
    connect 1 -> subtractor.cin

    connect a -> and_op.a
    connect b -> and_op.b

    connect a -> or_op.a
    connect b -> or_op.b

    // Select result based on opcode
    connect adder.sum -> mux.in0
    connect subtractor.sum -> mux.in1
    connect and_op.out -> mux.in2
    connect or_op.out -> mux.in3
    connect opcode -> mux.sel

    connect mux.out -> result
  }
}
```

## 12. Small RAM (Memory)

8 bytes of memory, 3-bit address, 8-bit data.

```
circuit RAM8x8 {
  input addr: Bus[3]      // 3 bits = 8 addresses
  input data_in: Bus[8]
  input write_enable: Bit
  clock clk
  output data_out: Bus[8]

  state memory: Array[8, Bus[8]] = [0, 0, 0, 0, 0, 0, 0, 0]

  impl {
    // Read is combinational (immediate)
    data_out = memory[addr]

    // Write is sequential (on clock edge)
    on clk rising {
      if write_enable {
        memory[addr] = data_in
      }
    }
  }
}
```

## 13. State Machine (Pattern Detector)

Detects the sequence "101" in a serial bit stream.

```
circuit PatternDetector {
  input bit_in: Bit
  clock clk
  input reset: Bit
  output detected: Bit

  // States: IDLE=00, SAW1=01, SAW10=10, SAW101=11
  state current_state: Bus[2] = 0

  impl {
    // Output: high when in SAW101 state
    detected = (current_state == 3)

    // State transition on clock
    on clk rising {
      if reset {
        current_state = 0  // IDLE
      } else {
        // State machine logic
        switch current_state {
          case 0:  // IDLE
            current_state = bit_in ? 1 : 0  // Go to SAW1 if see '1'
          case 1:  // SAW1
            current_state = bit_in ? 1 : 2  // Go to SAW10 if see '0'
          case 2:  // SAW10
            current_state = bit_in ? 3 : 0  // Go to SAW101 if see '1'
          case 3:  // SAW101
            current_state = bit_in ? 1 : 2  // Continue or reset
        }
      }
    }
  }
}
```

## 14. Complete System (Tiny CPU)

A minimal CPU demonstrating all concepts.

```
circuit TinyCPU {
  clock clk
  input reset: Bit
  output halted: Bit

  state pc: Bus[8] = 0           // Program counter
  state accumulator: Bus[8] = 0  // Accumulator register

  impl {
    // Instruction memory (ROM)
    node rom: ROM(addr_width = 8, data_width = 16)

    // Data memory (RAM)
    node ram: RAM(addr_width = 8, data_width = 8)

    // ALU
    node alu: SimpleALU

    // Fetch instruction
    connect pc -> rom.addr
    // rom.data[15:12] is opcode, rom.data[11:0] is operand

    // Decode and execute on clock
    on clk rising {
      if reset {
        pc = 0
        accumulator = 0
        halted = 0
      } else if !halted {
        // Execute instruction based on opcode
        switch rom.data[15:12] {
          case 0x0:  // HALT
            halted = 1

          case 0x1:  // LOAD addr
            accumulator = ram.data_out  // Load from RAM

          case 0x2:  // STORE addr
            ram.write_enable = 1
            ram.data_in = accumulator

          case 0x3:  // ADD addr
            alu.a = accumulator
            alu.b = ram.data_out
            alu.opcode = 0  // ADD
            accumulator = alu.result

          // ... more instructions ...
        }

        // Increment program counter
        pc = pc + 1
      }
    }
  }
}
```

## Key Concepts Demonstrated

1. **Primitives** - And, Or, Xor (gates provided by simulator)
2. **Composition** - Building complex from simple (FullAdder from HalfAdder)
3. **Hierarchy** - Multiple levels (CPU uses ALU uses Adder uses FullAdder)
4. **Parameterization** - Generic components (N-bit adder)
5. **State** - Registers, memory, counters
6. **Clocking** - Synchronous sequential logic
7. **Buses** - Multi-bit signals
8. **Multiplexing** - Data selection
9. **State machines** - Sequential pattern recognition
10. **Systems** - Complete functional units (CPU)

## Design Patterns

### Pattern 1: Combinational Logic
```
circuit Example {
  input x: Bit
  output y: Bit

  impl {
    // Just logic gates, no state, no clock
    // y is computed directly from x
  }
}
```

### Pattern 2: Sequential Logic
```
circuit Example {
  input x: Bit
  clock clk
  output y: Bit

  state s: Bit = 0

  impl {
    y = s  // Combinational output

    on clk rising {
      s = x  // Sequential state update
    }
  }
}
```

### Pattern 3: Hierarchical Composition
```
circuit Level2 {
  impl {
    node component1: Level1Component
    node component2: Level1Component
    // Wire them together
  }
}
```

### Pattern 4: Parameterized Components
```
circuit Generic(N: Int) {
  input a: Bus[N]
  output b: Bus[N]

  impl {
    // Implementation scales with N
  }
}
```

## Next Steps

1. Study these examples to understand patterns
2. Try modifying them (change bit widths, add features)
3. Combine components to build new ones
4. Design your own circuits from scratch
