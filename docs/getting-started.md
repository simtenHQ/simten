# Getting Started with Turing Incomplete

Welcome to Turing Incomplete, a visual circuit simulator and DSL-based hardware description environment for learning and experimenting with digital logic.

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/turing-incomplete.git
cd turing-incomplete

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser to `http://localhost:3000`

### Requirements

- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, Edge, Safari)
- No other dependencies required

---

## Your First Circuit

### Step 1: Create a Simple Logic Gate Circuit

Let's build a half adder - a circuit that adds two bits.

1. **Open the Visual Editor**
   - Navigate to the main page
   - You'll see an empty canvas with a component palette on the left

2. **Add Components**
   - From the palette, drag these components onto the canvas:
     - **Xor** gate (under Logic Gates)
     - **And** gate (under Logic Gates)
     - **Switch** (2x, under I/O)
     - **Led** (2x, under I/O)

3. **Connect the Circuit**
   - Click and drag from a component's output port to another component's input port
   - Connect:
     - `switch1.out` → `xor1.a`
     - `switch2.out` → `xor1.b`
     - `xor1.out` → `led1.in` (sum output)
     - `switch1.out` → `and1.a`
     - `switch2.out` → `and1.b`
     - `and1.out` → `led2.in` (carry output)

4. **Test Your Circuit**
   - Toggle switches to test different inputs
   - Observe LEDs showing sum and carry outputs
   - Try all four combinations: 00, 01, 10, 11

**What you built:** A half adder! The XOR gate produces the sum bit, and the AND gate produces the carry bit.

---

## Using the DSL Editor

The DSL (Domain-Specific Language) lets you define circuits as text, which is more powerful for complex designs.

### Step 2: Define a Circuit in DSL

Click the **DSL Editor** tab and enter:

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

**DSL Syntax Basics:**

- `circuit Name { ... }` - Define a new component
- `input name: Type` - Declare inputs
- `output name: Type` - Declare outputs
- `impl { ... }` - Implementation block
- `node id: ComponentType` - Instantiate a component
- `connect source -> target` - Wire components together

### Step 3: Use Your Custom Component

Once defined, your HalfAdder can be used like any primitive:

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

**Key Concept:** Components you define are **composites** - they're purely structural (describing connections). Only **primitives** (And, Or, Xor, Register, etc.) have executable behavior. All execution reduces to primitive operations.

See [Component Model](./SPECIFICATIONS/component-model.md) for the full explanation.

---

## Sequential Circuits (Clocked)

### Step 4: Build a Counter

Sequential circuits have state and use clocks. Let's build a simple counter.

**Visual Editor:**

1. Add components:
   - **Register** (stores the count)
   - **Incrementer** (adds 1)
   - **Switch** (clock input)
   - **HexDisplay** (shows the count)

2. Connect:
   - `register.q` → `incrementer.in`
   - `incrementer.out` → `register.d`
   - `switch.out` → `register.clk`
   - `register.q` → `hexDisplay.in`

3. Test:
   - Toggle the switch to create clock edges
   - Each rising edge increments the counter
   - HexDisplay shows the current count

**DSL Version:**

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

**Key Concepts:**
- **Sequential components** (Register, DFlipFlop, RAM) have state
- State updates on **clock edges** (rising or falling)
- **Bus[N]** represents multi-bit values (e.g., Bus[8] = 8 bits)

---

## Debugging Features

### Clock Controls

Use the clock control panel to:

- **Step**: Advance one clock cycle
- **Run**: Continuously cycle the clock
- **Pause**: Stop running
- **Reset**: Reset all state to initial values

### Time-Travel Debugging

Navigate through simulation history:

1. **Run your circuit** for several cycles
2. **Click "Back"** to step backward through history
3. **Click "Forward"** to step forward
4. **Use the timeline scrubber** to jump to any cycle

**Timeline Branching:**
- Go back in time, then step/run creates a **new timeline**
- Old future is discarded (prevents confusion)
- You can change inputs while viewing past - new timeline uses new values

See [Time-Travel Debugging](./FEATURES/time-travel-debugging.md) for full details.

### Visual Debugging

- **Probes**: Add Probe components to observe signals
- **LED indicators**: Visual feedback for bit values
- **HexDisplay**: View multi-bit values
- **Wire colors**: Live values shown on connections (if enabled)

---

## Component Types

### Primitives (Built-in, Executable)

**Logic Gates:**
- And, Or, Not, Nand, Nor, Xor, Xnor, Buffer

**Arithmetic:**
- Adder, Multiplier, Comparator, Incrementer

**Sequential:**
- DFlipFlop, Register

**Memory:**
- RAM, ROM, DualPortRAM

**Display:**
- Led, SevenSegment, HexDisplay, Screen, RasterDisplay

**I/O:**
- Switch, Button, Input

