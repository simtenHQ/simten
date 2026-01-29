# Reference Implementations

## Overview

This document provides complete, correct reference implementations of circuits demonstrating all DSL features and patterns. Each example is shown in three forms:

1. **DSL** - Human/LLM-friendly source
2. **IR** - Complete JSON intermediate representation
3. **Execution trace** - Step-by-step simulation behavior

## Example 1: HalfAdder (Basic Composition)

### DSL

```
circuit HalfAdder {
  input a: Bit
  input b: Bit
  output sum: Bit
  output carry: Bit

  impl {
    node xor1: Xor
    node and1: And

    // Sum = a XOR b
    connect a -> xor1.a
    connect b -> xor1.b
    connect xor1.out -> sum

    // Carry = a AND b
    connect a -> and1.a
    connect b -> and1.b
    connect and1.out -> carry
  }
}
```

### IR (Complete JSON)

```json
{
  "id": "half_adder_001",
  "name": "HalfAdder",
  "parameters": [],
  "inputs": [
    { "name": "a", "portType": { "kind": "bit" } },
    { "name": "b", "portType": { "kind": "bit" } }
  ],
  "outputs": [
    { "name": "sum", "portType": { "kind": "bit" } },
    { "name": "carry", "portType": { "kind": "bit" } }
  ],
  "clocks": [],
  "state": [],
  "nodes": [
    {
      "id": "xor1",
      "componentRef": "Xor",
      "arguments": {},
      "inputs": [
        { "id": "xor1_in_a", "name": "a", "portType": { "kind": "bit" } },
        { "id": "xor1_in_b", "name": "b", "portType": { "kind": "bit" } }
      ],
      "outputs": [
        { "id": "xor1_out", "name": "out", "portType": { "kind": "bit" } }
      ],
      "clocks": []
    },
    {
      "id": "and1",
      "componentRef": "And",
      "arguments": {},
      "inputs": [
        { "id": "and1_in_a", "name": "a", "portType": { "kind": "bit" } },
        { "id": "and1_in_b", "name": "b", "portType": { "kind": "bit" } }
      ],
      "outputs": [
        { "id": "and1_out", "name": "out", "portType": { "kind": "bit" } }
      ],
      "clocks": []
    }
  ],
  "connections": [
    {
      "id": "conn_1",
      "source": { "nodeId": "", "portName": "a" },
      "target": { "nodeId": "xor1", "portName": "a" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_2",
      "source": { "nodeId": "", "portName": "b" },
      "target": { "nodeId": "xor1", "portName": "b" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_3",
      "source": { "nodeId": "xor1", "portName": "out" },
      "target": { "nodeId": "", "portName": "sum" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_4",
      "source": { "nodeId": "", "portName": "a" },
      "target": { "nodeId": "and1", "portName": "a" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_5",
      "source": { "nodeId": "", "portName": "b" },
      "target": { "nodeId": "and1", "portName": "b" },
      "portType": { "kind": "bit" }
    },
    {
      "id": "conn_6",
      "source": { "nodeId": "and1", "portName": "out" },
      "target": { "nodeId": "", "portName": "carry" },
      "portType": { "kind": "bit" }
    }
  ],
  "implementation": { "kind": "composite" },
  "metadata": {
    "description": "Adds two bits, producing sum and carry",
    "testCases": [
      {
        "name": "0 + 0 = 0",
        "inputs": { "a": false, "b": false },
        "expectedOutputs": { "sum": false, "carry": false }
      },
      {
        "name": "0 + 1 = 1",
        "inputs": { "a": false, "b": true },
        "expectedOutputs": { "sum": true, "carry": false }
      },
      {
        "name": "1 + 0 = 1",
        "inputs": { "a": true, "b": false },
        "expectedOutputs": { "sum": true, "carry": false }
      },
      {
        "name": "1 + 1 = 10",
        "inputs": { "a": true, "b": true },
        "expectedOutputs": { "sum": false, "carry": true }
      }
    ]
  }
}
```

### Execution Trace

**Test case: a=1, b=1**

```
1. Initialize inputs:
   circuit.a = true
   circuit.b = true

2. Topological sort:
   Order: [xor1, and1]

3. Evaluate xor1:
   Input: a=true, b=true
   Logic: true XOR true = false
   Output: xor1.out = false

4. Evaluate and1:
   Input: a=true, b=true
   Logic: true AND true = true
   Output: and1.out = true

5. Propagate to outputs:
   circuit.sum = xor1.out = false
   circuit.carry = and1.out = true

6. Result: {sum: false, carry: true} ✓ Correct (1+1=10 in binary)
```

## Example 2: FullAdder (Hierarchical Composition)

### DSL

```
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

    // First half adder: a + b
    connect a -> ha1.a
    connect b -> ha1.b

    // Second half adder: (a+b) + cin
    connect ha1.sum -> ha2.a
    connect cin -> ha2.b
    connect ha2.sum -> sum

    // Carry out: either stage produced carry
    connect ha1.carry -> or1.a
    connect ha2.carry -> or1.b
    connect or1.out -> cout
  }
}
```

### IR (Simplified - Key Parts)

```json
{
  "name": "FullAdder",
  "inputs": [
    { "name": "a", "portType": { "kind": "bit" } },
    { "name": "b", "portType": { "kind": "bit" } },
    { "name": "cin", "portType": { "kind": "bit" } }
  ],
  "outputs": [
    { "name": "sum", "portType": { "kind": "bit" } },
    { "name": "cout", "portType": { "kind": "bit" } }
  ],
  "nodes": [
    { "id": "ha1", "componentRef": "HalfAdder", ... },
    { "id": "ha2", "componentRef": "HalfAdder", ... },
    { "id": "or1", "componentRef": "Or", ... }
  ],
  "connections": [
    { "source": { "nodeId": "", "portName": "a" },
      "target": { "nodeId": "ha1", "portName": "a" } },
    { "source": { "nodeId": "", "portName": "b" },
      "target": { "nodeId": "ha1", "portName": "b" } },
    { "source": { "nodeId": "ha1", "portName": "sum" },
      "target": { "nodeId": "ha2", "portName": "a" } },
    { "source": { "nodeId": "", "portName": "cin" },
      "target": { "nodeId": "ha2", "portName": "b" } },
    { "source": { "nodeId": "ha2", "portName": "sum" },
      "target": { "nodeId": "", "portName": "sum" } },
    { "source": { "nodeId": "ha1", "portName": "carry" },
      "target": { "nodeId": "or1", "portName": "a" } },
    { "source": { "nodeId": "ha2", "portName": "carry" },
      "target": { "nodeId": "or1", "portName": "b" } },
    { "source": { "nodeId": "or1", "portName": "out" },
      "target": { "nodeId": "", "portName": "cout" } }
  ],
  "implementation": { "kind": "composite" }
}
```

### Execution Trace

**Test case: a=1, b=1, cin=1**

```
1. Initialize inputs:
   circuit.a = true
   circuit.b = true
   circuit.cin = true

2. Evaluate ha1 (HalfAdder):
   Inputs: a=true, b=true
   Outputs: sum=false, carry=true

3. Evaluate ha2 (HalfAdder):
   Inputs: a=false (from ha1.sum), b=true (cin)
   Outputs: sum=true, carry=false

4. Evaluate or1:
   Inputs: a=true (ha1.carry), b=false (ha2.carry)
   Output: out=true

5. Result:
   circuit.sum = true (ha2.sum)
   circuit.cout = true (or1.out)

6. Verification: 1+1+1 = 11 (binary) = {sum: true, cout: true} ✓
```

## Example 3: Register (Simple State)

### DSL

```
circuit Register {
  input d: Bit
  clock clk
  output q: Bit

  state value: Bit = 0

  impl {
    // Output always shows current state
    q = value

    // On rising edge, capture input
    on clk rising {
      value = d
    }
  }
}
```

### IR

```json
{
  "name": "Register",
  "inputs": [
    { "name": "d", "portType": { "kind": "bit" } }
  ],
  "outputs": [
    { "name": "q", "portType": { "kind": "bit" } }
  ],
  "clocks": [
    { "name": "clk" }
  ],
  "state": [
    {
      "id": "state_value",
      "name": "value",
      "stateType": { "kind": "bit" },
      "initialValue": false,
      "clockRef": "clk",
      "edge": "rising"
    }
  ],
  "nodes": [],
  "connections": [],
  "implementation": { "kind": "primitive" }
}
```

### Execution Trace