**Utilities:**
- Mux, Decoder, Splitter, Probe, BitSlice, Constant

See [Primitive Quick Reference](./REFERENCE/primitive-quick-reference.md) for complete list with port specifications.

### Composites (User-Defined, Structural)

Components you define in DSL:
- **No executable behavior** (purely structural)
- **Expand to primitives** during simulation
- **Can be parameterized** (e.g., width)
- **Reusable** across circuits

---

## Example Projects

### 1. 4-Bit Ripple Carry Adder

```dsl
circuit FourBitAdder {
  input a: Bus[4]
  input b: Bus[4]
  input cin: Bit
  output sum: Bus[4]
  output cout: Bit

  impl {
    // Use 4 FullAdders chained together
    node fa0: FullAdder
    node fa1: FullAdder
    node fa2: FullAdder
    node fa3: FullAdder

    // Chain carry bits
    connect cin -> fa0.cin
    connect fa0.cout -> fa1.cin
    connect fa1.cout -> fa2.cin
    connect fa2.cout -> fa3.cin
    connect fa3.cout -> cout

    // Connect data bits (would need bus splitter in practice)
    // ... (simplified for example)
  }
}
```

### 2. Traffic Light Controller

Uses a state machine to cycle through light patterns:

```dsl
circuit TrafficLight {
  input clk: Bit
  output red: Bit
  output yellow: Bit
  output green: Bit

  impl {
    // Counter for state
    node counter: Register
    node inc: Incrementer

    // Compare for state transitions
    node cmp: Comparator

    // State outputs (decoded from counter)
    // State 0: Red
    // State 1: Green
    // State 2: Yellow
    // ... (full implementation would decode states)
  }
}
```

### 3. Simple CPU (Advanced)

Demonstrates a minimal CPU architecture:
- Program counter
- Instruction memory (ROM)
- ALU
- Register file

See example circuits in `/examples/` directory.

---

## Next Steps

### Learn More

- **[Component Model](./SPECIFICATIONS/component-model.md)** - Understand primitives vs composites
- **[DSL Specification](./SPECIFICATIONS/DSL-and-IR-specification.md)** - Complete language reference
- **[Architecture Guide](./ARCHITECTURE/system-architecture.md)** - How the simulator works
- **[Adding Primitives](./how-to-add-primitive.md)** - Extend the system with new primitives

### Practice Projects

Start with these progressively complex projects:

1. **Logic Gates Review**
   - Build all basic gates from NAND
   - Verify truth tables

2. **Arithmetic Circuits**
   - Half Adder → Full Adder → 8-bit Adder
   - Comparator (equal, less than, greater than)
   - Multiplexer and Demultiplexer

3. **Sequential Circuits**
   - JK Flip-Flop from D Flip-Flops
   - Shift Register (8-bit)
   - Counter with load/enable

4. **Memory Systems**
   - Register File (8 registers, 8-bit)
   - Stack (LIFO)
   - Simple cache

5. **Complete Systems**
   - ALU (8 operations)
   - Simple CPU (load/store/add/branch)
   - VGA pattern generator

### Get Help

- **Documentation**: This `/docs/` directory
- **Examples**: `/examples/` directory
- **Issues**: GitHub issues for bugs/feature requests
- **Discussions**: GitHub discussions for questions

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Step (advance one cycle) |
| R | Run/Pause |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save circuit |
| Ctrl+Left | Step back (time-travel) |
| Ctrl+Right | Step forward (time-travel) |
| Delete | Delete selected component |

---

## Tips for Success

1. **Start Simple** - Build small circuits first, then combine them
2. **Test Incrementally** - Verify each component before adding more
3. **Use Composites** - Break complex designs into reusable pieces
4. **Name Clearly** - Use descriptive names for nodes and circuits
5. **Document** - Add comments explaining non-obvious design decisions
6. **Debug with Probes** - Place probes at key signals to observe behavior
7. **Use Time-Travel** - Step backward to understand where bugs occur

## Common Pitfalls

1. **Combinational Loops** - Avoid cycles in your circuit graph (e.g., `a.out → b.in → a.in`)
2. **Unconnected Inputs** - All inputs must be driven (default to false/0 if not connected)
3. **Clock Confusion** - Remember: state updates on edges, not levels
4. **Mixing Bit Types** - Can't connect Bit directly to Bus without conversion
5. **Forgetting State** - Sequential components need proper initialization

---

## What Makes Turing Incomplete Unique?

- **Clear separation**: Primitives (behavior) vs Composites (structure)
- **Full introspection**: All composites expand to primitives
- **Deterministic replay**: Time-travel debugging with environmental state capture
- **Modern DSL**: Clean syntax for hardware description
- **Visual + Textual**: Switch between visual editor and DSL as needed
- **Educational focus**: Designed for learning, not production HDL

Happy circuit building! 🔧⚡