```
Time  | clk | d | q | value (internal)
------|-----|---|---|------------------
  0   |  0  | 0 | 0 | 0                  (initial state)
  1   |  0  | 1 | 0 | 0                  (d changes, q unchanged)
  2   |  1  | 1 | 1 | 1                  (rising edge! capture d→value, q updates)
  3   |  1  | 0 | 1 | 1                  (d changes, but no edge, q holds)
  4   |  0  | 0 | 1 | 1                  (falling edge, no effect)
  5   |  1  | 0 | 0 | 0                  (rising edge! capture d→value, q updates)
```

## Example 4: 4-Bit Ripple Carry Adder (Buses)

### DSL

```
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

    // Bit 0 (LSB)
    connect a[0] -> fa0.a
    connect b[0] -> fa0.b
    connect cin -> fa0.cin
    connect fa0.sum -> sum[0]

    // Bit 1
    connect a[1] -> fa1.a
    connect b[1] -> fa1.b
    connect fa0.cout -> fa1.cin
    connect fa1.sum -> sum[1]

    // Bit 2
    connect a[2] -> fa2.a
    connect b[2] -> fa2.b
    connect fa1.cout -> fa2.cin
    connect fa2.sum -> sum[2]

    // Bit 3 (MSB)
    connect a[3] -> fa3.a
    connect b[3] -> fa3.b
    connect fa2.cout -> fa3.cin
    connect fa3.sum -> sum[3]

    // Final carry
    connect fa3.cout -> cout
  }
}
```

### Execution Trace

**Test case: a=0101 (5), b=0011 (3), cin=0**

```
1. Initialize:
   a = 0101 (5 in decimal)
   b = 0011 (3 in decimal)
   cin = 0

2. Evaluate fa0 (bit 0):
   Inputs: a[0]=1, b[0]=1, cin=0
   Result: sum=0, cout=1

3. Evaluate fa1 (bit 1):
   Inputs: a[1]=0, b[1]=1, cin=1 (from fa0)
   Result: sum=0, cout=1

4. Evaluate fa2 (bit 2):
   Inputs: a[2]=1, b[2]=0, cin=1 (from fa1)
   Result: sum=0, cout=1

5. Evaluate fa3 (bit 3):
   Inputs: a[3]=0, b[3]=0, cin=1 (from fa2)
   Result: sum=1, cout=0

6. Result:
   sum = 1000 (8 in decimal)
   cout = 0

7. Verification: 5 + 3 = 8 = 1000 (binary) ✓
```

## Example 5: Counter (Sequential Logic)

### DSL

```
circuit Counter4 {
  clock clk
  input reset: Bit
  output count: Bus[4]

  state value: Bus[4] = 0

  impl {
    // Output always shows current count
    count = value

    // Update on clock edge
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

### IR (Simplified)

```json
{
  "name": "Counter4",
  "inputs": [
    { "name": "reset", "portType": { "kind": "bit" } }
  ],
  "outputs": [
    { "name": "count", "portType": { "kind": "bus", "width": 4 } }
  ],
  "clocks": [
    { "name": "clk" }
  ],
  "state": [
    {
      "id": "state_value",
      "name": "value",
      "stateType": { "kind": "bus", "width": 4 },
      "initialValue": 0,
      "clockRef": "clk",
      "edge": "rising"
    }
  ],
  "implementation": { "kind": "primitive" }
}
```

### Execution Trace

```
Cycle | clk | reset | count | value (internal)
------|-----|-------|-------|------------------
  0   |  0  |   0   |   0   |   0               (initial)
  1   |  1  |   0   |   1   |   1               (rising edge, increment)
  2   |  0  |   0   |   1   |   1               (no edge)
  3   |  1  |   0   |   2   |   2               (rising edge, increment)
  4   |  0  |   0   |   2   |   2               (no edge)
  5   |  1  |   0   |   3   |   3               (rising edge, increment)
  6   |  0  |   1   |   3   |   3               (no edge, reset signal ignored)
  7   |  1  |   1   |   0   |   0               (rising edge, reset!)
  8   |  0  |   0   |   0   |   0               (no edge)
  9   |  1  |   0   |   1   |   1               (rising edge, increment)
```

## Example 6: Small RAM (Memory)

### DSL

```
circuit RAM4x4 {
  input addr: Bus[2]       // 2 bits = 4 addresses
  input data_in: Bus[4]
  input write_enable: Bit
  clock clk
  output data_out: Bus[4]

  state memory: Array[4, Bus[4]] = [0, 0, 0, 0]

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

### Execution Trace

```
Operation: Write 0xA to address 2, then read it back

Cycle | clk | addr | data_in | wr_en | data_out | memory
------|-----|------|---------|-------|----------|--------
  0   |  0  |  00  |   0000  |   0   |   0000   | [0,0,0,0]
  1   |  0  |  10  |   1010  |   1   |   0000   | [0,0,0,0]  (setup write)
  2   |  1  |  10  |   1010  |   1   |   1010   | [0,0,10,0] (rising edge, write!)
  3   |  0  |  10  |   0000  |   0   |   1010   | [0,0,10,0] (read shows written value)
  4   |  0  |  00  |   0000  |   0   |   0000   | [0,0,10,0] (read address 0)
  5   |  0  |  01  |   0000  |   0   |   0000   | [0,0,10,0] (read address 1)
  6   |  0  |  10  |   0000  |   0   |   1010   | [0,0,10,0] (read address 2, shows 0xA!)
```

## Example 7: Parameterized N-bit Adder

### DSL

```
circuit RippleCarryAdder(width: Int) {
  input a: Bus[width]
  input b: Bus[width]
  input cin: Bit
  output sum: Bus[width]
  output cout: Bit

  impl {
    // Generate 'width' full adders, chain carries
    // (Pseudocode - actual implementation would expand at compile time)
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
```

### Usage

```
circuit Example {
  input x: Bus[8]
  input y: Bus[8]
  output result: Bus[8]

  impl {
    node adder: RippleCarryAdder(width = 8)

    connect x -> adder.a
    connect y -> adder.b
    connect 0 -> adder.cin
    connect adder.sum -> result
  }
}
```

### IR (for width=8, expanded)

The IR would contain 8 FullAdder nodes (fa0 through fa7) with appropriate connections. The parameterization is resolved at compile time.

## Example 8: State Machine (Pattern Detector)

### DSL

```
circuit PatternDetector {
  input bit_in: Bit
  clock clk
  input reset: Bit
  output detected: Bit

  // States: IDLE=0, SAW1=1, SAW10=2, SAW101=3
  state current_state: Bus[2] = 0

  impl {
    // Output high when in SAW101 state
    detected = (current_state == 3)

    // State transitions
    on clk rising {
      if reset {
        current_state = 0  // IDLE
      } else {
        switch current_state {
          case 0:  // IDLE
            current_state = bit_in ? 1 : 0
          case 1:  // SAW1
            current_state = bit_in ? 1 : 2
          case 2:  // SAW10
            current_state = bit_in ? 3 : 0
          case 3:  // SAW101 (detected!)
            current_state = bit_in ? 1 : 2
        }
      }
    }
  }
}
```

### Execution Trace

**Input sequence: 1, 0, 1, 0, 1**

```
Cycle | clk | bit_in | reset | state | detected | Notes
------|-----|--------|-------|-------|----------|-------
  0   |  0  |   X    |   0   |  0    |   0      | Initial: IDLE
  1   |  1  |   1    |   0   |  1    |   0      | Saw '1' → SAW1
  2   |  0  |   1    |   0   |  1    |   0      | (no edge)
  3   |  1  |   0    |   0   |  2    |   0      | Saw '0' → SAW10
  4   |  0  |   0    |   0   |  2    |   0      | (no edge)
  5   |  1  |   1    |   0   |  3    |   1      | Saw '1' → SAW101, DETECTED!
  6   |  0  |   1    |   0   |  3    |   1      | (no edge, still detected)
  7   |  1  |   0    |   0   |  2    |   0      | Continue to SAW10
  8   |  0  |   0    |   0   |  2    |   0      | (no edge)
  9   |  1  |   1    |   0   |  3    |   1      | Saw '1' again → SAW101, DETECTED!
```

## Summary of Patterns

1. **Combinational** - HalfAdder, FullAdder, RippleCarryAdder
   - No state, no clock
   - Output computed directly from inputs

2. **Hierarchical** - FullAdder uses HalfAdder
   - Components built from other components
   - Reuse and abstraction

3. **Stateful** - Register, Counter
   - State persists between cycles
   - Clock-driven updates

4. **Memory** - RAM
   - Large state (arrays)
   - Separate read (combinational) and write (sequential)

5. **Parameterized** - RippleCarryAdder(width)
   - Generic components
   - Compile-time instantiation

6. **State Machines** - PatternDetector
   - Discrete states
   - Conditional transitions

These patterns cover the essential building blocks for any digital circuit.
